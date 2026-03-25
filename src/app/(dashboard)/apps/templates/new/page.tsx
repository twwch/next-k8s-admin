'use client';

import { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { useRouter } from 'next/navigation';
import YamlEditor from '@/components/yaml-editor';

export default function NewTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [templateContent, setTemplateContent] = useState('');
  const [variablesContent, setVariablesContent] = useState('');

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      let template: unknown;
      let variables: unknown;
      try {
        template = JSON.parse(templateContent);
      } catch {
        message.error('模板内容不是有效的 JSON');
        return;
      }
      if (variablesContent) {
        try {
          variables = JSON.parse(variablesContent);
        } catch {
          message.error('变量定义不是有效的 JSON');
          return;
        }
      }

      const res = await fetch('/api/apps/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, template, variables }),
      });
      if (res.ok) {
        message.success('模板创建成功');
        router.push('/apps/templates');
      } else {
        const data = await res.json();
        message.error(data.error || '创建失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="创建应用模板" style={{ maxWidth: 900 }}>
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item name="name" label="模板名称" rules={[{ required: true }]}>
          <Input placeholder="如: nginx-deployment" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item label="模板内容 (JSON)" required>
          <YamlEditor
            value={templateContent}
            onChange={setTemplateContent}
            rows={15}
          />
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            使用 {'{{VARIABLE_NAME}}'} 语法定义变量，如 {'{"image": "{{IMAGE}}"}'}
          </div>
        </Form.Item>
        <Form.Item label="变量定义 (JSON, 可选)">
          <YamlEditor
            value={variablesContent}
            onChange={setVariablesContent}
            rows={5}
          />
          <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            变量定义格式: {'{"IMAGE": {"description": "容器镜像", "default": "nginx:latest"}}'}
          </div>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>创建</Button>
          <Button style={{ marginLeft: 8 }} onClick={() => router.back()}>取消</Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
