'use client';

import { Form, Input, Select, Button, App, Switch, Typography, Steps } from 'antd';
import {
  ClusterOutlined, SafetyCertificateOutlined, BellOutlined,
  KeyOutlined, FileTextOutlined, CloudServerOutlined,
  ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { gradientBtnStyle } from '@/lib/styles';
import { request } from '@/lib/request';
import { useClusterStore } from '@/hooks/use-cluster';

const { TextArea } = Input;
const { Text, Title } = Typography;

export default function NewClusterPage() {
  const { message } = App.useApp();
  const router = useRouter();
  const refreshClusterList = useClusterStore((s) => s.refreshClusterList);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [authType, setAuthType] = useState('kubeconfig');
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = await request('/api/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, notifyEnabled }),
      });
      if (res.ok) {
        message.success('集群添加成功');
        refreshClusterList();
        router.push('/clusters');
      } else {
        const data = await res.json();
        message.error(data.error || '添加失败');
      }
    } catch {
      // validation error
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    try {
      if (step === 0) {
        await form.validateFields(['name', 'displayName', 'apiServerUrl']);
      } else if (step === 1) {
        const fields = authType === 'kubeconfig'
          ? ['authType', 'kubeconfig']
          : ['authType', 'saToken'];
        await form.validateFields(fields);
      }
      setStep(step + 1);
    } catch {
      // validation error
    }
  };

  const authOptions = [
    {
      value: 'kubeconfig',
      icon: <FileTextOutlined style={{ fontSize: 24 }} />,
      title: 'Kubeconfig',
      desc: '上传或粘贴 kubeconfig 文件',
    },
    {
      value: 'token',
      icon: <KeyOutlined style={{ fontSize: 24 }} />,
      title: 'ServiceAccount Token',
      desc: '使用 Bearer Token 连接',
    },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
          style={{ marginBottom: 12, color: '#8b949e' }}
        >
          返回集群列表
        </Button>
        <Title level={3} style={{ margin: 0 }}>添加集群</Title>
        <Text type="secondary">连接一个新的 Kubernetes 集群到管理平台</Text>
      </div>

      {/* Steps */}
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 36 }}
        items={[
          { title: '基本信息', icon: <ClusterOutlined /> },
          { title: '认证配置', icon: <SafetyCertificateOutlined /> },
          { title: '通知设置', icon: <BellOutlined /> },
        ]}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{ authType: 'kubeconfig' }}
        requiredMark={false}
      >
        {/* Step 0: 基本信息 */}
        <div style={{ display: step === 0 ? 'block' : 'none' }}>
          <div style={{
            background: '#f8fafc',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #326CE5, #1a4bc7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16,
              }}>
                <CloudServerOutlined />
              </div>
              <div>
                <Text strong>集群标识与名称</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>用于系统内标识和界面展示</Text>
              </div>
            </div>

            <Form.Item
              name="name"
              label={<Text strong>集群标识</Text>}
              rules={[
                { required: true, message: '请输入集群标识' },
                { pattern: /^[a-z0-9-]+$/, message: '仅支持小写字母、数字和连字符' },
              ]}
              extra="唯一标识，创建后不可修改"
            >
              <Input
                placeholder="production"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              name="displayName"
              label={<Text strong>显示名称</Text>}
              rules={[{ required: true, message: '请输入显示名称' }]}
            >
              <Input
                placeholder="生产环境"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item
              name="apiServerUrl"
              label={<Text strong>API Server URL</Text>}
              rules={[{ required: true, message: '请输入 API Server 地址' }]}
            >
              <Input
                placeholder="https://kubernetes.example.com:6443"
                size="large"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>

            <Form.Item name="description" label={<Text strong>描述</Text>}>
              <TextArea
                rows={2}
                placeholder="可选，简要描述集群用途"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
          </div>
        </div>

        {/* Step 1: 认证配置 */}
        <div style={{ display: step === 1 ? 'block' : 'none' }}>
          <div style={{
            background: '#f8fafc',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16,
              }}>
                <SafetyCertificateOutlined />
              </div>
              <div>
                <Text strong>认证方式</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>选择连接 Kubernetes API 的认证方式</Text>
              </div>
            </div>

            <Form.Item name="authType" rules={[{ required: true }]}>
              <div style={{ display: 'flex', gap: 12 }}>
                {authOptions.map((opt) => {
                  const selected = authType === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => { setAuthType(opt.value); form.setFieldValue('authType', opt.value); }}
                      style={{
                        flex: 1,
                        padding: 16,
                        borderRadius: 10,
                        border: selected ? '2px solid #326CE5' : '1px solid #e2e8f0',
                        background: selected ? 'rgba(50,108,229,0.04)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ color: selected ? '#326CE5' : '#94a3b8', marginBottom: 8 }}>{opt.icon}</div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: selected ? '#326CE5' : '#1a1a1a' }}>{opt.title}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{opt.desc}</div>
                    </div>
                  );
                })}
              </div>
            </Form.Item>

            {authType === 'kubeconfig' && (
              <Form.Item
                name="kubeconfig"
                label={<Text strong>Kubeconfig 内容</Text>}
                rules={[{ required: true, message: '请粘贴 kubeconfig 内容' }]}
              >
                <TextArea
                  rows={10}
                  placeholder="粘贴 kubeconfig YAML 内容"
                  style={{
                    fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace",
                    fontSize: 12,
                    borderRadius: 8,
                    background: '#0d1117',
                    color: '#e6edf3',
                  }}
                />
              </Form.Item>
            )}

            {authType === 'token' && (
              <>
                <Form.Item
                  name="saToken"
                  label={<Text strong>Bearer Token</Text>}
                  rules={[{ required: true, message: '请输入 Token' }]}
                >
                  <TextArea
                    rows={4}
                    placeholder="ServiceAccount Bearer Token"
                    style={{
                      fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace",
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                  />
                </Form.Item>
                <Form.Item name="caCert" label={<Text strong>CA 证书 <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>（可选）</Text></Text>}>
                  <TextArea
                    rows={4}
                    placeholder="CA 证书 PEM 内容"
                    style={{
                      fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace",
                      fontSize: 12,
                      borderRadius: 8,
                    }}
                  />
                </Form.Item>
              </>
            )}
          </div>
        </div>

        {/* Step 2: 通知设置 */}
        <div style={{ display: step === 2 ? 'block' : 'none' }}>
          <div style={{
            background: '#f8fafc',
            borderRadius: 12,
            padding: 24,
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16,
              }}>
                <BellOutlined />
              </div>
              <div>
                <Text strong>发版通知</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>配置部署变更时的通知推送</Text>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: '#fff',
              marginBottom: notifyEnabled ? 16 : 0,
            }}>
              <div>
                <Text strong>飞书通知</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>发布/回滚时自动推送通知到飞书群</Text>
              </div>
              <Switch checked={notifyEnabled} onChange={setNotifyEnabled} />
            </div>

            {notifyEnabled && (
              <Form.Item
                name="webhookUrl"
                label={<Text strong>飞书 Webhook 地址</Text>}
                rules={[{ required: true, message: '启用通知时必须填写 Webhook 地址' }]}
              >
                <Input
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
                  size="large"
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>
            )}

            {!notifyEnabled && (
              <div style={{ textAlign: 'center', padding: '24px 0 8px', color: '#94a3b8', fontSize: 13 }}>
                暂不配置通知，可在集群设置中随时开启
              </div>
            )}
          </div>
        </div>
      </Form>

      {/* Footer Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 24,
        paddingTop: 20,
        borderTop: '1px solid #f0f0f0',
      }}>
        <Button
          onClick={() => step === 0 ? router.back() : setStep(step - 1)}
          icon={step > 0 ? <ArrowLeftOutlined /> : undefined}
        >
          {step === 0 ? '取消' : '上一步'}
        </Button>

        {step < 2 ? (
          <Button type="primary" onClick={nextStep} style={gradientBtnStyle}>
            下一步 <ArrowRightOutlined />
          </Button>
        ) : (
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={loading}
            icon={<CheckOutlined />}
            style={gradientBtnStyle}
          >
            添加集群
          </Button>
        )}
      </div>
    </div>
  );
}
