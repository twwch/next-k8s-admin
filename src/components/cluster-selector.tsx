'use client';

import { Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useClusterStore } from '@/hooks/use-cluster';
import { useRequest } from 'ahooks';

const statusColors: Record<string, string> = {
  connected: '#4ade80',
  disconnected: '#94a3b8',
  error: '#f87171',
};

export default function ClusterSelector() {
  const { clusterId, clusterName, setCluster } = useClusterStore();

  const { data: clusters = [] } = useRequest(async () => {
    const res = await fetch('/api/clusters');
    if (!res.ok) return [];
    return res.json();
  });

  const currentCluster = clusters.find((c: any) => c.id === clusterId);
  const statusColor = statusColors[currentCluster?.status] || statusColors.disconnected;

  const items = clusters.map((c: any) => ({
    key: c.id,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: statusColors[c.status] || statusColors.disconnected,
          flexShrink: 0,
        }} />
        <span>{c.displayName || c.name}</span>
      </div>
    ),
    onClick: () => setCluster(c.id, c.displayName || c.name),
  }));

  return (
    <Dropdown menu={{ items, selectedKeys: clusterId ? [clusterId] : [] }} trigger={['click']}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'linear-gradient(135deg, #326CE5, #1a4bc7)',
        borderRadius: 20,
        padding: '5px 14px',
        cursor: 'pointer',
        userSelect: 'none',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: statusColor,
          flexShrink: 0,
        }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'white' }}>
          {clusterName || '选择集群'}
        </span>
        <DownOutlined style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }} />
      </div>
    </Dropdown>
  );
}
