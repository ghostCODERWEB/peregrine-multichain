import { ogCard, OG_SIZE } from '@/lib/og/card';
import { buildBulletin } from '@/server/weather/bulletin';
import { chainName, num, usd } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'A chain on Peregrine: Flow Index, net flow and the tokens moving';
export const size = OG_SIZE;
export const contentType = 'image/png';

const BAND = { high: 'accumulation', low: 'distribution', neutral: 'neutral' } as const;

/** One chain: its Flow Index and net flows by window. */
export default async function Image({ params }: { params: Promise<{ chain: string }> }) {
  const chain = decodeURIComponent((await params).chain);
  const c = buildBulletin('public').chains.find((x) => x.chain === chain);
  const w = (k: string) => c?.windows?.find((x) => x.window === k)?.netFlowUsd ?? null;
  const name = chainName(chain);
  return ogCard({
    section: 'Chain',
    title: c?.cpi != null ? `${name} Flow Index ${num(c.cpi, 0)}, ${BAND[c.band ?? 'neutral']}` : name,
    subtitle: `Net flow, activity and the most-traded tokens on ${name}, measured against the chain’s own history.`,
    stats: c ? [
      { label: 'Flow Index', value: c.cpi != null ? num(c.cpi, 0) : 'n/a', tone: c.band === 'high' ? 'up' : c.band === 'low' ? 'down' : 'plain' },
      { label: 'Net flow, 1h', value: usd(w('1h'), { signed: true }), tone: (w('1h') ?? 0) >= 0 ? 'up' : 'down' },
      { label: 'Net flow, 24h', value: usd(w('24h'), { signed: true }), tone: (w('24h') ?? 0) >= 0 ? 'up' : 'down' },
      { label: 'Net flow, 7d', value: usd(w('7d'), { signed: true }), tone: (w('7d') ?? 0) >= 0 ? 'up' : 'down' },
    ] : [],
  });
}
