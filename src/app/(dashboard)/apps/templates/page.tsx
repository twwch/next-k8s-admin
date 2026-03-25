'use client';

import { Table, Button, Space, Popconfirm, message, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useRequest } from 'ahooks';

export default function TemplatesPage() {
  const router = useRouter();

  const { data: templates = [], loading, refresh } = useRequest(async () => {
    const res = await fetch('/api/apps/templates');
    return res.json();
  });

  const handleDelete = async (id: string) => {
    await fetch(`/api/apps/templates/${id}`, { method: 'DELETE' });
    message.success('已删除');
    refresh();
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (v: number) => <Tag color="blue">v{v}</Tag>,
    },
    { title: '描述', dataIndex: 'description', key: 'description', render: (v: string) => v || '-' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Popconfirm title="确认删除此模板?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>应用模板</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/apps/templates/new')}>
          创建模板
        </Button>
      </div>
      <Table columns={columns} dataSource={templates} rowKey="id" loading={loading} />
    </div>
  );
}
