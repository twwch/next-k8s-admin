'use client';

import Logo from '@/components/logo';

export default function AuthBrand() {
  return (
    <div style={{
      height: '100%',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #326CE5 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 48,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background elements */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', opacity: 0.12 }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Floating orbs */}
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(50,108,229,0.3) 0%, transparent 70%)',
        top: '10%', left: '10%',
        animation: 'float1 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
        bottom: '15%', right: '10%',
        animation: 'float2 10s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 150, height: 150, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%)',
        top: '60%', left: '50%',
        animation: 'float3 12s ease-in-out infinite',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 20,
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          <Logo size={48} showText={false} />
        </div>
        <h1 style={{
          color: 'white',
          fontSize: 32,
          fontWeight: 700,
          marginBottom: 8,
          letterSpacing: -0.5,
        }}>
          K8s Admin
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: 15,
          marginBottom: 48,
        }}>
          Kubernetes 集群管理平台
        </p>

        {/* Feature highlights */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 280 }}>
          {[
            { icon: '🖥', text: '多集群统一管理' },
            { icon: '🔒', text: '精细化 RBAC 权限控制' },
            { icon: '📊', text: '实时资源监控与事件推送' },
          ].map((item) => (
            <div key={item.text} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -30px) scale(1.1); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, 20px) scale(1.15); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(15px, -25px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}
