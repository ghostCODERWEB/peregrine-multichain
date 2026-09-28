import { ogCard, OG_SIZE } from '@/lib/og/card';
import { storedBoard } from '@/server/predict/board';
import { usd } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'A prediction market on Peregrine: implied probability, volume and the traders behind it';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** One market: its question, implied probability and today's move, when the stored board carries it. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const m = storedBoard()?.markets.find((x) => x.id === id);
  const prob = m?.price != null ? Math.round(m.price * 100) : null;
  const move = m?.change1d != null ? Math.round(m.change1d * 100) : null;
  return ogCard({
    section: 'Prediction market',
    title: m?.question ?? 'A Polymarket market, via Nansen',
    subtitle: m?.eventTitle && m.eventTitle !== m.question ? m.eventTitle : 'Implied probability, repricing, order book and the traders on each side.',
    stats: m ? [
      { label: 'Implied probability', value: prob != null ? `${prob}% YES` : 'n/a', tone: prob == null ? 'plain' : prob >= 50 ? 'up' : 'down' },
      { label: 'Today', value: move != null ? `${move >= 0 ? '+' : '−'}${Math.abs(move)} pts` : 'n/a', tone: move == null || move === 0 ? 'plain' : move > 0 ? 'up' : 'down' },
      { label: '24h volume', value: usd(m.volume24h) },
      { label: 'Open interest', value: usd(m.openInterest) },
    ] : [],
    chips: ['Implied probability', 'Order book', 'Top holders', 'Trades'],
  });
}
