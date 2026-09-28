import type { MetadataRoute } from 'next';
import { siteUrl } from '@/server/seo';

export const dynamic = 'force-dynamic';

/** Crawl the pages, not the API or the per-visitor screens (those also carry noindex). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/account', '/desk', '/alerts', '/trade'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
