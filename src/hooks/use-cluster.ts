'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ClusterState {
  clusterId: string | null;
  clusterName: string | null;
  version: number;
  setCluster: (id: string, name: string) => void;
  refreshClusterList: () => void;
}

export const useClusterStore = create<ClusterState>()(
  persist(
    (set) => ({
      clusterId: null,
      clusterName: null,
      version: 0,
      setCluster: (id, name) => set({ clusterId: id, clusterName: name }),
      refreshClusterList: () => set((s) => ({ version: s.version + 1 })),
    }),
    { name: 'k8s-cluster' },
  ),
);
