'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Button, Checkbox, Select, Switch, Table, Space, App, Breadcrumb } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useRequest } from 'ahooks';
import { gradientBtnStyle } from '@/lib/styles';
import { request } from '@/lib/request';

const RESOURCES = ['deployments', 'statefulsets', 'daemonsets', 'jobs', 'pods', 'services', 'ingresses', 'configmaps', 'secrets', 'persistentvolumeclaims', 'storageclasses', 'namespaces', 'nodes'];
const BASE_ACTIONS = ['get', 'list', 'create', 'update', 'delete'];
const EXTRA_ACTIONS: Record<string, string[]> = { pods: ['exec', 'logs'] };
const ALL_ACTIONS = [...BASE_ACTIONS, 'exec', 'logs'];

function getActionsForResource(resource: string): string[] {
  return [...BASE_ACTIONS, ...(EXTRA_ACTIONS[resource] || [])];
}

interface ClusterBinding {
  clusterId: string;
  namespaces: string[];
}

interface RoleEditorProps {
  roleId?: string; // 编辑时传入
}

export default function RoleEditor({ roleId }: RoleEditorProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm();
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [allClusters, setAllClusters] = useState(true);
  const [clusterBindings, setClusterBindings] = useState<ClusterBinding[]>([]);
  const [nsCache, setNsCache] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!roleId); // 新建时直接可用

  const isEdit = !!roleId;

  const { data: clusterList = [] } = useRequest(async () => {
    const res = await request('/api/clusters');
    if (!res.ok) return [];
    return res.json();
  });

  // Load role data when editing
  useEffect(() => {
    if (!roleId) return;
    (async () => {
      const res = await request(`/api/admin/roles/${roleId}`);
      if (!res.ok) { message.error('加载角色失败'); router.push('/admin/roles'); return; }
      const role = await res.json();
      form.setFieldsValue({ name: role.name, displayName: role.displayName, description: role.description });
      const permMap: Record<string, string[]> = {};
      for (const p of role.permissions || []) permMap[p.resource] = p.actions;
      setPermissions(permMap);
      const cbs = role.clusterBindings || [];
      if (cbs.length === 0) {
        setAllClusters(true);
      } else {
        setAllClusters(false);
        setClusterBindings(cbs.map((cb: any) => ({ clusterId: cb.clusterId, namespaces: cb.namespaces || [] })));
        for (const cb of cbs) { if (cb.clusterId) fetchNamespaces(cb.clusterId); }
      }
      setLoaded(true);
    })();
  }, [roleId]);

  const fetchNamespaces = async (clusterId: string) => {
    try {
      const res = await request(`/api/k8s/${clusterId}/namespaces`);
      if (!res.ok) return;
      const list = await res.json();
      const names = list.map((ns: any) => ns.metadata?.name).filter(Boolean);
      setNsCache(prev => ({ ...prev, [clusterId]: names }));
    } catch { /* ignore */ }
  };

  const toggleAction = (resource: string, action: string) => {
    setPermissions(prev => {
      const current = prev[resource] || [];
      const updated = current.includes(action) ? current.filter(a => a !== action) : [...current, action];
      return { ...prev, [resource]: updated };
    });
  };

  const toggleAllForResource = (resource: string) => {
    const available = getActionsForResource(resource);
    setPermissions(prev => {
      const current = prev[resource] || [];
      return { ...prev, [resource]: current.length === available.length ? [] : [...available] };
    });
  };

  const handleClusterSelect = (clusterIds: string[]) => {
    setClusterBindings(prev => {
      const existing = new Map(prev.map(cb => [cb.clusterId, cb]));
      return clusterIds.map(id => existing.get(id) || { clusterId: id, namespaces: [] });
    });
    for (const id of clusterIds) fetchNamespaces(id);
  };

  const handleSave = async () => {
    try { await form.validateFields(); } catch { return; }
    const values = form.getFieldsValue();
    const permList = Object.entries(permissions)
      .filter(([, actions]) => actions.length > 0)
      .map(([resource, actions]) => ({ resource, actions }));
    const cbList = allClusters ? [] : clusterBindings.map(cb => ({
      clusterId: cb.clusterId,
      namespaces: cb.namespaces.length > 0 ? cb.namespaces : null,
    }));

    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/roles/${roleId}` : '/api/admin/roles';
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit
        ? { displayName: values.displayName, description: values.description, permissions: permList, clusterBindings: cbList }
        : { ...values, permissions: permList, clusterBindings: cbList };

      const res = await request(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        message.success(isEdit ? '角色更新成功' : '角色创建成功');
        router.push('/admin/roles');
      } else {
        const data = await res.json();
        message.error(data.error || '操作失败');
      }
    } finally { setSaving(false); }
  };

  const permColumns = [
    {
      title: '资源', dataIndex: 'resource', key: 'resource', width: 200,
      render: (v: string) => {
        const available = getActionsForResource(v);
        const current = permissions[v] || [];
        return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox
            checked={current.length === available.length}
            indeterminate={current.length > 0 && current.length < available.length}
            onChange={() => toggleAllForResource(v)}
          />
          <span style={{ fontWeight: 500, fontSize: 13 }}>{v}</span>
        </div>
      );
      },
    },
    ...ALL_ACTIONS.map(action => ({
      title: action, key: action, width: 80, align: 'center' as const,
      render: (_: any, record: { resource: string }) => {
        const available = getActionsForResource(record.resource);
        if (!available.includes(action)) return <span style={{ color: '#d9d9d9' }}>—</span>;
        return (
          <Checkbox
            checked={(permissions[record.resource] || []).includes(action)}
            onChange={() => toggleAction(record.resource, action)}
          />
        );
      },
    })),
  ];

  if (!loaded) return null;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => router.push('/admin/roles')} />
          <Breadcrumb items={[
            { title: <a onClick={() => router.push('/admin/roles')}>角色管理</a> },
            { title: isEdit ? '编辑角色' : '创建角色' },
          ]} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
            {isEdit ? '编辑角色' : '创建角色'}
          </h2>
          <Space>
            <Button onClick={() => router.push('/admin/roles')}>取消</Button>
            <Button type="primary" loading={saving} onClick={handleSave} style={gradientBtnStyle}>保存</Button>
          </Space>
        </div>
      </div>

      {/* Split Layout */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Left: Basic + Cluster */}
        <div style={{ width: 320, flexShrink: 0 }}>
          {/* 基本信息 */}
          <div style={{
            background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            padding: '20px 20px 12px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>基本信息</div>
            <Form form={form} layout="vertical">
              <Form.Item name="name" label="角色标识" rules={[{ required: true }]}>
                <Input placeholder="如: staging-developer" disabled={isEdit} />
              </Form.Item>
              <Form.Item name="displayName" label="显示名称" rules={[{ required: true }]}>
                <Input placeholder="如: 测试环境开发者" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={2} placeholder="角色用途说明" />
              </Form.Item>
            </Form>
          </div>

          {/* 集群范围 */}
          <div style={{
            background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            padding: 20,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>集群范围</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Switch checked={allClusters} onChange={setAllClusters} size="small" />
              <span style={{ fontSize: 13, color: allClusters ? '#10b981' : '#64748b' }}>
                {allClusters ? '所有集群' : '指定集群'}
              </span>
            </div>
            {!allClusters && (
              <>
                <Select
                  mode="multiple"
                  placeholder="选择集群"
                  style={{ width: '100%', marginBottom: 12 }}
                  value={clusterBindings.map(cb => cb.clusterId)}
                  onChange={handleClusterSelect}
                  options={clusterList.map((c: any) => ({ value: c.id, label: c.displayName || c.name }))}
                />
                {clusterBindings.map(cb => {
                  const cluster = clusterList.find((c: any) => c.id === cb.clusterId);
                  const namespaces = nsCache[cb.clusterId] || [];
                  return (
                    <div key={cb.clusterId} style={{
                      marginBottom: 8, padding: '10px 12px',
                      background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#334155', marginBottom: 6 }}>
                        {cluster?.displayName || cluster?.name} — 命名空间
                      </div>
                      <Select
                        mode="multiple"
                        placeholder="所有命名空间"
                        style={{ width: '100%' }}
                        value={cb.namespaces}
                        onChange={(v) => setClusterBindings(prev => prev.map(b => b.clusterId === cb.clusterId ? { ...b, namespaces: v } : b))}
                        options={namespaces.map(ns => ({ value: ns, label: ns }))}
                        loading={!nsCache[cb.clusterId]}
                      />
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>不选 = 所有命名空间</div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Right: Permissions */}
        <div style={{
          flex: 1, background: '#fff', borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 20,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>资源权限</div>
          <Table
            columns={permColumns}
            dataSource={RESOURCES.map(r => ({ key: r, resource: r }))}
            pagination={false}
            size="middle"
            bordered
          />
        </div>
      </div>
    </div>
  );
}
