'use client';

import type { ReactNode } from 'react';

interface PageContainerProps {
  title: string;
  description?: string;
  extra?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}

export default function PageContainer({ title, description, extra, filters, children }: PageContainerProps) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: filters ? 12 : 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</div>
            {description && (
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{description}</div>
            )}
          </div>
          {extra && <div>{extra}</div>}
        </div>
        {filters && <div style={{ display: 'flex', gap: 8 }}>{filters}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
