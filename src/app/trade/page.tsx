import type { Metadata } from 'next';
import Link from 'next/link';
import { displayMode } from '@/server/mode';
import { tradingEnabled } from '@/server/trade/spot';
import { SpotTrade } from '@/components/trade/SpotTrade';
import { PerpTrade } from '@/components/trade/PerpTrade';
import { perpBoard } from '@/server/perps/board';
import { viewOf } from '@/server/mode';

export const metadata: Metadata = { title: 'Trade — Peregrine' };
export const dynamic = 'force-dynamic';

export default async function TradePage({ searchParams }: { searchParams: Promise<{ token?: string; coin?: string; venue?: string }> }) {
  const mode = await displayMode();
  const sp = await searchParams;
  const token = sp.token ?? '';
  const venue = sp.venue === 'perps' || sp.coin ? 'perps' : 'spot';
  const off = !tradingEnabled() ? 'Trading is off on this instance. Its operator turns it on with FEATURE_TRADING=1.'
    : mode === 'public' ? 'Trading runs on a Nansen key: this instance owner’s, or yours once you sign in with it.' : null;
  return (
    <div className="space-y-4">
      <section aria-labelledby="trade-title" className="glass rise rounded-2xl p-4 sm:p-6">
        <div className="text-[12px] text-ink-muted">Nansen trading · Base + Solana</div>
        <h1 id="trade-title" className="mt-1 text-lg font-semibold text-ink sm:text-xl">Swap with Peregrine&apos;s signals in view</h1>
        <p className="mt-1 max-w-3xl text-[13.5px] text-ink-2">
          Nansen finds the route and builds the transaction, and simulates it before you sign. You sign each step in your own wallet; Peregrine never holds keys,
          never signs, and never sends a transaction for you. Trading spends no Nansen credits: you pay only the route and network fees shown.
        </p>
      </section>
      {off ? <p className="glass rounded-2xl p-4 text-sm text-ink-2">{off} {mode === 'public' && <Link href="/account" className="text-ink underline-offset-2 hover:underline">Sign in</Link>}</p> : (
        <>
          <nav aria-label="Venue" className="glass inline-flex gap-1 rounded-full p-1">
            <Link href="/trade" aria-current={venue === 'spot' ? 'page' : undefined} className={`rounded px-3.5 py-1.5 text-[13px] ${venue === 'spot' ? 'bg-brand/15 font-medium text-ink ring-1 ring-brand/40' : 'text-ink-2'}`}>Spot · Base + Solana</Link>
            <Link href="/trade?venue=perps" aria-current={venue === 'perps' ? 'page' : undefined} className={`rounded px-3.5 py-1.5 text-[13px] ${venue === 'perps' ? 'bg-brand/15 font-medium text-ink ring-1 ring-brand/40' : 'text-ink-2'}`}>Perps · Hyperliquid</Link>
          </nav>
          {venue === 'spot' ? <SpotTrade initialToken={token} /> : (
            <PerpTrade initialCoin={sp.coin ?? ''} marks={perpBoard(viewOf(mode)).coins.slice(0, 150).map((c) => ({ symbol: c.symbol, mark: c.markPrice, ppi: c.ppi, fundingApr: c.fundingApr }))} />
          )}
        </>
      )}
    </div>
  );
}
