'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Card, Descriptions, Table, Tag, Button, Space, Typography, Breadcrumb, Spin, Alert } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useClusterStore } from '@/hooks/use-cluster';
import PodLogViewer from '@/components/pod-log-viewer';
import PodTerminal from '@/components/pod-terminal';

const { Title } = Typography;

const phaseColors: Record<string, string> = {
  Running: 'green',
  Pending: 'gold',
  Succeeded: 'blue',
  Failed: 'red',
  Unknown: 'default',
};

function getAge(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export default function DeploymentDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clusterId } = useClusterStore();

  const name = params.name as string;
  const namespace = searchParams.get('namespace') || 'default';

  const [deployment, setDeployment] = useState<any>(null);
  const [pods, setPods] = useState<any[]>([]);
  const [loadingDeployment, setLoadingDeployment] = useState(true);
  const [loadingPods, setLoadingPods] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [logState, setLogState] = useState<{ open: boolean; pod?: any }>({ open: false });
  const [termState, setTermState] = useState<{ open: boolean; pod?: any }>({ open: false });

  const fetchDeployment = async () => {
    if (!clusterId) return;
    setLoadingDeployment(true);
    setError(null);
    try {
      const res = await fetch(`/api/k8s/${clusterId}/namespaces/${namespace}/deployments/${name}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Failed to fetch deployment');
        return;
      }
      const data = await res.json();
      setDeployment(data);

      // Fetch pods filtered by label selector
      await fetchPods(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDeployment(false);
    }
  };

  const fetchPods = async (dep: any) => {
    if (!clusterId) return;
    setLoadingPods(true);
    try {
      const res = await fetch(`/api/k8s/${clusterId}/namespaces/${namespace}/pods`);
      if (!res.ok) return;
      const allPods: any[] = await res.json();

      // Filter by label selector
      const matchLabels: Record<string, string> = dep?.spec?.selector?.matchLabels || {};
      const filtered = allPods.filter((pod: any) => {
        const podLabels: Record<string, string> = pod.metadata?.labels || {};
        return Object.entries(matchLabels).every(([k, v]) => podLabels[k] === v);
      });
      setPods(filtered);
    } catch {
      // ignore pod fetch errors
    } finally {
      setLoadingPods(false);
    }
  };

  useEffect(() => {
    fetchDeployment();
  }, [clusterId, name, namespace]);

  const podContainers = (pod: any): string[] => {
    return (pod.spec?.containers || []).map((c: any) => c.name);
  };

  const podColumns = [
    {
      title: '名称',
      dataIndex: ['metadata', 'name'],
      key: 'name',
    },
    {
      title: '状态',
      key: 'phase',
      render: (_: any, r: any) => {
        const phase = r.status?.phase || 'Unknown';
        return <Tag color={phaseColors[phase] || 'default'}>{phase}</Tag>;
      },
    },
    {
      title: '重启次数',
      key: 'restarts',
      render: (_: any, r: any) => {
        const statuses = r.status?.containerStatuses || [];
        return statuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
      },
    },
    {
      title: 'Pod IP',
      dataIndex: ['status', 'podIP'],
      key: 'ip',
      render: (v: string) => v || '-',
    },
    {
      title: '节点',
      dataIndex: ['spec', 'nodeName'],
      key: 'node',
      render: (v: string) => v || '-',
    },
    {
      title: '创建时间',
      key: 'age',
      render: (_: any, r: any) => {
        const ts = r.metadata?.creationTimestamp;
        return ts ? getAge(ts) : '-';
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_: any, record: any) => (
        <Space>
          <Button
            size="small"
            type="link"
            onClick={() => setLogState({ open: true, pod: record })}
          >
            日志
          </Button>
          <Button
            size="small"
            type="link"
            onClick={() => setTermState({ open: true, pod: record })}
          >
            终端
          </Button>
        </Space>
      ),
    },
  ];

  if (loadingDeployment) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message={error}
        action={
          <Button size="small" onClick={() => router.back()}>返回</Button>
        }
      />
    );
  }

  const image = deployment?.spec?.template?.spec?.containers?.[0]?.image || '-';
  const readyReplicas = deployment?.status?.readyReplicas ?? 0;
  const desiredReplicas = deployment?.spec?.replicas ?? 0;
  const ready = readyReplicas === desiredReplicas && desiredReplicas > 0;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()} type="text" />
        <Breadcrumb
          items={[
            { title: 'Deployments', onClick: () => router.push('/resources/workloads/deployments'), href: '#' },
            { title: name },
          ]}
        />
      </div>

      <Title level={4} style={{ marginBottom: 16 }}>{name}</Title>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="名称">{deployment?.metadata?.name}</Descriptions.Item>
          <Descriptions.Item label="命名空间">{deployment?.metadata?.namespace}</Descriptions.Item>
          <Descriptions.Item label="镜像" span={2}>
            <Typography.Text code>{image}</Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="副本数">
            {readyReplicas} / {desiredReplicas}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={ready ? 'green' : 'orange'}>{ready ? 'Ready' : 'Updating'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {deployment?.metadata?.creationTimestamp
              ? new Date(deployment.metadata.creationTimestamp).toLocaleString()
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="标签选择器">
            {Object.entries(deployment?.spec?.selector?.matchLabels || {}).map(([k, v]) => (
              <Tag key={k}>{`${k}=${v}`}</Tag>
            ))}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={`Pods (${pods.length})`}
        extra={
          <Button size="small" onClick={fetchDeployment}>刷新</Button>
        }
      >
        <Table
          dataSource={pods}
          columns={podColumns}
          rowKey={(r) => r.metadata?.uid || r.metadata?.name}
          loading={loadingPods}
          pagination={false}
          size="small"
        />
      </Card>

      {logState.open && logState.pod && (
        <PodLogViewer
          open={logState.open}
          onClose={() => setLogState({ open: false })}
          clusterId={clusterId!}
          namespace={namespace}
          podName={logState.pod.metadata?.name}
          containers={podContainers(logState.pod)}
        />
      )}

      {termState.open && termState.pod && (
        <PodTerminal
          open={termState.open}
          onClose={() => setTermState({ open: false })}
          clusterId={clusterId!}
          namespace={namespace}
          podName={termState.pod.metadata?.name}
          containers={podContainers(termState.pod)}
        />
      )}
    </div>
  );
}
