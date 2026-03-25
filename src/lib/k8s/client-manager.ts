import * as k8s from '@kubernetes/client-node';
import { execSync } from 'child_process';
import { getSignedUrl } from './eks-token';
import { db } from '@/lib/db';
import { clusters } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';
import yaml from 'yaml';

interface K8sClients {
  kc: k8s.KubeConfig;
  core: k8s.CoreV1Api;
  apps: k8s.AppsV1Api;
  batch: k8s.BatchV1Api;
  networking: k8s.NetworkingV1Api;
  storage: k8s.StorageV1Api;
}

const clientCache = new Map<string, K8sClients>();

/**
 * Detect if kubeconfig uses EKS exec-based auth (aws eks get-token)
 * and replace it with a static bearer token generated via AWS SDK.
 */
async function resolveEksAuth(kc: k8s.KubeConfig, kubeconfigYaml: string) {
  const parsed = yaml.parse(kubeconfigYaml);
  if (!parsed?.users) return;

  for (let i = 0; i < parsed.users.length; i++) {
    const userEntry = parsed.users[i];
    const exec = userEntry?.user?.exec;
    if (!exec) continue;

    // Check if this is an aws eks get-token exec
    const isAwsEks = exec.command === 'aws' &&
      Array.isArray(exec.args) &&
      exec.args.includes('eks') &&
      exec.args.includes('get-token');

    if (isAwsEks) {
      // Extract cluster name and region from args
      const args = exec.args as string[];
      const clusterNameIdx = args.indexOf('--cluster-name');
      const regionIdx = args.indexOf('--region');
      const clusterName = clusterNameIdx >= 0 ? args[clusterNameIdx + 1] : undefined;
      const region = regionIdx >= 0 ? args[regionIdx + 1] : 'us-east-1';

      if (clusterName) {
        try {
          const token = await generateEksToken(clusterName, region);
          // Replace exec user with token-based user
          const kcUser = kc.users[i];
          if (kcUser) {
            (kcUser as any).token = token;
            // Remove exec so it uses the token instead
            (kcUser as any).exec = undefined;
          }
        } catch (err: any) {
          throw new Error(`Failed to generate EKS token for cluster "${clusterName}": ${err.message}`);
        }
      }
    } else {
      // For non-AWS exec commands, try to resolve the full path
      if (exec.command && !exec.command.startsWith('/')) {
        try {
          const fullPath = execSync(`which ${exec.command}`, { encoding: 'utf8' }).trim();
          if (fullPath) {
            const kcUser = kc.users[i];
            if (kcUser && (kcUser as any).exec) {
              (kcUser as any).exec.command = fullPath;
            }
          }
        } catch {
          // command not found
        }
      }
    }
  }
}

/**
 * Generate an EKS bearer token using AWS SDK (no aws CLI needed).
 * This replicates what `aws eks get-token` does.
 */
async function generateEksToken(clusterName: string, region: string): Promise<string> {
  const token = await getSignedUrl(clusterName, region);
  return token;
}

async function buildKubeConfig(clusterId: string): Promise<k8s.KubeConfig> {
  const [cluster] = await db.select().from(clusters).where(eq(clusters.id, clusterId)).limit(1);
  if (!cluster) throw new Error(`Cluster ${clusterId} not found`);

  const kc = new k8s.KubeConfig();

  if (cluster.authType === 'kubeconfig' && cluster.kubeconfig) {
    const kubeconfigStr = decrypt(cluster.kubeconfig);
    kc.loadFromString(kubeconfigStr);
    await resolveEksAuth(kc, kubeconfigStr);
  } else if (cluster.authType === 'token' && cluster.saToken) {
    const clusterConfig = {
      name: cluster.name,
      server: cluster.apiServerUrl,
      caData: cluster.caCert || undefined,
      skipTLSVerify: !cluster.caCert,
    };
    const userConfig = {
      name: `${cluster.name}-user`,
      token: decrypt(cluster.saToken),
    };
    kc.loadFromClusterAndUser(clusterConfig, userConfig);
  } else {
    throw new Error(`Invalid auth configuration for cluster ${cluster.name}`);
  }

  return kc;
}

export async function getK8sClient(clusterId: string): Promise<K8sClients> {
  const cached = clientCache.get(clusterId);
  if (cached) return cached;

  const kc = await buildKubeConfig(clusterId);
  const clients: K8sClients = {
    kc,
    core: kc.makeApiClient(k8s.CoreV1Api),
    apps: kc.makeApiClient(k8s.AppsV1Api),
    batch: kc.makeApiClient(k8s.BatchV1Api),
    networking: kc.makeApiClient(k8s.NetworkingV1Api),
    storage: kc.makeApiClient(k8s.StorageV1Api),
  };

  clientCache.set(clusterId, clients);
  return clients;
}

export function invalidateClient(clusterId: string) {
  clientCache.delete(clusterId);
}
