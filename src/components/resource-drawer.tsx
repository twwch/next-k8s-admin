'use client';

import { useState, useEffect } from 'react';
import { Drawer, Button, Space, message, Tag } from 'antd';
import yaml from 'yaml';
import YamlEditor from '@/components/yaml-editor';
import { RESOURCE_TEMPLATES } from '@/components/resource-templates';
import { useClusterStore } from '@/hooks/use-cluster';

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

export default function ResourceDrawer({
  open,
  mode,
  kind,
  kindLabel,
  record,
  namespace,
  permissions,
  onClose,
  onSuccess,
}: ResourceDrawerProps) {
  const { clusterId } = useClusterStore();
  const [currentMode, setCurrentMode] = useState(mode);
  const [yamlText, setYamlText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode, open]);

  useEffect(() => {
    if (!open) return;
    if (mode === 'view' && record) {
      setYamlText(yaml.stringify(record));
    } else if (mode === 'edit' && record) {
      setYamlText(yaml.stringify(cleanForEdit(record)));
    } else if (mode === 'create') {
      const templates = RESOURCE_TEMPLATES[kind];
      if (templates && templates.length > 0) {
        setYamlText('');
      } else {
        setYamlText('');
      }
    }
  }, [open, mode, record, kind]);

  useEffect(() => {
    if (!open) return;
    if (currentMode === 'view' && record) {
      setYamlText(yaml.stringify(record));
    } else if (currentMode === 'edit' && record) {
      setYamlText(yaml.stringify(cleanForEdit(record)));
    }
  }, [currentMode]);

  const handleSave = async () => {
    if (!clusterId) return;
    setLoading(true);
    try {
      let parsed: any;
      try {
        parsed = yaml.parse(yamlText);
      } catch (e: any) {
        message.error(`YAML 格式错误: ${e.message}`);
        return;
      }

      const name = record?.metadata?.name;
      const ns = parsed?.metadata?.namespace || namespace || 'default';
      const url = `/api/k8s/${clusterId}/namespaces/${ns}/${kind}/${name}`;

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (res.status === 409) {
        message.error('资源已被其他人修改，请刷新后重试');
        return;
      }

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        message.error(`操作失败: ${d.error || res.statusText}`);
        return;
      }

      message.success(`${kindLabel} 已更新`);
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!clusterId) return;
    setLoading(true);
    try {
      let docs: any[];
      try {
        docs = yaml.parseAllDocuments(yamlText).map((d) => d.toJS());
      } catch (e: any) {
        message.error(`YAML 格式错误: ${e.message}`);
        return;
      }

      const results: { success: boolean; kind: string; name: string; error?: string }[] = [];

      for (const doc of docs) {
        if (!doc) continue;
        const docKind = doc.kind?.toLowerCase() + 's';
        const docNs = doc.metadata?.namespace || namespace || 'default';
        const docName = doc.metadata?.name || '';

        // Cluster-scoped resources don't use namespace path
        const clusterScoped = ['storageclasses', 'namespaces'].includes(docKind);
        const url = clusterScoped
          ? `/api/k8s/${clusterId}/${docKind}`
          : `/api/k8s/${clusterId}/namespaces/${docNs}/${docKind}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doc),
        });

        if (res.ok) {
          results.push({ success: true, kind: doc.kind || docKind, name: docName });
        } else {
          const d = await res.json().catch(() => ({}));
          results.push({ success: false, kind: doc.kind || docKind, name: docName, error: d.error || res.statusText });
        }
      }

      const failed = results.filter((r) => !r.success);
      const succeeded = results.filter((r) => r.success);

      if (failed.length === 0) {
        message.success(`${kindLabel} 创建成功`);
        onSuccess();
      } else if (succeeded.length > 0) {
        message.warning(`部分资源创建成功，${failed.map((f) => `${f.kind} 创建失败: ${f.error}`).join('; ')}`);
        onSuccess();
      } else {
        message.error(`操作失败: ${failed.map((f) => f.error).join('; ')}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const templates = RESOURCE_TEMPLATES[kind] || [];

  const title = currentMode === 'view'
    ? record?.metadata?.name || kindLabel
    : currentMode === 'edit'
    ? `编辑 ${record?.metadata?.name || kindLabel}`
    : `创建 ${kindLabel}`;

  const extraButtons = currentMode === 'view' && permissions.canUpdate ? (
    <Button type="default" onClick={() => setCurrentMode('edit')}>编辑</Button>
  ) : null;

  const footer = currentMode === 'edit' ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Space>
        <Button onClick={() => setCurrentMode('view')}>取消</Button>
        <Button type="primary" loading={loading} onClick={handleSave}>保存</Button>
      </Space>
    </div>
  ) : currentMode === 'create' ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Space>
        <Button onClick={onClose}>取消</Button>
        <Button type="primary" loading={loading} onClick={handleCreate}>创建</Button>
      </Space>
    </div>
  ) : null;

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{title}</span>
          {extraButtons}
        </div>
      }
      open={open}
      onClose={onClose}
      width={700}
      footer={footer}
      destroyOnHidden
    >
      {currentMode === 'create' && templates.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 8, color: '#595959' }}>选择模板：</div>
          <Space wrap>
            {templates.map((t) => (
              <Tag
                key={t.label}
                style={{ cursor: 'pointer', padding: '4px 8px' }}
                onClick={() => setYamlText(t.yaml)}
              >
                {t.label}
              </Tag>
            ))}
            <Tag
              style={{ cursor: 'pointer', padding: '4px 8px' }}
              onClick={() => setYamlText('')}
            >
              空白
            </Tag>
          </Space>
        </div>
      )}
      <YamlEditor
        value={yamlText}
        onChange={setYamlText}
        readOnly={currentMode === 'view'}
        height={currentMode === 'view' ? 560 : 500}
      />
    </Drawer>
  );
}
