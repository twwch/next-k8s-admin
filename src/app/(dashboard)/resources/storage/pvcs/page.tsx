'use client';

import { useState } from 'react';
import { Tag, Button, Space, App, Segmented } from 'antd';
import ResourceTable from '@/components/resource-table';
import NamespaceSelector from '@/components/namespace-selector';
import ResourceDrawer from '@/components/resource-drawer';
import DeleteConfirm from '@/components/delete-confirm';
import { useK8sResource } from '@/hooks/use-k8s-resource';
import { usePermissions } from '@/hooks/use-permissions';
import { useClusterStore } from '@/hooks/use-cluster';
import PageContainer from '@/components/page-container';
import { gradientBtnStyle } from '@/lib/styles';
import { isSystemResource } from '@/lib/k8s-helpers';
import { request } from '@/lib/request';

const pvcPhaseColors: Record<string, string> = {
  Bound: 'green', Pending: 'gold', Lost: 'red',
};

const pvPhaseColors: Record<string, string> = {
  Available: 'blue', Bound: 'green', Released: 'orange', Failed: 'red',
};

export default function PVCsPage() {
  const { message } = App.useApp();
  const [namespace, setNamespace] = useState<string | undefined>();
  const [tab, setTab] = useState<'persistentvolumeclaims' | 'persistentvolumes'>('persistentvolumeclaims');
  const { data: pvcs = [], loading: loadingPVCs, refresh: refreshPVCs } = useK8sResource('persistentvolumeclaims', namespace);
  const { data: pvs = [], loading: loadingPVs, refresh: refreshPVs } = useK8sResource('persistentvolumes');
  const permissions = usePermissions(tab);
  const { clusterId } = useClusterStore();
  const [drawerState, setDrawerState] = useState<{ open: boolean; mode: 'view' | 'edit' | 'create'; record?: any }>({ open: false, mode: 'view' });

  const isPVC = tab === 'persistentvolumeclaims';
  const kindLabel = isPVC ? 'PVC' : 'PV';

  const handleDelete = async (record: any) => {
    const name = record.metadata?.name;
    const ns = record.metadata?.namespace;
    if (!clusterId || !name) return;
    const url = isPVC
      ? `/api/k8s/${clusterId}/namespaces/${ns}/${tab}/${name}`
      : `/api/k8s/${clusterId}/${tab}/${name}`;
    const res = await request(url, { method: 'DELETE' });
    if (res.ok) {
      message.success(`${kindLabel} ${name} 已删除`);
      isPVC ? refreshPVCs() : refreshPVs();
    } else {
      const d = await res.json().catch(() => ({}));
      message.error(d.error || '删除失败');
    }
  };

  const handleNsChange = (v: string | undefined) => {
    setNamespace(v);
    setDrawerState(s => ({ ...s, open: false }));
  };

  const pvcColumns = [
    {
      title: '名称', dataIndex: ['metadata', 'name'], key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => setDrawerState({ open: true, mode: 'view', record })}>{text}</a>
      ),
    },
    { title: '命名空间', dataIndex: ['metadata', 'namespace'], key: 'namespace' },
    {
      title: '状态', key: 'status',
      render: (_: any, r: any) => {
        const phase = r.status?.phase || 'Unknown';
        return <Tag color={pvcPhaseColors[phase] || 'default'}>{phase}</Tag>;
      },
    },
    {
      title: '容量', key: 'capacity',
      render: (_: any, r: any) => r.status?.capacity?.storage || r.spec?.resources?.requests?.storage || '-',
    },
    {
      title: 'Volume', dataIndex: ['spec', 'volumeName'], key: 'volume',
      render: (v: string) => v || '-',
    },
    {
      title: 'StorageClass', dataIndex: ['spec', 'storageClassName'], key: 'storageClass',
      render: (v: string) => v || '-',
    },
    {
      title: '创建时间', dataIndex: ['metadata', 'creationTimestamp'], key: 'created',
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: '操作', key: 'actions', width: 150, fixed: 'right' as const,
      render: (_: any, record: any) => {
        const system = isSystemResource(record);
        return (
          <Space>
            {permissions.canUpdate && !system && (
              <Button size="small" type="link" onClick={() => setDrawerState({ open: true, mode: 'edit', record })}>编辑</Button>
            )}
            {permissions.canDelete && !system && (
              <DeleteConfirm name={record.metadata?.name} kindLabel="PVC" onConfirm={() => handleDelete(record)} />
            )}
          </Space>
        );
      },
    },
  ];

  const pvColumns = [
    {
      title: '名称', dataIndex: ['metadata', 'name'], key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => setDrawerState({ open: true, mode: 'view', record })}>{text}</a>
      ),
    },
    {
      title: '容量', key: 'capacity',
      render: (_: any, r: any) => r.spec?.capacity?.storage || '-',
    },
    {
      title: '访问模式', key: 'accessModes',
      render: (_: any, r: any) => (r.spec?.accessModes || []).join(', ') || '-',
    },
    {
      title: '回收策略', dataIndex: ['spec', 'persistentVolumeReclaimPolicy'], key: 'reclaimPolicy',
      render: (v: string) => v || '-',
    },
    {
      title: '状态', key: 'status',
      render: (_: any, r: any) => {
        const phase = r.status?.phase || 'Unknown';
        return <Tag color={pvPhaseColors[phase] || 'default'}>{phase}</Tag>;
      },
    },
    {
      title: 'Claim', key: 'claim',
      render: (_: any, r: any) => {
        const ref = r.spec?.claimRef;
        return ref ? `${ref.namespace}/${ref.name}` : '-';
      },
    },
    {
      title: 'StorageClass', dataIndex: ['spec', 'storageClassName'], key: 'storageClass',
      render: (v: string) => v || '-',
    },
    {
      title: '创建时间', dataIndex: ['metadata', 'creationTimestamp'], key: 'created',
      render: (t: string) => new Date(t).toLocaleString(),
    },
    {
      title: '操作', key: 'actions', width: 150, fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space>
          {permissions.canUpdate && (
            <Button size="small" type="link" onClick={() => setDrawerState({ open: true, mode: 'edit', record })}>编辑</Button>
          )}
          {permissions.canDelete && (
            <DeleteConfirm name={record.metadata?.name} kindLabel="PV" onConfirm={() => handleDelete(record)} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageContainer
        title="PV / PVC"
        extra={permissions.canCreate ? (
          <Button type="primary" onClick={() => setDrawerState({ open: true, mode: 'create' })} style={gradientBtnStyle}>
            + 创建
          </Button>
        ) : undefined}
        filters={
          <Space>
            <Segmented
              value={tab}
              onChange={(v) => setTab(v as typeof tab)}
              options={[
                { label: `PVC (${pvcs.length})`, value: 'persistentvolumeclaims' },
                { label: `PV (${pvs.length})`, value: 'persistentvolumes' },
              ]}
            />
            {isPVC && <NamespaceSelector value={namespace} onChange={handleNsChange} />}
          </Space>
        }
      >
        <ResourceTable
          data={isPVC ? pvcs : pvs}
          loading={isPVC ? loadingPVCs : loadingPVs}
          columns={isPVC ? pvcColumns : pvColumns}
        />
      </PageContainer>
      <ResourceDrawer
        open={drawerState.open}
        mode={drawerState.mode}
        kind={tab}
        kindLabel={kindLabel}
        record={drawerState.record}
        namespace={isPVC ? namespace : undefined}
        permissions={permissions}
        onClose={() => setDrawerState({ open: false, mode: 'view' })}
        onSuccess={() => { setDrawerState({ open: false, mode: 'view' }); isPVC ? refreshPVCs() : refreshPVs(); }}
      />
    </>
  );
}
