'use client';
import { useEffect, useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import { num, usd } from '@/lib/viz/format';
import type { RideEligibility, RideQuote } from '@/server/agents/ride';
import type { Provenance } from '@/lib/provenance';

/** What it would cost to follow this tide: a USDC quote from Nansen's
 *  trade/quote, shown only when the chain's pressure is high and the
 *  token's Storm Score is low. Quote only, never a trade. */
export function RideCard({ chain, address, symbol }: { chain: string; address: string; symbol: string | null }) {
  const [elig, setElig] = useState<RideEligibility | null>(null);
  const [amount, setAmount] = useState(100);
  const [quotes, setQuotes] = useState<RideQuote[] | null>(null);
  const [prov, setProv] = useState<Provenance | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/ride?chain=${chain}&address=${encodeURIComponent(address)}`;

  useEffect(() => { fetch(base).then((r) => r.json()).then((d: { eligibility?: RideEligibility }) => setElig(d.eligibility ?? null)).catch(() => {}); }, [base]);

  async function quote() {
    setBusy(true); setErr(null);
    const d = (await fetch(`${base}&quote=1&usd=${amount}`).then((r) => r.json())) as { quotes?: RideQuote[]; provenance?: Provenance | null; error?: string };
    setBusy(false);
    if (d.error) { setErr(d.error); return; }
    setQuotes(d.quotes ?? []); setProv(d.provenance ?? null);
  }

  if (!elig) return null;
  if (!elig.eligible) return <p className="text-[12.5px] text-ink-muted">Ride the tide: {elig.reason}</p>;
  const best = quotes?.[0];
  return (
    <div className="space-y-2 text-[12.5px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-ink-2">{elig.reason}</span>
        {prov && <InfoPopover p={prov} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-ink-2" htmlFor="ride-amt">Price</label>
        <input id="ride-amt" type="number" min={5} max={10000} value={amount} onChange={(e) => setAmount(Number(e.target.value))}
          className="num w-24 rounded-md border border-border bg-surface px-2 py-1 text-ink" />
        <span className="text-ink-2">USDC into {symbol ?? 'this token'}</span>
        <button onClick={quote} disabled={busy} className="rounded-md border border-border px-2.5 py-1 text-ink hover:bg-accent disabled:opacity-50">{busy ? 'Quoting…' : 'Get quote'}</button>
      </div>
      {best && (
        <p className="text-ink">
          <span className="num">{usd(best.inUsd)}</span> USDC buys about <span className="num">{usd(best.outUsd)}</span> of {symbol} via {best.aggregator}:
          following this flow costs <span className="num">{usd(best.inUsd - best.outUsd)}</span> ({num(best.priceImpactPct, 2)}% price impact, fees {usd(best.tradingFeeUsd)} + network {usd(best.networkFeeUsd)}).
        </p>
      )}
      {quotes && !quotes.length && <p className="text-ink-2">Nansen found no route for this pair right now.</p>}
      {err && <p className="text-ink-2">{err}</p>}
      <p className="text-[11.5px] text-ink-muted">Quote only. Peregrine never signs or executes trades. Not financial advice.</p>
    </div>
  );
}
