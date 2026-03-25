# Resource CRUD Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app-templates publishing module with direct CRUD on every resource page, using Drawer UI, RBAC permissions, and automatic release history logging.

**Architecture:** Add reusable components (ResourceDrawer, DeleteConfirm, usePermissions), wire them into all 13 resource pages, modify the K8s proxy API to auto-log releases, and clean up the old templates module.

**Tech Stack:** Next.js 15, Ant Design 5 (Drawer/Modal), ahooks, yaml, Drizzle ORM, existing K8s proxy + RBAC infra.

**Spec:** `docs/superpowers/specs/2026-03-25-resource-crud-redesign.md`

---

## File Structure

```
src/
├── lib/
│   ├── db/schema.ts                          # MODIFY: appReleases nullable fields
│   └── release-logger.ts                     # CREATE: auto release log writer
├── hooks/
│   └── use-permissions.ts                    # CREATE: RBAC permission hook
├── components/
│   ├── resource-drawer.tsx                   # CREATE: view/edit/create Drawer
│   ├── delete-confirm.tsx                    # CREATE: 2-step delete confirmation
│   ├── resource-templates.ts                 # CREATE: preset YAML templates
│   └── yaml-editor.tsx                       # EXISTS: no changes needed
├── app/
│   ├── api/
│   │   ├── rbac/check/route.ts              # CREATE: RBAC check endpoint
│   │   ├── k8s/[clusterId]/[...resource]/route.ts  # MODIFY: add release logging
│   │   └── apps/
│   │       ├── releases/route.ts            # MODIFY: remove POST, keep GET
│   │       ├── releases/[id]/route.ts       # EXISTS: keep as-is
│   │       ├── releases/[id]/rollback/      # DELETE
│   │       ├── releases/new/                # DELETE
│   │       └── templates/                   # DELETE (entire dir)
│   └── (dashboard)/
│       ├── layout.tsx                       # MODIFY: sidebar menu
│       ├── apps/
│       │   ├── releases/page.tsx            # MODIFY: remove new-release button
│       │   ├── releases/new/                # DELETE
│       │   └── templates/                   # DELETE (entire dir)
│       └── resources/                       # MODIFY: all 13 pages get CRUD
│           ├── workloads/deployments/page.tsx
│           ├── workloads/statefulsets/page.tsx
│           ├── workloads/daemonsets/page.tsx
│           ├── workloads/jobs/page.tsx
│           ├── workloads/pods/page.tsx
│           ├── networking/services/page.tsx
│           ├── networking/ingresses/page.tsx
│           ├── config/configmaps/page.tsx
│           ├── config/secrets/page.tsx
│           ├── storage/pvcs/page.tsx
│           ├── storage/storageclasses/page.tsx
│           └── namespaces/page.tsx
```

---

## Task 1: DB Schema Change + Release Logger

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/release-logger.ts`

- [ ] **Step 1: Make appTemplateId and namespace nullable in schema**

In `src/lib/db/schema.ts`, change the `appReleases` table:

```typescript
// Change from:
appTemplateId: uuid('app_template_id').notNull().references(() => appTemplates.id),
namespace: varchar('namespace', { length: 255 }).notNull(),
// To:
appTemplateId: uuid('app_template_id').references(() => appTemplates.id),
namespace: varchar('namespace', { length: 255 }),
```

- [ ] **Step 2: Push schema migration**

```bash
npx drizzle-kit push
```

- [ ] **Step 3: Create release-logger.ts**

```typescript
// src/lib/release-logger.ts
import { db } from '@/lib/db';
import { appReleases } from '@/lib/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

const KIND_LABELS: Record<string, string> = {
  deployments: 'Deployment', statefulsets: 'StatefulSet', daemonsets: 'DaemonSet',
  services: 'Service', configmaps: 'ConfigMap', secrets: 'Secret',
  ingresses: 'Ingress', jobs: 'Job', cronjobs: 'CronJob', pods: 'Pod',
  persistentvolumeclaims: 'PVC', storageclasses: 'StorageClass', namespaces: 'Namespace',
};

interface ReleaseLogEntry {
  action: 'create' | 'update' | 'delete';
  kind: string;
  resourceName: string;
  clusterId: string;
  namespace: string | null;
  userId: string;
  requestBody?: any;
}

