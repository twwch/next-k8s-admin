import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['ws', '@kubernetes/client-node'],
};

export default nextConfig;
