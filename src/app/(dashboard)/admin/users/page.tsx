'use client';

import { useState } from 'react';
import {
  Table, Button, Tag, Space, Popconfirm, Modal, Form, Input, Select, App,
} from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, KeyOutlined } from '@ant-design/icons';
import { useRequest } from 'ahooks';
import PageContainer from '@/components/page-container';
import { gradientBtnStyle } from '@/lib/styles';
import { request } from '@/lib/request';

export default function UsersPage() {
  const { message } = App.useApp();
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [resetPwdUser, setResetPwdUser] = useState<any>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetPwdForm] = Form.useForm();

  const { data: users = [], loading, refresh } = useRequest(async () => {
    const res = await request('/api/admin/users');
    return res.json();
  });

  const { data: roles = [] } = useRequest(async () => {
    const res = await request('/api/admin/roles');
    return res.json();
  });

  const handleAdd = async (values: any) => {
    const { roleId, ...rest } = values;
    const roleBindings = roleId ? [{ roleId }] : [];

    const res = await request('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rest, roleBindings }),
    });
    if (res.ok) {
      message.success('用户创建成功');
      setAddOpen(false);
      addForm.resetFields();
      refresh();
    } else {
      const data = await res.json();
      message.error(data.error || '创建失败');
    }
  };

  const handleEdit = async (values: any) => {
    const res = await request(`/api/admin/users/${editUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, username: editUser.username }),
    });
    if (res.ok) {
      message.success('更新成功');
      setEditUser(null);
      refresh();
    } else {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await request(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      message.error(data?.error || '删除失败');
      return;
    }
    message.success('已删除');
    refresh();
  };

  const handleResetPassword = async (values: { newPassword: string }) => {
    const res = await request(`/api/admin/users/${resetPwdUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset-password', newPassword: values.newPassword }),
    });
    if (res.ok) {
      message.success('密码已重置，用户下次登录需修改密码');
      setResetPwdUser(null);
      resetPwdForm.resetFields();
    } else {
      const data = await res.json().catch(() => null);
      message.error(data?.error || '重置失败');
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色', key: 'role',
      render: (_: any, record: any) => {
        const roleId = record.roleBindings?.[0]?.roleId;
        const role = roles.find((r: any) => r.id === roleId);
        return role ? <Tag color="blue">{role.displayName}</Tag> : <Tag>无</Tag>;
      },
    },
    {
      title: '状态', dataIndex: 'isActive', key: 'isActive',
      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '最后登录', dataIndex: 'lastLoginAt', key: 'lastLoginAt',
      render: (t: string) => t ? new Date(t).toLocaleString() : '-',
    },
    {
      title: '创建时间', dataIndex: 'createdAt', key: 'createdAt',
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: '操作', key: 'actions', fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />}
            onClick={() => {
              setEditUser(record);
              editForm.setFieldsValue({
                email: record.email,
                isActive: record.isActive,
                roleId: record.roleBindings?.[0]?.roleId,
              });
            }}
          >编辑</Button>
          {record.username !== 'admin' && (
            <Button size="small" icon={<KeyOutlined />}
              onClick={() => { setResetPwdUser(record); resetPwdForm.resetFields(); }}
            >重置密码</Button>
          )}
          {record.username !== 'admin' && (
            <Popconfirm title="确认删除此用户?" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageContainer
        title="用户管理"
        description="管理系统用户和权限分配"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)} style={gradientBtnStyle}>
            添加用户
          </Button>
        }
      >
        <Table columns={columns} dataSource={users} rowKey="id" loading={loading} size="middle" scroll={{ x: 'max-content' }} />
      </PageContainer>

      <Modal title="添加用户" open={addOpen}
        onCancel={() => { setAddOpen(false); addForm.resetFields(); }}
        onOk={() => addForm.submit()} destroyOnHidden>
        <Form form={addForm} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
          <Form.Item name="roleId" label="角色">
            <Select placeholder="选择角色" allowClear
              options={roles.map((r: any) => ({ value: r.id, label: r.displayName }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="编辑用户" open={!!editUser}
        onCancel={() => setEditUser(null)}
        onOk={() => editForm.submit()} destroyOnHidden>
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="roleId" label="角色">
            <Select placeholder="选择角色" allowClear
              options={roles.map((r: any) => ({ value: r.id, label: r.displayName }))} />
          </Form.Item>
          <Form.Item name="isActive" label="状态">
            <Select options={[{ value: true, label: '启用' }, { value: false, label: '禁用' }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`重置密码 - ${resetPwdUser?.username}`} open={!!resetPwdUser}
        onCancel={() => { setResetPwdUser(null); resetPwdForm.resetFields(); }}
        onOk={() => resetPwdForm.submit()} destroyOnHidden>
        <Form form={resetPwdForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item name="newPassword" label="新密码" rules={[{ required: true, min: 8, message: '密码至少 8 位' }]}>
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认密码" dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('newPassword') === value ? Promise.resolve() : Promise.reject(new Error('两次密码不一致')); } }),
            ]}>
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>重置后用户下次登录将被要求修改密码</div>
        </Form>
      </Modal>
    </>
  );
}
