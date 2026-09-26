import Link from 'next/link';
import { TokenLogo, ChainLogo } from '@/components/Logo';
import { AddressLink } from '@/components/entity/AddressLink';
import type { EarlyBuy } from '@/server/alpha/early';
import { chainName, usd } from '@/lib/viz/format';

const ago = (t: number) => { const h = (Date.now() - t) / 3_600_000; return h < 1 ? `${Math.max(1, Math.round(h * 60))}m ago` : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`; };

/** Tokens Smart Money started buying in the last 72 hours, most Smart Money buyers first. */
export function EarlyBuys({ rows }: { rows: EarlyBuy[] }) {
  if (!rows.length) return null;
  return (
    <section aria-labelledby="early" className="material p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="early" className="t-section">Early alpha buys</h2>
        <span className="text-[12px] text-ink-muted">First Smart Money buys in the last 72 hours · most Smart Money buyers first</span>
      </div>
      <ol className="stagger grid gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4">
        {rows.map((r, i) => {
          const move = r.priceAtFirst && r.priceNow ? r.priceNow / r.priceAtFirst - 1 : null;
          const net = r.boughtUsd - r.soldUsd;
          return (
            <li key={`${r.chain}:${r.token}`} className="bg-[var(--surface-1)]" data-analyze={JSON.stringify({ kind: 'token', label: `${r.symbol ?? 'Token'} early buy`, href: `/token/${r.chain}/${r.token}`, ...r })}>
              <div className="flex h-full flex-col gap-2 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="num w-5 text-[11px] font-bold text-ink-muted">{i + 1}</span>
                  <span className="relative shrink-0"><TokenLogo symbol={r.symbol} chain={r.chain} address={r.token} size={34} /><span className="absolute -bottom-0.5 -right-0.5 rounded bg-[var(--surface-1)] p-px"><ChainLogo chain={r.chain} size={12} /></span></span>
                  <Link href={`/token/${r.chain}/${encodeURIComponent(r.token)}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-ink hover:underline">{r.symbol ?? r.token.slice(0, 6)}</span>
                    <span className="block text-[11px] text-ink-muted">{chainName(r.chain)} · first SM buy {ago(r.firstAt)}{r.ageDays != null ? ` · ${Math.round(r.ageDays)}d old` : ''}</span>
                  </Link>
                  {move != null && (
                    <span className="num shrink-0 rounded-full px-2 py-0.5 text-[12.5px] font-extrabold" style={{ color: move >= 0 ? 'var(--mint)' : 'var(--flare)', background: `color-mix(in srgb, ${move >= 0 ? 'var(--mint)' : 'var(--flare)'} 14%, transparent)` }}>
                      {move >= 1 ? `${(1 + move).toFixed(1)}×` : `${move >= 0 ? '+' : '−'}${Math.abs(move * 100).toFixed(0)}%`}
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
    </section>
  );
}
