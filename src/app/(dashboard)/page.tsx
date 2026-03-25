'use client';

import { Card, Col, Row, Statistic, List, Tag, Typography, Spin } from 'antd';
import {
  ClusterOutlined, RocketOutlined, CloudOutlined, CalendarOutlined,
  CheckCircleOutlined, CloseCircleOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import { useRequest } from 'ahooks';

const { Text } = Typography;

const statusIcon: Record<string, React.ReactNode> = {
  connected: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
  disconnected: <MinusCircleOutlined style={{ color: '#8c8c8c' }} />,
  error: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
};

const eventTypeColor: Record<string, string> = {
  Normal: 'green',
  Warning: 'orange',
};

export default function DashboardPage() {
  const { data, loading } = useRequest(async () => {
    const res = await fetch('/api/dashboard');
    if (!res.ok) return null;
    return res.json();
  }, { pollingInterval: 30000 });

  return (
    <Spin spinning={loading && !data}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="集群" value={data?.clusterCount ?? '-'} prefix={<ClusterOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="运行 Pods" value={data?.podCount ?? '-'} prefix={<CloudOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Deployments" value={data?.deploymentCount ?? '-'} prefix={<RocketOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="今日发布" value={data?.todayReleaseCount ?? '-'} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={16}>
          <Card title="最近事件">
            <List
              dataSource={data?.events || []}
              locale={{ emptyText: data ? '暂无事件' : '加载中...' }}
              renderItem={(item: any) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <span>
                        <Tag color={eventTypeColor[item.type] || 'default'} style={{ marginRight: 8 }}>
                          {item.type}
                        </Tag>
                        <Text strong>{item.object}</Text>
                        <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          {item.namespace} · {item.cluster}
                        </Text>
                      </span>
                    }
                    description={
                      <span>
                        <Text type="secondary">{item.reason}: </Text>
                        {item.message?.substring(0, 120)}
                      </span>
                    }
                  />
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {item.time ? new Date(item.time).toLocaleString() : '-'}
                  </Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="集群状态">
            <List
              dataSource={data?.clusters || []}
              locale={{ emptyText: data ? '暂无集群' : '加载中...' }}
              renderItem={(item: any) => (
                <List.Item>
                  <span>
                    {statusIcon[item.status] || statusIcon.disconnected}
                    <Text strong style={{ marginLeft: 8 }}>{item.name}</Text>
                  </span>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.nodes} 节点 · {item.pods} Pods
                  </Text>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}
