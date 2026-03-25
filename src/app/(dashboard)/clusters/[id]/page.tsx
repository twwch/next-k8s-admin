'use client';

import { Card, Descriptions, Tag } from 'antd';
import { useRequest } from 'ahooks';
import { useParams } from 'next/navigation';

export default function ClusterDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: cluster, loading } = useRequest(async () => {
    const res = await fetch(`/api/clusters/${id}`);
    return res.json();
  });

  if (loading || !cluster) return <Card loading />;

  return (
    <Card title={cluster.displayName}>
      <Descriptions column={2}>
        <Descriptions.Item label="标识">{cluster.name}</Descriptions.Item>
        <Descriptions.Item label="API Server">{cluster.apiServerUrl}</Descriptions.Item>
        <Descriptions.Item label="认证方式">{cluster.authType}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={cluster.status === 'connected' ? 'green' : 'red'}>{cluster.status}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="描述">{cluster.description || '-'}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
