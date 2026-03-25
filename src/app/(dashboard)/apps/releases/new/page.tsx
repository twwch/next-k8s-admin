'use client';

import { useState } from 'react';
import { Form, Input, Select, Button, Card, Steps, message } from 'antd';
import { useRouter } from 'next/navigation';
import { useRequest } from 'ahooks';
import YamlEditor from '@/components/yaml-editor';

export default function NewReleasePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const { data: templates = [] } = useRequest(async () => {
    const res = await fetch('/api/apps/templates');
    return res.json();
  });

  const { data: clusters = [] } = useRequest(async () => {
    const res = await fetch('/api/clusters');
    return res.json();
  });

  const { data: namespaces = [] } = useRequest(async () => {
    const clusterId = form.getFieldValue('clusterId');
    if (!clusterId) return [];
    const res = await fetch(`/api/k8s/${clusterId}/namespaces`);
    if (!res.ok) return [];
    return res.json();
  }, { refreshDeps: [] });

  const handleTemplateSelect = (id: string) => {
    const tmpl = templates.find((t: any) => t.id === id);
    setSelectedTemplate(tmpl);
    // Initialize variables from template definition
    if (tmpl?.variables) {
      const initialVars: Record<string, string> = {};
      for (const [key, def] of Object.entries(tmpl.variables as Record<string, any>)) {
        initialVars[key] = def.default || '';
      }
      setVariables(initialVars);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = await fetch('/api/apps/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appTemplateId: values.appTemplateId,
          clusterId: values.clusterId,
          namespace: values.namespace,
          name: values.name,
          values: variables,
        }),
      });
      if (res.ok) {
        message.success('发布成功');
        router.push('/apps/releases');
      } else {
        const data = await res.json();
        message.error(data.error || '发布失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const variableKeys = selectedTemplate?.variables
    ? Object.keys(selectedTemplate.variables as Record<string, unknown>)
    : [];

  return (
    <Card title="新建发布" style={{ maxWidth: 800 }}>
      <Steps
        current={step}
        items={[
          { title: '选择模板' },
          { title: '配置部署' },
          { title: '填写变量' },
        ]}
        style={{ marginBottom: 24 }}
      />

      <Form form={form} layout="vertical">
        {step === 0 && (
          <>
            <Form.Item name="appTemplateId" label="应用模板" rules={[{ required: true }]}>
              <Select
                placeholder="选择模板"
                onChange={handleTemplateSelect}
                options={templates.map((t: any) => ({
                  value: t.id,
                  label: `${t.name} (v${t.version})`,
                }))}
              />
            </Form.Item>
            {selectedTemplate && (
              <Card size="small" title="模板内容预览" style={{ marginBottom: 16 }}>
                <YamlEditor
                  value={JSON.stringify(selectedTemplate.template, null, 2)}
                  rows={8}
                />
              </Card>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <Form.Item name="name" label="发布名称" rules={[{ required: true }]}>
              <Input placeholder="如: my-app-prod" />
            </Form.Item>
            <Form.Item name="clusterId" label="目标集群" rules={[{ required: true }]}>
              <Select
                placeholder="选择集群"
                options={clusters.map((c: any) => ({
                  value: c.id,
                  label: c.displayName || c.name,
                }))}
              />
            </Form.Item>
            <Form.Item name="namespace" label="命名空间" rules={[{ required: true }]}>
              <Select
                placeholder="选择或输入命名空间"
                mode="tags"
                maxCount={1}
                options={namespaces.map((ns: any) => ({
                  value: ns.metadata?.name,
                  label: ns.metadata?.name,
                }))}
              />
            </Form.Item>
          </>
        )}

        {step === 2 && (
          <>
            {variableKeys.length === 0 ? (
              <p style={{ color: '#999' }}>该模板没有定义变量，可直接提交。</p>
            ) : (
              variableKeys.map((key) => (
                <Form.Item key={key} label={key}>
                  <Input
                    value={variables[key] || ''}
                    onChange={(e) => setVariables((v) => ({ ...v, [key]: e.target.value }))}
                    placeholder={(selectedTemplate?.variables as any)?.[key]?.description || key}
                  />
                </Form.Item>
              ))
            )}
          </>
        )}

        <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
          {step > 0 && (
            <Button onClick={() => setStep(step - 1)}>上一步</Button>
          )}
          {step < 2 && (
            <Button type="primary" onClick={() => setStep(step + 1)}>下一步</Button>
          )}
          {step === 2 && (
            <Button type="primary" loading={loading} onClick={handleSubmit}>提交发布</Button>
          )}
          <Button onClick={() => router.back()}>取消</Button>
        </div>
      </Form>
    </Card>
  );
}
