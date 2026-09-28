import { ogCard, OG_SIZE } from '@/lib/og/card';
import { sectorDetail } from '@/server/sectors/detail';
import { usd } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'A token sector on Peregrine: net flow, volume and the tokens driving it';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** One sector: its 24h net flow, volume, rank and the token leading it. */
export default async function Image({ params }: { params: Promise<{ sector: string }> }) {
  const name = decodeURIComponent((await params).sector).slice(0, 60);
  const d = sectorDetail(name, 'public');
  const r = d?.reading;
  const leader = r?.top.inflows[0];
  return ogCard({
    section: 'Sector',
    title: r ? `${name}: ${usd(r.netFlow24hUsd, { signed: true })} net flow in 24 hours` : name,
    subtitle: leader ? `${leader.symbol ?? 'Its top token'} leads the buying. Net flow, volume and the tokens driving the sector, across chains.` : 'Net flow, volume and the tokens driving the sector, across chains.',
    stats: r ? [
      { label: 'Net flow, 24h', value: usd(r.netFlow24hUsd, { signed: true }), tone: (r.netFlow24hUsd ?? 0) >= 0 ? 'up' : 'down' },
      { label: 'Volume, 24h', value: usd(r.volume24hUsd) },
      { label: 'Flow Index rank', value: d ? `${d.rank} of ${d.of}` : 'n/a' },
      { label: 'Tokens tracked', value: r.tokens != null ? r.tokens.toLocaleString('en-US') : 'n/a' },
    ] : [],
  });
}
