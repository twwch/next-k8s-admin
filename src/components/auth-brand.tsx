'use client';

import Logo from '@/components/logo';

export default function AuthBrand() {
  return (
    <div style={{
      flex: 1,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #326CE5 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      minHeight: '100vh',
    }}>
      <Logo size={64} showText={false} />
      <h1 style={{
        color: 'white',
        fontSize: 28,
        fontWeight: 700,
        marginTop: 24,
        marginBottom: 8,
      }}>
        K8s Admin
      </h1>
      <p style={{
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 0,
      }}>
        Kubernetes 集群管理平台
      </p>
    </div>
  );
}
