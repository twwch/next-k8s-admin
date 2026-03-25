import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const TOKEN_PREFIX = 'k8s-aws-v1.';
const STS_TOKEN_EXPIRES_IN = 60; // seconds

/**
 * Generate a presigned URL for STS GetCallerIdentity,
 * which serves as the EKS bearer token.
 * This replicates `aws eks get-token --cluster-name <name>`.
 */
export async function getSignedUrl(clusterName: string, region: string): Promise<string> {
  const credentials = fromNodeProviderChain({ clientConfig: { region } });

  const signer = new SignatureV4({
    credentials,
    region,
    service: 'sts',
    sha256: Sha256,
  });

  const request = new HttpRequest({
    method: 'GET',
    protocol: 'https:',
    hostname: `sts.${region}.amazonaws.com`,
    path: '/',
    query: {
      'Action': 'GetCallerIdentity',
      'Version': '2011-06-15',
      'X-Amz-Expires': String(STS_TOKEN_EXPIRES_IN),
    },
    headers: {
      host: `sts.${region}.amazonaws.com`,
      'x-k8s-aws-id': clusterName,
    },
  });

  const signed = await signer.presign(request, { expiresIn: STS_TOKEN_EXPIRES_IN });

  // Build the full URL from the signed request
  const query = signed.query || {};
  const queryString = Object.entries(query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

  const url = `https://${signed.hostname}${signed.path}?${queryString}`;

  // Base64url encode (no padding) as required by EKS
  const token = TOKEN_PREFIX + Buffer.from(url).toString('base64url');

  return token;
}
