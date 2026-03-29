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

export default function JobsPage() {
  const { message } = App.useApp();
  const [namespace, setNamespace] = useState<string | undefined>();
  const [tab, setTab] = useState<'jobs' | 'cronjobs'>('jobs');
  const { data: jobs = [], loading: loadingJobs, refresh: refreshJobs } = useK8sResource('jobs', namespace);
  const { data: cronJobs = [], loading: loadingCronJobs, refresh: refreshCronJobs } = useK8sResource('cronjobs', namespace);
  const permissions = usePermissions(tab);
  const { clusterId } = useClusterStore();
  const [drawerState, setDrawerState] = useState<{ open: boolean; mode: 'view' | 'edit' | 'create'; record?: any }>({ open: false, mode: 'view' });

  const handleDelete = async (record: any) => {
    const name = record.metadata?.name;
    const ns = record.metadata?.namespace;
    if (!clusterId || !name || !ns) return;
    const res = await request(`/api/k8s/${clusterId}/namespaces/${ns}/${tab}/${name}`, { method: 'DELETE' });
    if (res.ok) {
      message.success(`${tab === 'jobs' ? 'Job' : 'CronJob'} ${name} 已删除`);
      tab === 'jobs' ? refreshJobs() : refreshCronJobs();
    } else {
      const d = await res.json().catch(() => ({}));
      message.error(d.error || '删除失败');
    }
  };

  const handleNsChange = (v: string | undefined) => {
    setNamespace(v);
    setDrawerState(s => ({ ...s, open: false }));
  };

  const jobColumns = [
    {
      title: '名称', dataIndex: ['metadata', 'name'], key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => setDrawerState({ open: true, mode: 'view', record })}>{text}</a>
      ),
    },
    { title: '命名空间', dataIndex: ['metadata', 'namespace'], key: 'namespace' },
    {
      title: '完成数', key: 'completions',
      render: (_: any, r: any) => `${r.status?.succeeded || 0}/${r.spec?.completions || 1}`,
    },
    {
      title: '状态', key: 'status',
      render: (_: any, r: any) => {
        if (r.status?.succeeded) return <Tag color="green">Complete</Tag>;
        if (r.status?.failed) return <Tag color="red">Failed</Tag>;
        if (r.status?.active) return <Tag color="blue">Running</Tag>;
        return <Tag>Pending</Tag>;
      },
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
              <DeleteConfirm name={record.metadata?.name} kindLabel="Job" onConfirm={() => handleDelete(record)} />
            )}
          </Space>
        );
      },
    },
  ];

  const cronJobColumns = [
    {
      title: '名称', dataIndex: ['metadata', 'name'], key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => setDrawerState({ open: true, mode: 'view', record })}>{text}</a>
      ),
    },
    { title: '命名空间', dataIndex: ['metadata', 'namespace'], key: 'namespace' },
    {
      title: 'Schedule', dataIndex: ['spec', 'schedule'], key: 'schedule',
      render: (v: string) => <code>{v}</code>,
    },
    {
      title: '暂停', key: 'suspend',
      render: (_: any, r: any) => r.spec?.suspend ? <Tag color="orange">已暂停</Tag> : <Tag color="green">活跃</Tag>,
    },
    {
      title: '最近调度', key: 'lastSchedule',
      render: (_: any, r: any) => {
        const t = r.status?.lastScheduleTime;
        return t ? new Date(t).toLocaleString() : '-';
      },
    },
    {
      title: '活跃 Jobs', key: 'active',
      render: (_: any, r: any) => r.status?.active?.length || 0,
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
              <DeleteConfirm name={record.metadata?.name} kindLabel="CronJob" onConfirm={() => handleDelete(record)} />
            )}
          </Space>
        );
      },
    },
  ];

  const isJobsTab = tab === 'jobs';
  const kindLabel = isJobsTab ? 'Job' : 'CronJob';

  return (
    <>
      <PageContainer
        title="Jobs / CronJobs"
        extra={permissions.canCreate ? (
          <Button type="primary" onClick={() => setDrawerState({ open: true, mode: 'create' })} style={gradientBtnStyle}>
            + 创建
          </Button>
        ) : undefined}
        filters={
          <Space>
            <Segmented
              value={tab}
              onChange={(v) => setTab(v as 'jobs' | 'cronjobs')}
              options={[
                { label: `Jobs (${jobs.length})`, value: 'jobs' },
                { label: `CronJobs (${cronJobs.length})`, value: 'cronjobs' },
              ]}
            />
            <NamespaceSelector value={namespace} onChange={handleNsChange} />
          </Space>
        }
      >
        <ResourceTable
          data={isJobsTab ? jobs : cronJobs}
          loading={isJobsTab ? loadingJobs : loadingCronJobs}
          columns={isJobsTab ? jobColumns : cronJobColumns}
        />
      </PageContainer>
      <ResourceDrawer
        open={drawerState.open}
        mode={drawerState.mode}
        kind={tab}
        kindLabel={kindLabel}
        record={drawerState.record}
        namespace={namespace}
        permissions={permissions}
        onClose={() => setDrawerState({ open: false, mode: 'view' })}
        onSuccess={() => { setDrawerState({ open: false, mode: 'view' }); isJobsTab ? refreshJobs() : refreshCronJobs(); }}
      />
    </>
  );
}
