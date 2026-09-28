// Page metadata for search engines and link previews: every page gets its own title, description,
// canonical address and share card, in one shape (pageMeta), so a shared link always shows what it opens.
import type { Metadata } from 'next';

export const SITE_NAME = 'Peregrine';
export const SITE_TAGLINE = 'Smart-money intelligence for every chain';
export const SITE_DESCRIPTION =
  'Onchain intelligence built on the Nansen API: a Flow Index for every chain, capital rotation between chains, perp and prediction-market flows, token dump-risk scores and wallet profiles.';

/** The public address the site is served from: SITE_URL when set, else the host's own domain (Railway sets
 *  RAILWAY_PUBLIC_DOMAIN), so share cards and canonical links never point at localhost in production. */
export function siteUrl(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

/** Search engines skip pages that belong to one visitor (their desk, account, alerts). */
const PRIVATE = { index: false, follow: true } as const;

/**
 * Metadata for one page. `title` is the page's own name (the site name is added); `path` is its canonical
 * address; `image` a share card other than the one its route provides.
 */
export function pageMeta(p: { title: string; description: string; path: string; image?: string; noindex?: boolean; absoluteTitle?: boolean }): Metadata {
  const title = p.absoluteTitle ? p.title : `${p.title} · ${SITE_NAME}`;
  const description = p.description.length > 200 ? `${p.description.slice(0, 197).trimEnd()}…` : p.description;
  // Share cards come from each section's opengraph-image route (the nearest one up the path); `image` only for a
  // page that should borrow another card. A card set here would override the route's own.
  const images = p.image ? [{ url: p.image, width: 1200, height: 630, alt: title }] : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: p.path },
    openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_US', url: p.path, title, description, ...(images ? { images } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
    ...(p.noindex ? { robots: PRIVATE } : {}),
  };
}
