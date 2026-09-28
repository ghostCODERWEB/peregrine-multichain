import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PerpsTerminal } from '@/components/perps/terminal/PerpsTerminal';
import { SYMBOL_RE } from '@/server/perps/detail';
import { perpBoard } from '@/server/perps/board';
import { displayMode, viewOf } from '@/server/mode';
import { positioningSeries } from '@/server/graph/series';
import { pageMeta } from '@/server/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const symbol = decodeURIComponent((await params).symbol).toUpperCase();
  const name = symbol.replace(/^[^:]+:/, '');
  return pageMeta({ title: `${name} perp: liquidation map and positioning`, description: `${name} on Hyperliquid: liquidation levels, who holds the book, the crowd against smart money, funding and open interest.`, path: `/perps/${encodeURIComponent(symbol)}` });
}

export default async function PerpTerminalPage({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = decodeURIComponent((await params).symbol).toUpperCase();
  if (!SYMBOL_RE.test(symbol)) notFound();
  const mode = await displayMode();
  // The coin switcher: the board's coins by open interest (stored snapshots, no Nansen call).
  const board = [...perpBoard(viewOf(mode)).coins].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0));
  // A coin Hyperliquid does not list answers 404 rather than an empty terminal (with no snapshot yet, any valid symbol passes).
  if (board.length && !board.some((c) => c.symbol.toUpperCase() === symbol)) notFound();
  const coins = board.slice(0, 60).map((c) => c.symbol);
  return (
    <Suspense fallback={<p className="material p-5 text-[13px] text-ink-muted">Opening the {symbol} terminal…</p>}>
      <PerpsTerminal symbol={symbol} coins={coins.length ? coins : ['BTC', 'ETH', 'SOL', 'HYPE']} owner={mode !== 'public'} positioning={mode !== 'public' ? positioningSeries(symbol) : []} />
    </Suspense>
  );
}