export async function writeReleaseLog(entry: ReleaseLogEntry) {
  try {
    const kindLabel = KIND_LABELS[entry.kind] || entry.kind;
    const actionLabel = entry.action === 'create' ? '创建' : entry.action === 'update' ? '更新' : '删除';
    const message = `${actionLabel} ${kindLabel} ${entry.resourceName}`;

    // Compute next revision
    const nsCondition = entry.namespace
      ? eq(appReleases.namespace, entry.namespace)
      : isNull(appReleases.namespace);

    const [latest] = await db.select({ revision: appReleases.revision })
      .from(appReleases)
      .where(and(
        eq(appReleases.name, entry.resourceName),
        eq(appReleases.clusterId, entry.clusterId),
        nsCondition,
      ))
      .orderBy(desc(appReleases.revision))
      .limit(1);

    const revision = (latest?.revision ?? 0) + 1;

    await db.insert(appReleases).values({
      appTemplateId: null,
      clusterId: entry.clusterId,
      namespace: entry.namespace,
      name: entry.resourceName,
      values: null,
      renderedManifests: entry.action === 'delete' ? null : entry.requestBody,
      status: 'applied',
      revision,
      message,
      releasedBy: entry.userId,
    });
  } catch (err) {
    console.error('Failed to write release log:', err);
    // Don't throw — release logging should never break the main operation
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/release-logger.ts
git commit -m "feat: add release logger and make appReleases fields nullable"
```

---

## Task 2: RBAC Check API + usePermissions Hook

**Files:**
- Create: `src/app/api/rbac/check/route.ts`
- Create: `src/hooks/use-permissions.ts`

- [ ] **Step 1: Create RBAC check API**

```typescript
// src/app/api/rbac/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth/session';
import { getUserBindings, checkPermission } from '@/lib/rbac/check';

export async function GET(req: NextRequest) {
  const auth = await validateSession();
  if (!auth) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const clusterId = searchParams.get('clusterId');
  const resource = searchParams.get('resource');

  if (!clusterId || !resource) {
    return NextResponse.json({ canCreate: false, canUpdate: false, canDelete: false });
  }

  const bindings = await getUserBindings(auth.user.id);

  return NextResponse.json({
    canCreate: checkPermission(bindings, { clusterId, namespace: '*', resource, action: 'create' }),
    canUpdate: checkPermission(bindings, { clusterId, namespace: '*', resource, action: 'update' }),
    canDelete: checkPermission(bindings, { clusterId, namespace: '*', resource, action: 'delete' }),
  });
}
```

- [ ] **Step 2: Create usePermissions hook**

```typescript
// src/hooks/use-permissions.ts
'use client';

import { useRequest } from 'ahooks';
import { useClusterStore } from './use-cluster';

const DEFAULT = { canCreate: false, canUpdate: false, canDelete: false };

export function usePermissions(resource: string) {
  const { clusterId } = useClusterStore();

  const { data } = useRequest(async () => {
    if (!clusterId) return DEFAULT;
    const res = await fetch(`/api/rbac/check?clusterId=${clusterId}&resource=${resource}`);
    if (!res.ok) return DEFAULT;
    return res.json();
  }, { refreshDeps: [clusterId] });

  return data || DEFAULT;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/rbac/ src/hooks/use-permissions.ts
git commit -m "feat: add RBAC check API and usePermissions hook"
```

---

## Task 3: Reusable Components (ResourceDrawer, DeleteConfirm, Templates)

**Files:**
- Create: `src/components/resource-drawer.tsx`
- Create: `src/components/delete-confirm.tsx`
- Create: `src/components/resource-templates.ts`

- [ ] **Step 1: Create resource-templates.ts**

Export all preset YAML templates from the spec, keyed by resource kind. Each entry has `{ label: string, yaml: string }[]`. Copy all 12 YAML templates from the spec verbatim. Structure:

```typescript
// src/components/resource-templates.ts
export const RESOURCE_TEMPLATES: Record<string, { label: string; yaml: string }[]> = {
  deployments: [
    { label: 'Deployment 基础', yaml: `apiVersion: apps/v1\nkind: Deployment\n...` },
    { label: 'Deployment + Service', yaml: `apiVersion: apps/v1\n...\n---\napiVersion: v1\n...` },
  ],
  statefulsets: [ { label: 'StatefulSet', yaml: `...` } ],
  daemonsets: [ { label: 'DaemonSet', yaml: `...` } ],
  jobs: [ { label: 'CronJob', yaml: `...` } ],
  services: [ { label: 'Service', yaml: `...` } ],
  configmaps: [ { label: 'ConfigMap', yaml: `...` } ],
  secrets: [ { label: 'Secret', yaml: `...` } ],
  ingresses: [ { label: 'Ingress', yaml: `...` } ],
  persistentvolumeclaims: [ { label: 'PVC', yaml: `...` } ],
  storageclasses: [ { label: 'StorageClass', yaml: `...` } ],
  namespaces: [ { label: 'Namespace', yaml: `...` } ],
};
```

Fill in every YAML from the spec exactly.

- [ ] **Step 2: Create delete-confirm.tsx**

Two-step delete: Popconfirm → Modal with name input.

```tsx
// src/components/delete-confirm.tsx
'use client';

import { useState } from 'react';
import { Button, Popconfirm, Modal, Input, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  name: string;
  kindLabel: string;
  onConfirm: () => Promise<void>;
}

export default function DeleteConfirm({ name, kindLabel, onConfirm }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setModalOpen(false);
    } finally {
      setLoading(false);
      setInputValue('');
    }
  };

  return (
    <>
      <Popconfirm title="确认要删除此资源？" onConfirm={() => setModalOpen(true)}>
        <Button size="small" type="link" danger icon={<DeleteOutlined />}>删除</Button>
      </Popconfirm>
      <Modal
        title={`删除 ${kindLabel}`}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setInputValue(''); }}
        onOk={handleDelete}
        okText="确认删除"
        okType="danger"
        okButtonProps={{ disabled: inputValue !== name }}
        confirmLoading={loading}
        destroyOnHidden
      >
        <div style={{ marginBottom: 16 }}>
          <Text>请输入资源名称以确认删除：</Text>
        </div>
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={name}
        />
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">输入 <Text strong code>{name}</Text> 以确认</Text>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Create resource-drawer.tsx**

Drawer component with 3 modes: view, edit, create. Uses YamlEditor. Handles multi-document YAML for create. Handles 409 conflict on edit save.

The component accepts these props:

```typescript
interface ResourceDrawerProps {
  open: boolean;
  mode: 'view' | 'edit' | 'create';
  kind: string;
  kindLabel: string;
  record?: any;              // K8s resource object (view/edit modes)
  namespace?: string;        // fallback namespace for create
  permissions: { canUpdate: boolean };
  onClose: () => void;
  onSuccess: () => void;     // refresh list after create/edit
}
```

Key behaviors:
- **View mode**: Display full resource as YAML (read-only), show "编辑" button if `permissions.canUpdate`
- **Edit mode**: Strip cleanup fields from resource, display in editable YAML editor. On save: `yaml.parse()` → PUT to `/api/k8s/{clusterId}/namespaces/{ns}/{kind}/{name}`. Handle 409 with conflict message.
- **Create mode**: Show template buttons from `RESOURCE_TEMPLATES[kind]` + "空白" option. On submit: `yaml.parseAllDocuments()` to split multi-doc, then sequential POST for each. Report partial failures.
- Namespace resolution: YAML `metadata.namespace` > prop `namespace` > 'default'

Field cleanup list for edit mode:
```typescript
function cleanForEdit(obj: any): any {
  const clean = JSON.parse(JSON.stringify(obj));
  delete clean.status;
  if (clean.metadata) {
    delete clean.metadata.managedFields;
    delete clean.metadata.uid;
    delete clean.metadata.generation;
    delete clean.metadata.creationTimestamp;
    delete clean.metadata.selfLink;
    if (clean.metadata.annotations) {
      delete clean.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration'];
      delete clean.metadata.annotations['deployment.kubernetes.io/revision'];
      if (Object.keys(clean.metadata.annotations).length === 0) delete clean.metadata.annotations;
    }
  }
  return clean;
}
```

Width: 700px. Uses existing `YamlEditor` component for the code editor.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/resource-drawer.tsx src/components/delete-confirm.tsx src/components/resource-templates.ts
git commit -m "feat: add ResourceDrawer, DeleteConfirm, and preset YAML templates"
```

---

## Task 4: Wire Release Logger into K8s Proxy API

**Files:**
- Modify: `src/app/api/k8s/[clusterId]/[...resource]/route.ts`

- [ ] **Step 1: Add release logging to POST/PUT/DELETE handlers**

Import `writeReleaseLog` from `@/lib/release-logger`. After each successful POST, PUT, and DELETE operation (after the audit log write), call `writeReleaseLog`:

For POST (create):
```typescript
writeReleaseLog({
  action: 'create', kind, resourceName: body.metadata?.name || '',
  clusterId, namespace: namespace || null, userId: auth.user.id, requestBody: body,
});
```

For PUT (update):
```typescript
writeReleaseLog({
  action: 'update', kind, resourceName: name,
  clusterId, namespace: namespace || null, userId: auth.user.id, requestBody: body,
});
```

For DELETE:
```typescript
writeReleaseLog({
  action: 'delete', kind, resourceName: name,
  clusterId, namespace: namespace || null, userId: auth.user.id,
});
```

These are fire-and-forget (no `await`) — release logging should never slow down or break the main operation.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/k8s/
git commit -m "feat: auto-log release records on K8s resource mutations"
```

---

## Task 5: Delete Old Templates Module + Clean Up Releases

**Files:**
- Delete: `src/app/(dashboard)/apps/templates/` (entire directory)
- Delete: `src/app/(dashboard)/apps/releases/new/` (entire directory)
- Delete: `src/app/api/apps/templates/` (entire directory)
- Delete: `src/app/api/apps/releases/[id]/rollback/` (entire directory)
- Modify: `src/app/api/apps/releases/route.ts` — remove POST handler, keep only GET
- Modify: `src/app/(dashboard)/apps/releases/page.tsx` — remove "新建发布" button
- Modify: `src/app/(dashboard)/layout.tsx` — update sidebar menu

- [ ] **Step 1: Delete template and release-new directories**

```bash
rm -rf src/app/\(dashboard\)/apps/templates
rm -rf src/app/\(dashboard\)/apps/releases/new
rm -rf src/app/api/apps/templates
rm -rf src/app/api/apps/releases/\[id\]/rollback
```

- [ ] **Step 2: Strip POST from releases API**

Edit `src/app/api/apps/releases/route.ts` — remove the `POST` export function entirely, keep only the `GET` function.

- [ ] **Step 3: Update releases page — remove "新建发布" button**

Edit `src/app/(dashboard)/apps/releases/page.tsx`:
- Remove the "新建发布" Button and its router.push
- Remove the `handleRollback` function and rollback column from the table
- Update page title from "发布记录" with just `<Title level={4}>发布记录</Title>`

- [ ] **Step 4: Update sidebar in layout.tsx**

Edit `src/app/(dashboard)/layout.tsx`. Replace the "应用发布" menu group:

```typescript
// FROM:
{
  name: '应用发布',
  icon: <ApiOutlined />,
  children: [
    { path: '/apps/templates', name: '应用模板', icon: <FileTextOutlined /> },
    { path: '/apps/releases', name: '发布记录', icon: <RocketOutlined /> },
  ],
},
// TO:
{ path: '/apps/releases', name: '发布记录', icon: <FileTextOutlined /> },
```

Remove unused icon imports (`ApiOutlined`, `RocketOutlined` from menu usage if no longer needed).

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove templates module, simplify releases to read-only history"
```

---

## Task 6: Update All 13 Resource Pages with CRUD

**Files:**
- Modify: All 13 resource page files under `src/app/(dashboard)/resources/`

Each resource page follows the same pattern. Import and wire: `usePermissions`, `ResourceDrawer`, `DeleteConfirm`, plus add an actions column and a create button.

The pattern for each page (using deployments as the example):

```tsx
'use client';

import { useState } from 'react';
import { Tag, Typography, Button, Space, message } from 'antd';
import ResourceTable from '@/components/resource-table';
import NamespaceSelector from '@/components/namespace-selector';
import ResourceDrawer from '@/components/resource-drawer';
import DeleteConfirm from '@/components/delete-confirm';
import { useK8sResource } from '@/hooks/use-k8s-resource';
import { usePermissions } from '@/hooks/use-permissions';
import { useClusterStore } from '@/hooks/use-cluster';

const { Title } = Typography;

export default function DeploymentsPage() {
  const [namespace, setNamespace] = useState<string | undefined>();
  const { data = [], loading, refresh } = useK8sResource('deployments', namespace);
  const permissions = usePermissions('deployments');
  const { clusterId } = useClusterStore();
  const [drawerState, setDrawerState] = useState<{ open: boolean; mode: 'view' | 'edit' | 'create'; record?: any }>({ open: false, mode: 'view' });

  const handleDelete = async (record: any) => {
    const name = record.metadata?.name;
    const ns = record.metadata?.namespace;
    if (!clusterId || !name || !ns) return;
    const res = await fetch(`/api/k8s/${clusterId}/namespaces/${ns}/deployments/${name}`, { method: 'DELETE' });
    if (res.ok) { message.success(`Deployment ${name} 已删除`); refresh(); }
    else { const d = await res.json().catch(() => ({})); message.error(d.error || '删除失败'); }
  };

  // Close drawer on namespace change
  const handleNsChange = (v: string | undefined) => {
    setNamespace(v);
    setDrawerState(s => ({ ...s, open: false }));
  };

  const columns = [
    {
      title: '名称', dataIndex: ['metadata', 'name'], key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => setDrawerState({ open: true, mode: 'view', record })}>{text}</a>
      ),
    },
    { title: '命名空间', dataIndex: ['metadata', 'namespace'], key: 'namespace' },
    // ... resource-specific columns (keep existing) ...
    {
      title: '操作', key: 'actions', width: 150,
      render: (_: any, record: any) => (
        <Space>
          {permissions.canUpdate && (
            <Button size="small" type="link" onClick={() => setDrawerState({ open: true, mode: 'edit', record })}>编辑</Button>
          )}
          {permissions.canDelete && (
            <DeleteConfirm name={record.metadata?.name} kindLabel="Deployment" onConfirm={() => handleDelete(record)} />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Deployments</Title>
        {permissions.canCreate && (
          <Button type="primary" onClick={() => setDrawerState({ open: true, mode: 'create' })}>+ 创建</Button>
        )}
      </div>
      <NamespaceSelector value={namespace} onChange={handleNsChange} />
      <ResourceTable data={data} loading={loading} columns={columns} />
      <ResourceDrawer
        open={drawerState.open}
        mode={drawerState.mode}
        kind="deployments"
        kindLabel="Deployment"
        record={drawerState.record}
        namespace={namespace}
        permissions={permissions}
        onClose={() => setDrawerState({ open: false, mode: 'view' })}
        onSuccess={() => { setDrawerState({ open: false, mode: 'view' }); refresh(); }}
      />
    </div>
  );
}
```

Apply this pattern to ALL 13 pages, keeping each page's existing resource-specific columns. Special cases:

- **Pods**: No create button, no edit button, only delete + view
- **Namespaces**: No namespace selector, no edit button, only create + delete + view. For delete API: `/api/k8s/{clusterId}/namespaces/{name}` (no nested namespace path)
- **StorageClasses**: No namespace selector. For API: `/api/k8s/{clusterId}/storageclasses/{name}`
- **Jobs/CronJobs**: kind='jobs' for the listing, template uses CronJob YAML

- [ ] **Step 1: Update deployments page**
- [ ] **Step 2: Update statefulsets page**
- [ ] **Step 3: Update daemonsets page**
- [ ] **Step 4: Update jobs page**
- [ ] **Step 5: Update pods page (delete only)**
- [ ] **Step 6: Update services page**
- [ ] **Step 7: Update ingresses page**
- [ ] **Step 8: Update configmaps page**
- [ ] **Step 9: Update secrets page**
- [ ] **Step 10: Update pvcs page**
- [ ] **Step 11: Update storageclasses page (cluster-scoped)**
- [ ] **Step 12: Update namespaces page (cluster-scoped, create+delete only)**
- [ ] **Step 13: Verify build**

```bash
npm run build
```

- [ ] **Step 14: Commit**

```bash
git add src/app/\(dashboard\)/resources/
git commit -m "feat: add CRUD operations to all 13 resource pages"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Verify build passes**
```bash
npm run build
```

- [ ] **Step 2: Verify tests pass**
```bash
ENCRYPTION_KEY=$(grep ENCRYPTION_KEY .env | cut -d= -f2) npx jest
```

- [ ] **Step 3: Manual smoke test checklist**
- Login as admin
- Select a cluster
- Deployments page: verify create/edit/delete buttons show
- Click a deployment name → view drawer opens with YAML
- Click edit → editable YAML, save works
- Click create → template selection, YAML editor, submit works
- Click delete → popconfirm → modal with name input → delete works
- Check /apps/releases — verify release records auto-created for above operations
- Check sidebar — "发布记录" is a single entry, no "应用模板" menu

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "feat: resource CRUD redesign complete"
```
