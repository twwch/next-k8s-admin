import { getK8sClient } from './client-manager';

export type ResourceKind =
  | 'namespaces' | 'pods' | 'deployments' | 'replicasets' | 'statefulsets' | 'daemonsets'
  | 'jobs' | 'cronjobs' | 'services' | 'ingresses'
  | 'configmaps' | 'secrets' | 'persistentvolumeclaims' | 'persistentvolumes' | 'storageclasses'
  | 'nodes' | 'events';

export async function listResources(clusterId: string, kind: ResourceKind, namespace?: string) {
  const clients = await getK8sClient(clusterId);

  switch (kind) {
    case 'namespaces':
      return (await clients.core.listNamespace()).items;
    case 'nodes':
      return (await clients.core.listNode()).items;
    case 'pods':
      return namespace
        ? (await clients.core.listNamespacedPod({ namespace })).items
        : (await clients.core.listPodForAllNamespaces()).items;
    case 'deployments':
      return namespace
        ? (await clients.apps.listNamespacedDeployment({ namespace })).items
        : (await clients.apps.listDeploymentForAllNamespaces()).items;
    case 'replicasets':
      return namespace
        ? (await clients.apps.listNamespacedReplicaSet({ namespace })).items
        : (await clients.apps.listReplicaSetForAllNamespaces()).items;
    case 'statefulsets':
      return namespace
        ? (await clients.apps.listNamespacedStatefulSet({ namespace })).items
        : (await clients.apps.listStatefulSetForAllNamespaces()).items;
    case 'daemonsets':
      return namespace
        ? (await clients.apps.listNamespacedDaemonSet({ namespace })).items
        : (await clients.apps.listDaemonSetForAllNamespaces()).items;
    case 'jobs':
      return namespace
        ? (await clients.batch.listNamespacedJob({ namespace })).items
        : (await clients.batch.listJobForAllNamespaces()).items;
    case 'cronjobs':
      return namespace
        ? (await clients.batch.listNamespacedCronJob({ namespace })).items
        : (await clients.batch.listCronJobForAllNamespaces()).items;
    case 'services':
      return namespace
        ? (await clients.core.listNamespacedService({ namespace })).items
        : (await clients.core.listServiceForAllNamespaces()).items;
    case 'ingresses':
      return namespace
        ? (await clients.networking.listNamespacedIngress({ namespace })).items
        : (await clients.networking.listIngressForAllNamespaces()).items;
    case 'configmaps':
      return namespace
        ? (await clients.core.listNamespacedConfigMap({ namespace })).items
        : (await clients.core.listConfigMapForAllNamespaces()).items;
    case 'secrets':
      return namespace
        ? (await clients.core.listNamespacedSecret({ namespace })).items
        : (await clients.core.listSecretForAllNamespaces()).items;
    case 'persistentvolumeclaims':
      return namespace
        ? (await clients.core.listNamespacedPersistentVolumeClaim({ namespace })).items
        : (await clients.core.listPersistentVolumeClaimForAllNamespaces()).items;
    case 'persistentvolumes':
      return (await clients.core.listPersistentVolume()).items;
    case 'storageclasses':
      return (await clients.storage.listStorageClass()).items;
    case 'events':
      return namespace
        ? (await clients.core.listNamespacedEvent({ namespace })).items
        : (await clients.core.listEventForAllNamespaces()).items;
    default:
      throw new Error(`Unknown resource kind: ${kind}`);
  }
}

export async function getResource(clusterId: string, kind: ResourceKind, name: string, namespace?: string) {
  const clients = await getK8sClient(clusterId);
  switch (kind) {
    case 'pods': return clients.core.readNamespacedPod({ name, namespace: namespace! });
    case 'deployments': return clients.apps.readNamespacedDeployment({ name, namespace: namespace! });
    case 'services': return clients.core.readNamespacedService({ name, namespace: namespace! });
    case 'configmaps': return clients.core.readNamespacedConfigMap({ name, namespace: namespace! });
    case 'secrets': return clients.core.readNamespacedSecret({ name, namespace: namespace! });
    case 'ingresses': return clients.networking.readNamespacedIngress({ name, namespace: namespace! });
    case 'statefulsets': return clients.apps.readNamespacedStatefulSet({ name, namespace: namespace! });
    case 'daemonsets': return clients.apps.readNamespacedDaemonSet({ name, namespace: namespace! });
    case 'jobs': return clients.batch.readNamespacedJob({ name, namespace: namespace! });
    case 'persistentvolumeclaims': return clients.core.readNamespacedPersistentVolumeClaim({ name, namespace: namespace! });
    default: throw new Error(`GET not supported for ${kind}`);
  }
}

