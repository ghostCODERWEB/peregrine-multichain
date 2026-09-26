import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PerpsTerminal } from '@/components/perps/terminal/PerpsTerminal';
import { SYMBOL_RE } from '@/server/perps/detail';
import { perpBoard } from '@/server/perps/board';
import { displayMode, viewOf } from '@/server/mode';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  return { title: `${decodeURIComponent((await params).symbol).toUpperCase()} Perps · Peregrine` };
}

export default async function PerpTerminalPage({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = decodeURIComponent((await params).symbol).toUpperCase();
  if (!SYMBOL_RE.test(symbol)) notFound();
  const mode = await displayMode();
  // The coin switcher: the board's coins by open interest (stored snapshots, no Nansen call).
  const coins = [...perpBoard(viewOf(mode)).coins].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0)).slice(0, 60).map((c) => c.symbol);
  return (
    <Suspense>
      <PerpsTerminal symbol={symbol} coins={coins.length ? coins : ['BTC', 'ETH', 'SOL', 'HYPE']} owner={mode !== 'public'} />
    </Suspense>
  );
}
