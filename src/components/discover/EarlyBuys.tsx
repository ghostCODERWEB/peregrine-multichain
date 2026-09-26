'use client';
import { useMemo, useState } from 'react';
import { lastFill } from '@/components/ui/gridFill';
import Link from 'next/link';
import { TokenLogo, ChainLogo } from '@/components/Logo';
import { AddressLink } from '@/components/entity/AddressLink';
import type { EarlyBuy } from '@/server/alpha/early';
import { chainName, usd } from '@/lib/viz/format';

const ago = (t: number) => { const h = (Date.now() - t) / 3_600_000; return h < 1 ? `${Math.max(1, Math.round(h * 60))}m ago` : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };

type Sort = 'buyers' | 'net' | 'move' | 'recent';
const SORTS: Array<[Sort, string]> = [['buyers', 'SM buyers'], ['net', 'Net bought'], ['move', 'Move since'], ['recent', 'Newest']];
const move = (r: EarlyBuy) => (r.priceAtFirst && r.priceNow ? r.priceNow / r.priceAtFirst - 1 : null);

/** Tokens Smart Money started buying in the last 72 hours, with filters, sorting and paging. */
export function EarlyBuys({ rows: all }: { rows: EarlyBuy[] }) {
  const [chain, setChain] = useState('all');
  const [minBuyers, setMinBuyers] = useState(2);
  const [sort, setSort] = useState<Sort>('buyers');
  const [rising, setRising] = useState(false);
  const [limit, setLimit] = useState(12);
  const chains = useMemo(() => [...new Set(all.map((r) => r.chain))], [all]);
  const filtered = useMemo(() => all
    .filter((r) => (chain === 'all' || r.chain === chain) && r.buyers >= minBuyers && (!rising || (move(r) ?? -1) > 0))
    .sort((a, b) => sort === 'buyers' ? b.buyers - a.buyers : sort === 'net' ? (b.boughtUsd - b.soldUsd) - (a.boughtUsd - a.soldUsd) : sort === 'move' ? (move(b) ?? -9) - (move(a) ?? -9) : b.firstAt - a.firstAt), [all, chain, minBuyers, rising, sort]);
  const rows = filtered.slice(0, limit);
  if (!all.length) return null;
  const chip = (on: boolean) => `rounded-[7px] px-2 py-1 text-[11.5px] font-semibold ${on ? 'bg-ink/12 text-ink' : 'text-ink-muted hover:text-ink'}`;
  return (
    <section aria-labelledby="early" className="material p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="early" className="t-section">Early alpha buys</h2>
        <span className="text-[12px] text-ink-muted">First Smart Money buys in the last 72 hours · {filtered.length} of {all.length} shown by filters</span>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex flex-wrap rounded-[9px] border border-[var(--hair)] p-0.5"><button type="button" onClick={() => setChain('all')} className={chip(chain === 'all')}>All chains</button>{chains.map((c) => <button key={c} type="button" onClick={() => setChain(c)} className={chip(chain === c)}>{chainName(c)}</button>)}</span>
        <span className="inline-flex rounded-[9px] border border-[var(--hair)] p-0.5">{[2, 5, 10, 20].map((n) => <button key={n} type="button" onClick={() => setMinBuyers(n)} className={chip(minBuyers === n)}>{n}+ buyers</button>)}</span>
        <button type="button" aria-pressed={rising} onClick={() => setRising((v) => !v)} className={`rounded-[9px] border border-[var(--hair)] ${chip(rising)}`}>Rising since first buy</button>
        <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-ink-muted">Sort<span className="inline-flex rounded-[9px] border border-[var(--hair)] p-0.5">{SORTS.map(([k, l]) => <button key={k} type="button" onClick={() => setSort(k)} className={chip(sort === k)}>{l}</button>)}</span></span>
        <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-muted">Show<span className="inline-flex rounded-[9px] border border-[var(--hair)] p-0.5">{[12, 24, 999].map((n) => <button key={n} type="button" onClick={() => setLimit(n)} className={chip(limit === n)}>{n === 999 ? 'All' : n}</button>)}</span></span>
      </div>
      {!rows.length && <p className="py-6 text-center text-[12.5px] text-ink-muted">No early buys match these filters.</p>}
      <ol className="stagger grid gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
        {rows.map((r, i) => {
          const mv = move(r);
          const net = r.boughtUsd - r.soldUsd;
          return (
            <li key={`${r.chain}:${r.token}`} className={`bg-[var(--surface-1)] ${lastFill(i, rows.length)}`} data-analyze={JSON.stringify({ kind: 'token', label: `${r.symbol ?? 'Token'} early buy`, href: `/token/${r.chain}/${r.token}`, ...r })}>
              <div className="flex h-full flex-col gap-2 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="num w-5 text-[11px] font-bold text-ink-muted">{i + 1}</span>
                  <span className="relative shrink-0"><TokenLogo symbol={r.symbol} chain={r.chain} address={r.token} size={34} /><span className="absolute -bottom-0.5 -right-0.5 rounded bg-[var(--surface-1)] p-px"><ChainLogo chain={r.chain} size={12} /></span></span>
                  <Link href={`/token/${r.chain}/${encodeURIComponent(r.token)}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-ink hover:underline">{r.symbol ?? r.token.slice(0, 6)}</span>
                    <span className="block text-[11px] text-ink-muted">{chainName(r.chain)} · first SM buy {ago(r.firstAt)}{r.ageDays != null ? ` · ${Math.round(r.ageDays)}d old` : ''}</span>
                  </Link>
                  {mv != null && (
                    <span className="num shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-extrabold" style={{ color: mv >= 0 ? 'var(--mint)' : 'var(--flare)', background: `color-mix(in srgb, ${mv >= 0 ? 'var(--mint)' : 'var(--flare)'} 14%, transparent)` }}>
                      {mv >= 1 ? `${(1 + mv).toFixed(1)}×` : `${mv >= 0 ? '+' : '−'}${Math.abs(mv * 100).toFixed(0)}%`}
                    </span>
                  )}
                </div>
                <div className="num grid grid-cols-3 gap-1 text-[11px]">
                  <span><span className="block text-ink-muted">SM buyers</span><span className="text-[14px] font-bold text-ink">{r.buyers}</span></span>
                  <span><span className="block text-ink-muted">Net bought</span><span className="text-[14px] font-bold" style={{ color: 'var(--mint)' }}>{usd(net)}</span></span>
                  <span><span className="block text-ink-muted">Market cap</span><span className="text-[14px] font-bold text-ink">{usd(r.marketCap)}</span></span>
                </div>
                {r.topBuyer && <p className="mt-auto flex items-center gap-1.5 border-t border-[var(--hair)] pt-2 text-[11.5px] text-ink-2"><span className="text-ink-muted">Largest buyer</span><AddressLink address={r.topBuyer.wallet} label={r.topBuyer.label} compact /><span className="num ml-auto font-semibold text-ink">{usd(r.topBuyer.usd)}</span></p>}
              </div>
            </li>
          );
        })}
      </ol>
      {filtered.length > rows.length && <div className="mt-3 text-center"><button type="button" onClick={() => setLimit((l) => l + 12)} className="pill-button pill-secondary min-h-8 px-4 text-[12.5px]">Show {Math.min(12, filtered.length - rows.length)} more · {filtered.length - rows.length} left</button></div>}
    </section>
  );
}