export async function createResource(clusterId: string, kind: ResourceKind, body: any, namespace?: string) {
  const clients = await getK8sClient(clusterId);
  switch (kind) {
    case 'deployments': return clients.apps.createNamespacedDeployment({ namespace: namespace!, body });
    case 'services': return clients.core.createNamespacedService({ namespace: namespace!, body });
    case 'configmaps': return clients.core.createNamespacedConfigMap({ namespace: namespace!, body });
    case 'secrets': return clients.core.createNamespacedSecret({ namespace: namespace!, body });
    case 'ingresses': return clients.networking.createNamespacedIngress({ namespace: namespace!, body });
    case 'statefulsets': return clients.apps.createNamespacedStatefulSet({ namespace: namespace!, body });
    case 'daemonsets': return clients.apps.createNamespacedDaemonSet({ namespace: namespace!, body });
    case 'jobs': return clients.batch.createNamespacedJob({ namespace: namespace!, body });
    default: throw new Error(`CREATE not supported for ${kind}`);
  }
}

export async function updateResource(clusterId: string, kind: ResourceKind, name: string, body: any, namespace?: string) {
  const clients = await getK8sClient(clusterId);
  switch (kind) {
    case 'deployments': return clients.apps.replaceNamespacedDeployment({ name, namespace: namespace!, body });
    case 'services': return clients.core.replaceNamespacedService({ name, namespace: namespace!, body });
    case 'configmaps': return clients.core.replaceNamespacedConfigMap({ name, namespace: namespace!, body });
    case 'secrets': return clients.core.replaceNamespacedSecret({ name, namespace: namespace!, body });
    case 'ingresses': return clients.networking.replaceNamespacedIngress({ name, namespace: namespace!, body });
    case 'statefulsets': return clients.apps.replaceNamespacedStatefulSet({ name, namespace: namespace!, body });
    case 'daemonsets': return clients.apps.replaceNamespacedDaemonSet({ name, namespace: namespace!, body });
    default: throw new Error(`UPDATE not supported for ${kind}`);
  }
}

/**
 * Apply resource: create if not exists, update if exists (like kubectl apply)
 */
export async function applyResource(clusterId: string, kind: ResourceKind, body: any, namespace?: string) {
  const name = body?.metadata?.name;
  if (!name) throw new Error('Resource must have metadata.name');

  try {
    // Try to get existing resource
    const existing = await getResource(clusterId, kind, name, namespace) as any;
    // Carry over resourceVersion for update (required by K8s API)
    if (existing?.metadata?.resourceVersion) {
      if (!body.metadata) body.metadata = {};
      body.metadata.resourceVersion = existing.metadata.resourceVersion;
    }
    return await updateResource(clusterId, kind, name, body, namespace);
  } catch (err: any) {
    // 404 = not found, create it
    const statusCode = err?.statusCode || err?.response?.statusCode || err?.code;
    if (statusCode === 404 || err?.message?.includes('not found')) {
      return await createResource(clusterId, kind, body, namespace);
    }
    throw err;
  }
}

export async function deleteResource(clusterId: string, kind: ResourceKind, name: string, namespace?: string) {
  const clients = await getK8sClient(clusterId);
  switch (kind) {
    case 'pods': return clients.core.deleteNamespacedPod({ name, namespace: namespace! });
    case 'deployments': return clients.apps.deleteNamespacedDeployment({ name, namespace: namespace! });
    case 'services': return clients.core.deleteNamespacedService({ name, namespace: namespace! });
    case 'configmaps': return clients.core.deleteNamespacedConfigMap({ name, namespace: namespace! });
    case 'secrets': return clients.core.deleteNamespacedSecret({ name, namespace: namespace! });
    case 'ingresses': return clients.networking.deleteNamespacedIngress({ name, namespace: namespace! });
    case 'statefulsets': return clients.apps.deleteNamespacedStatefulSet({ name, namespace: namespace! });
    case 'daemonsets': return clients.apps.deleteNamespacedDaemonSet({ name, namespace: namespace! });
    case 'jobs': return clients.batch.deleteNamespacedJob({ name, namespace: namespace! });
    case 'persistentvolumeclaims': return clients.core.deleteNamespacedPersistentVolumeClaim({ name, namespace: namespace! });
    case 'persistentvolumes': return clients.core.deletePersistentVolume({ name });
    default: throw new Error(`DELETE not supported for ${kind}`);
  }
}
