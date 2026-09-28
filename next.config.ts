import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native module: loaded by Node at runtime, never bundled.
  serverExternalPackages: ['better-sqlite3'],
  // `pnpm dev:demo` runs beside a live `pnpm dev`; each needs its own build dir.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  // The dev badge sits over the sidebar's footer; build errors still show.
  devIndicators: false,
  // No framework fingerprint in responses.
  poweredByHeader: false,
  // Responses are compressed by scripts/server.mjs, which coalesces Next's per-chunk flushes.
  compress: false,
  // Logos and brand images: Next serves public/ files with max-age=0, so every page view re-checked ~100 logos.
  // They change only with a deploy; a day fresh plus a week of background revalidation is plenty.
  async headers() {
    const cache = [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }];
    return [{ source: '/logos/:path*', headers: cache }, { source: '/brand/:path*', headers: cache }];
  },
};

export default nextConfig;
