'use client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={zhCN}>
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
        {children}
      </div>
    </ConfigProvider>
  );
}
