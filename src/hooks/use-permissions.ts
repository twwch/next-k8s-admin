'use client';

import { useRequest } from 'ahooks';
import { useClusterStore } from './use-cluster';

const DEFAULT = { canCreate: false, canUpdate: false, canDelete: false };

export function usePermissions(resource: string) {
  const { clusterId } = useClusterStore();

  const { data } = useRequest(async () => {
    if (!clusterId) return DEFAULT;
    const res = await fetch(`/api/rbac/check?clusterId=${clusterId}&resource=${resource}`);
    if (!res.ok) return DEFAULT;
    return res.json();
  }, { refreshDeps: [clusterId] });

  return data || DEFAULT;
}
