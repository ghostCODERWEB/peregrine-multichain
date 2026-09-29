import { ogCard, OG_SIZE } from '@/lib/og/card';
import { sectorsAnalytics } from '@/server/insights';
import { usd } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Sectors on Peregrine: net flow by token sector across chains';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Sectors: the leading and trailing sector by 24h net flow. */
export default function Image() {
  const a = sectorsAnalytics('public');
  const top = [...a.ranking].sort((x, y) => y.value - x.value);
  const lead = top[0], trail = top.at(-1);
  const up = top.filter((r) => r.value > 0).length;
  return ogCard({
    section: 'Sectors',
    title: lead && trail ? `${lead.label} leads sector inflows; ${trail.label} trails` : 'Net flow by token sector',
    subtitle: 'DeFi, AI, memecoins, RWAs and more: which sectors capital is moving into, across chains, over 24 hours.',
    stats: [
      { label: lead ? `Top inflow · ${lead.label}` : 'Top inflow', value: lead ? usd(lead.value, { signed: true }) : 'n/a', tone: 'up' },
      { label: trail ? `Top outflow · ${trail.label}` : 'Top outflow', value: trail ? usd(trail.value, { signed: true }) : 'n/a', tone: 'down' },
      { label: 'Sectors net positive', value: `${up} of ${top.length}` },
    ],
  });
}
