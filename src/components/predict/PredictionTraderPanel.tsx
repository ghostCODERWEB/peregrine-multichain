'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { pct, usd } from '@/lib/viz/format';
import type { PmTrader } from '@/server/predict/trader';

const tone = (v: number | null) => ({ color: v == null ? undefined : v >= 0 ? 'var(--mint)' : 'var(--flare)' });

/** The wallet on Polymarket: lifetime record, best and worst markets, recent trades. Hidden when it has none. */
export function PredictionTraderPanel({ address }: { address: string }) {
  const [d, setD] = useState<PmTrader | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/predict/trader?address=${address}`, { signal: ac.signal }).then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {});
    return () => ac.abort();
  }, [address]);
  if (!d || (!d.summary?.marketsTraded && !d.markets.length && !d.trades.length)) return null;
  const best = d.markets.filter((m) => (m.pnlUsd ?? 0) > 0).slice(0, 5);
  const worst = [...d.markets].filter((m) => (m.pnlUsd ?? 0) < 0).sort((a, b) => (a.pnlUsd ?? 0) - (b.pnlUsd ?? 0)).slice(0, 5);
  const mk = (m: { id: string | null; question: string }) => (m.id ? <Link href={`/predict/${encodeURIComponent(m.id)}`} className="truncate text-ink hover:underline">{m.question}</Link> : <span className="truncate text-ink">{m.question}</span>);
  const list = (xs: typeof best) => (
    <ol className="divide-y divide-[var(--hair)]">
      {xs.map((m, i) => <li key={`${m.id}:${i}`} className="flex items-center gap-2 py-1.5 text-[12.5px]"><span className="min-w-0 flex-1 truncate">{mk(m)}</span><span className="text-ink-muted">{m.side ?? ''}{m.resolved ? ' · resolved' : ''}</span><span className="num w-20 text-right font-semibold" style={tone(m.pnlUsd)}>{usd(m.pnlUsd, { signed: true })}</span></li>)}
      {!xs.length && <li className="py-2 text-[12.5px] text-ink-muted">None.</li>}
    </ol>
  );
  return (
    <section aria-labelledby="pm-trader" className="material rise space-y-4 p-4 sm:p-5">
      <h2 id="pm-trader" className="t-section">Polymarket trader</h2>
      <ul className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] lg:grid-cols-4">
        {[['Realized PnL', <span key="r" style={tone(d.summary?.realizedUsd ?? null)}>{usd(d.summary?.realizedUsd, { signed: true })}</span>, 'lifetime'], ['Unrealized PnL', <span key="u" style={tone(d.summary?.unrealizedUsd ?? null)}>{usd(d.summary?.unrealizedUsd, { signed: true })}</span>, 'open positions'], ['Markets traded', d.summary?.marketsTraded?.toLocaleString('en-US') ?? 'n/a', 'lifetime'], ['Win rate', pct(d.summary?.winRate, 0), 'resolved markets']].map(([k, v, note]) => (
          <li key={String(k)} className="bg-[var(--surface-1)] px-3.5 py-2.5"><span className="block text-[11.5px] font-semibold text-ink-muted">{k}</span><span className="num block text-[16px] font-bold text-ink">{v}</span><span className="block text-[11.5px] text-ink-2">{note}</span></li>
        ))}
      </ul>
      <div className="grid gap-4 lg:grid-cols-2">
        <div><h3 className="mb-1 text-[12.5px] font-semibold text-ink-muted">Best markets</h3>{list(best)}</div>
        <div><h3 className="mb-1 text-[12.5px] font-semibold text-ink-muted">Worst markets</h3>{list(worst)}</div>
      </div>
      {d.trades.length > 0 && (
        <details>
          <summary className="text-[13px] font-bold text-ink">Trades, 30 days <span className="font-normal text-ink-muted">· {d.trades.length}</span></summary>
          <ol className="mt-2 max-h-[280px] divide-y divide-[var(--hair)] overflow-auto" tabIndex={0} aria-label="Polymarket trades">
            {d.trades.map((t, i) => <li key={i} className="flex items-center gap-2 py-1.5 text-[12.5px]"><span className="num w-[86px] shrink-0 text-ink-muted">{t.at?.slice(5, 16).replace('T', ' ') ?? ''}</span><span className="w-24 shrink-0 font-semibold text-ink">{[t.action, t.side].filter(Boolean).join(' ')}</span><span className="min-w-0 flex-1 truncate">{mk(t)}</span><span className="num w-20 text-right text-ink">{usd(t.usd)}</span></li>)}
          </ol>
        </details>
      )}
      <p className="text-[11px] text-ink-muted">{d.errors.length ? ` Partial: ${d.errors.join(' · ')}` : ''}</p>
    </section>
  );
}
