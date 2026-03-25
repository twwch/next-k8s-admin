'use client';

import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  gradient: string;
  icon: ReactNode;
  footer?: string;
}

export default function StatCard({ title, value, gradient, icon, footer }: StatCardProps) {
  return (
    <div style={{
      background: gradient,
      borderRadius: 10,
      padding: '20px 24px',
      color: 'white',
      height: '100%',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{value}</div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.6 }}>{icon}</div>
      </div>
      {footer && (
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>{footer}</div>
      )}
    </div>
  );
}
