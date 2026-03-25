'use client';

import { Table, Button, Tag, Space, Popconfirm, message } from 'antd';
import { PlusOutlined, RollbackOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useRequest } from 'ahooks';

const statusColors: Record<string, string> = {
  applied: 'green',
  pending: 'gold',
  failed: 'red',
  rolled_back: 'default',
};

export default function ReleasesPage() {
  const router = useRouter();

  const { data: releases = [], loading, refresh } = useRequest(async () => {
    const res = await fetch('/api/apps/releases');
    return res.json();
  });

  const handleRollback = async (id: string) => {
    const res = await fetch(`/api/apps/releases/${id}/rollback`, { method: 'POST' });
    if (res.ok) {
      message.success('回滚成功');
      refresh();
    } else {
      const data = await res.json();
      message.error(data.error || '回滚失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '命名空间', dataIndex: 'namespace', key: 'namespace' },
    {
      title: '版本',
      dataIndex: 'revision',
      key: 'revision',
      render: (v: number) => <Tag color="blue">r{v}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
    },
    {
      title: '发布时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          {record.status === 'applied' && (
            <Popconfirm title="确认回滚到此版本?" onConfirm={() => handleRollback(record.id)}>
              <Button size="small" icon={<RollbackOutlined />}>回滚</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>发布记录</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/apps/releases/new')}>
          新建发布
        </Button>
      </div>
      <Table columns={columns} dataSource={releases} rowKey="id" loading={loading} />
    </div>
  );
}
