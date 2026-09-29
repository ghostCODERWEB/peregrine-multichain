import { ogCard, OG_SIZE } from '@/lib/og/card';
import { storedBoard } from '@/server/predict/board';
import { num, usd } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Prediction markets on Peregrine: Polymarket flows by category, via Nansen';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Prediction markets: the busiest category against its usual pace and the market totals (stored answers only). */
export default function Image() {
  const b = storedBoard();
  const hot = b?.hottest;
  return ogCard({
    section: 'Predictions',
    title: hot ? `${hot.category} is trading at ${num(hot.heat, 1)}× a normal day` : 'Prediction markets, category by category',
    subtitle: 'Polymarket via Nansen: category activity against its weekly pace, the biggest repricings and the traders behind them.',
    stats: b ? [
      { label: 'Open interest', value: usd(b.totals.openInterest) },
      { label: '24h volume', value: usd(b.totals.volume24h) },
      { label: 'Active markets', value: b.totals.activeMarkets.toLocaleString('en-US') },
      { label: 'Traders, 24h', value: b.totals.traders24h.toLocaleString('en-US') },
    ] : [],
    chips: ['Category heat', 'Repricings', 'Busiest events', 'Top traders'],
  });
}
