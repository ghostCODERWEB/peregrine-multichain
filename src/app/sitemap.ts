import type { MetadataRoute } from 'next';
import { siteUrl } from '@/server/seo';
import { buildBulletin } from '@/server/weather/bulletin';
import { sectorsAnalytics } from '@/server/insights';
import { perpBoard } from '@/server/perps/board';
import { storedBoard } from '@/server/predict/board';
import { alphaBoard } from '@/server/alpha/board';

// Built per request from what the app has stored (never a Nansen call): the chains, sectors, perps, markets
// and tokens that have pages worth finding today.
export const dynamic = 'force-dynamic';

const SECTIONS: Array<[string, MetadataRoute.Sitemap[number]['changeFrequency'], number]> = [
  ['/', 'hourly', 1], ['/flows', 'hourly', 0.9], ['/perps', 'hourly', 0.9], ['/predict', 'hourly', 0.9], ['/sectors', 'hourly', 0.8],
  ['/alpha', 'hourly', 0.8], ['/token', 'daily', 0.8], ['/wallet', 'daily', 0.7], ['/smart-money', 'daily', 0.7], ['/copy', 'daily', 0.7],
  ['/cascade', 'daily', 0.6], ['/history', 'daily', 0.6], ['/proof', 'weekly', 0.6], ['/coverage', 'weekly', 0.5], ['/agent', 'weekly', 0.5],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  const page = (path: string, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'], priority: number) => ({ url: `${base}${path}`, lastModified: now, changeFrequency, priority });
  const out = SECTIONS.map(([p, f, w]) => page(p, f, w));
  const safely = <T,>(read: () => T[]): T[] => { try { return read(); } catch { return []; } };
  for (const c of safely(() => buildBulletin('public').chains.filter((x) => x.cpi != null))) out.push(page(`/chain/${c.chain}`, 'hourly', 0.7));
  for (const r of safely(() => sectorsAnalytics('public').ranking)) out.push(page(`/sectors/${encodeURIComponent(r.label)}`, 'daily', 0.6));
  for (const c of safely(() => [...perpBoard('public').coins].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0)).slice(0, 40))) out.push(page(`/perps/${encodeURIComponent(c.symbol)}`, 'hourly', 0.6));
  for (const m of safely(() => (storedBoard()?.markets ?? []).slice(0, 40))) out.push(page(`/predict/${encodeURIComponent(m.id)}`, 'daily', 0.5));
  for (const r of safely(() => alphaBoard('public', Date.now(), 40).rows)) out.push(page(`/token/${r.chain}/${encodeURIComponent(r.tokenAddress)}`, 'daily', 0.5));
  return out;
}
