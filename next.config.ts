import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native module: loaded by Node at runtime, never bundled.
  serverExternalPackages: ['better-sqlite3'],
  // `pnpm dev:demo` runs beside a live `pnpm dev`; each needs its own build dir.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
