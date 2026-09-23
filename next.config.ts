import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native module: loaded by Node at runtime, never bundled.
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
