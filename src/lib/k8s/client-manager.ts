import * as k8s from '@kubernetes/client-node';
import { db } from '@/lib/db';
import { clusters } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/crypto';

interface K8sClients {
  kc: k8s.KubeConfig;
  core: k8s.CoreV1Api;
  apps: k8s.AppsV1Api;
  batch: k8s.BatchV1Api;
  networking: k8s.NetworkingV1Api;
  storage: k8s.StorageV1Api;
}

const clientCache = new Map<string, K8sClients>();

async function buildKubeConfig(clusterId: string): Promise<k8s.KubeConfig> {
  const [cluster] = await db.select().from(clusters).where(eq(clusters.id, clusterId)).limit(1);
  if (!cluster) throw new Error(`Cluster ${clusterId} not found`);

  const kc = new k8s.KubeConfig();

  if (cluster.authType === 'kubeconfig' && cluster.kubeconfig) {
    kc.loadFromString(decrypt(cluster.kubeconfig));
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

// Version info helper (used by connection test)
export async function getVersionInfo(clusterId: string) {
  const clients = await getK8sClient(clusterId);
  const versionApi = clients.kc.makeApiClient(k8s.VersionApi);
  const res = await versionApi.getCode();
  return res;
}
