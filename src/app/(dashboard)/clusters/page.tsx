'use client';

import { Button, Table, Tag, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, ApiOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useRequest } from 'ahooks';

export default function ClustersPage() {
  const router = useRouter();

  const { data: clusters = [], loading, refresh } = useRequest(async () => {
    const res = await fetch('/api/clusters');
    return res.json();
  });

  const handleTest = async (id: string) => {
    const res = await fetch(`/api/clusters/${id}/test`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      message.success(`连接成功，版本: ${data.version}`);
    } else {
      message.error(`连接失败: ${data.error}`);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/clusters/${id}`, { method: 'DELETE' });
    message.success('已删除');
    refresh();
  };

  const statusColors: Record<string, string> = {
    connected: 'green',
    disconnected: 'default',
    error: 'red',
  };

  const columns = [
    { title: '名称', dataIndex: 'displayName', key: 'displayName' },
    { title: '标识', dataIndex: 'name', key: 'name' },
    { title: 'API Server', dataIndex: 'apiServerUrl', key: 'apiServerUrl', ellipsis: true },
    { title: '认证方式', dataIndex: 'authType', key: 'authType' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <Tag color={statusColors[status] || 'default'}>{status}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<ApiOutlined />} onClick={() => handleTest(record.id)}>测试连接</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>集群管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/clusters/new')}>
          添加集群
        </Button>
      </div>
      <Table columns={columns} dataSource={clusters} rowKey="id" loading={loading} />
    </div>
  );
}
