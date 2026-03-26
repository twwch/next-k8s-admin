import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['ws', '@kubernetes/client-node'],
  allowedDevOrigins: ['54.186.80.96'],
};

export default nextConfig;
