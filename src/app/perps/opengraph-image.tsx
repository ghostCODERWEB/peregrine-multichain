import { ogCard, OG_SIZE } from '@/lib/og/card';
import { perpBoard, perpTitle } from '@/server/perps/board';
import { num, pct, usd } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Perps on Peregrine: Hyperliquid open interest, funding and the Perp Flow Index';
export const size = OG_SIZE;
export const contentType = 'image/png';

const band = (p: number) => (p > 65 ? 'Long bias' : p < 35 ? 'Short bias' : 'Balanced');

/** Perps: the venue's reading and the headline the page leads with. */
export default function Image() {
  const b = perpBoard('public');
  const v = b.venue;
  return ogCard({
    section: 'Perps',
    title: perpTitle(b),
    subtitle: 'Hyperliquid perpetuals: open interest, funding, taker flow and a 0–100 Perp Flow Index per coin.',
    stats: [
      { label: 'Open interest', value: v ? usd(v.openInterest) : 'n/a' },
      { label: 'Perp Flow Index', value: v?.ppi != null ? `${num(v.ppi, 0)} · ${band(v.ppi)}` : 'n/a' },
      { label: 'Median funding, yearly', value: v?.fundingMedianApr != null ? pct(v.fundingMedianApr, 1) : 'n/a' },
      { label: 'Coins scored', value: String(b.coins.filter((c) => c.ppi != null).length) },
    ],
  });
}
