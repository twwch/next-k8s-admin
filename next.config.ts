import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['ws', '@kubernetes/client-node'],
  allowedDevOrigins: ['54.186.80.96'],
  env: {
    NEXT_PUBLIC_SMTP_ENABLED: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ? 'true' : '',
  },
};

export default nextConfig;
