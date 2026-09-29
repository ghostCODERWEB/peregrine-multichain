import { ogCard, OG_SIZE } from '@/lib/og/card';
import { perpBoard } from '@/server/perps/board';
import { num, pct, usd } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'A Hyperliquid perp on Peregrine: price, open interest, funding and positioning';
export const size = OG_SIZE;
export const contentType = 'image/png';

const band = (p: number) => (p > 65 ? 'leaning long' : p < 35 ? 'leaning short' : 'balanced');
const price = (v: number | null) => (v == null ? 'n/a' : v >= 1000 ? `$${Math.round(v).toLocaleString('en-US')}` : v >= 1 ? `$${v.toFixed(2)}` : `$${v.toPrecision(3)}`);

/** One perp: its price and move, open interest, funding and Perp Flow Index, from the stored board. */
export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = decodeURIComponent((await params).symbol).toUpperCase().slice(0, 24);
  const c = perpBoard('public').coins.find((x) => x.symbol.toUpperCase() === symbol);
  const name = symbol.replace(/^[^:]+:/, '');
  const move = c?.change24h;
  return ogCard({
    section: 'Perps',
    title: c ? `${name} perp: ${price(c.markPrice)}${move != null ? `, ${move >= 0 ? '+' : '−'}${Math.abs(move * 100).toFixed(1)}% in 24h` : ''}` : `${name} perp on Hyperliquid`,
    subtitle: c?.ppi != null ? `Positioning is ${band(c.ppi)}: liquidation levels, the crowd against smart money, and who holds the book.` : 'Liquidation levels, positioning and who holds the book.',
    stats: c ? [
      { label: 'Open interest', value: usd(c.openInterest) },
      { label: 'Funding, yearly', value: c.fundingApr != null ? pct(c.fundingApr, 1) : 'n/a', tone: c.fundingApr != null && c.fundingApr < 0 ? 'down' : 'plain' },
      { label: 'Perp Flow Index', value: c.ppi != null ? num(c.ppi, 0) : 'n/a' },
      { label: '24h move', value: move != null ? `${move >= 0 ? '+' : '−'}${Math.abs(move * 100).toFixed(1)}%` : 'n/a', tone: move == null ? 'plain' : move >= 0 ? 'up' : 'down' },
    ] : [],
  });
}
