'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CohortBadges } from '@/components/entity/CohortBadges';
import { DataTable } from '@/components/perps/terminal/Panels';
import { num, pct, price, usd } from '@/lib/viz/format';
import type { TraderFill, TraderPerps, TraderPosition } from '@/server/perps/trader';

const pnl = (v: number | null | undefined) => <span style={{ color: v == null ? undefined : v >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(v, { signed: true })}</span>;
const coinLink = (c: string) => <Link prefetch={false} href={`/perps/${encodeURIComponent(c)}`} className="font-semibold text-ink hover:underline hover:underline-offset-2">{c}</Link>;

/** The wallet as a Hyperliquid trader: identity, account, performance, open
 *  positions (each coin opens its terminal) and recent fills. */
export function TraderPanel({ address }: { address: string }) {
  const [d, setD] = useState<TraderPerps | { error: string } | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/perps/trader?address=${address}`, { signal: ac.signal }).then(async (r) => { const j = await r.json(); setD(r.ok ? j : { error: j.error ?? 'Unavailable' }); })
      .catch((e) => { if ((e as Error).name !== 'AbortError') setD({ error: 'Could not reach Nansen.' }); });
    return () => ac.abort();
  }, [address]);

  if (!d) return <section className="material p-5"><div className="h-28 animate-pulse rounded-[10px] bg-ink/5" aria-busy="true" /></section>;
  if ('error' in d) return null;
  const positions = Array.isArray(d.positions) ? d.positions : [];
  const fills = Array.isArray(d.fills) ? d.fills : [];
  const s = 'unavailable' in d.pnl30 ? null : d.pnl30;
  // Not a Hyperliquid trader: nothing open, no fills, no closed trades. Stay out of the way.
  if (!positions.length && !fills.length && !s?.closed_trade_count && !d.seenIn.length) return null;
  const openUsd = positions.reduce((a, p) => a + (p.valueUsd ?? 0), 0);
  const upnl = positions.reduce((a, p) => a + (p.upnlUsd ?? 0), 0);

  const posCols = [
    { key: 'coin', label: 'Coin', sort: (p: TraderPosition) => p.coin, cell: (p: TraderPosition) => coinLink(p.coin) },
    { key: 'side', label: 'Side', sort: (p: TraderPosition) => p.side, cell: (p: TraderPosition) => <span className="font-semibold" style={{ color: p.side === 'long' ? 'var(--mint)' : 'var(--flare)' }}>{p.side === 'long' ? 'Long' : 'Short'}</span> },
    { key: 'value', label: 'Value', right: true, sort: (p: TraderPosition) => p.valueUsd, cell: (p: TraderPosition) => <span className="font-semibold text-ink">{usd(p.valueUsd)}</span> },
    { key: 'lev', label: 'Leverage', right: true, sort: (p: TraderPosition) => p.leverage, cell: (p: TraderPosition) => (p.leverage ? `${num(p.leverage, 0)}x ${p.leverageType ?? ''}` : 'n/a') },
    { key: 'entry', label: 'Entry', right: true, sort: (p: TraderPosition) => p.entry, cell: (p: TraderPosition) => price(p.entry) },
    { key: 'liq', label: 'Liquidation', right: true, sort: (p: TraderPosition) => p.liq, cell: (p: TraderPosition) => price(p.liq) },
    { key: 'upnl', label: 'Unrealized', right: true, sort: (p: TraderPosition) => p.upnlUsd, cell: (p: TraderPosition) => pnl(p.upnlUsd) },
    { key: 'roe', label: 'ROE', right: true, sort: (p: TraderPosition) => p.roe, cell: (p: TraderPosition) => (p.roe == null ? 'n/a' : <span style={{ color: p.roe >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{pct(p.roe, 1)}</span>), title: 'Return on the margin posted' },
    { key: 'margin', label: 'Margin', right: true, sort: (p: TraderPosition) => p.marginUsd, cell: (p: TraderPosition) => usd(p.marginUsd) },
    { key: 'funding', label: 'Funding since open', right: true, sort: (p: TraderPosition) => p.fundingSinceOpenUsd, cell: (p: TraderPosition) => pnl(p.fundingSinceOpenUsd == null ? null : -p.fundingSinceOpenUsd), title: 'Positive: funding received. Negative: paid.' },
  ];
  const fillCols = [
    { key: 'at', label: 'Time (UTC)', sort: (f: TraderFill) => f.at, cell: (f: TraderFill) => <span className="num text-ink-2">{f.at.slice(5, 16).replace('T', ' ')}</span> },
    { key: 'coin', label: 'Coin', sort: (f: TraderFill) => f.coin, cell: (f: TraderFill) => coinLink(f.coin) },
    { key: 'action', label: 'Action', cell: (f: TraderFill) => <span className="text-ink-2">{f.action}</span> },
    { key: 'value', label: 'Value', right: true, sort: (f: TraderFill) => f.valueUsd, cell: (f: TraderFill) => usd(f.valueUsd) },
    { key: 'price', label: 'Price', right: true, sort: (f: TraderFill) => f.price, cell: (f: TraderFill) => price(f.price) },
    { key: 'pnl', label: 'Closed PnL', right: true, sort: (f: TraderFill) => f.closedPnl, cell: (f: TraderFill) => (f.closedPnl ? pnl(f.closedPnl) : <span className="text-ink-muted">n/a</span>) },
    { key: 'fee', label: 'Fee', right: true, sort: (f: TraderFill) => f.feeUsd, cell: (f: TraderFill) => usd(f.feeUsd) },
  ];

  return (
    <section aria-labelledby="hl-trader" className="material rise space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="hl-trader" className="t-section flex items-center gap-2 text-ink">Hyperliquid trader <CohortBadges cohorts={d.cohorts} /></h2>
          {d.label && <p className="mt-0.5 text-[13px] text-ink-2">Nansen label: <span className="font-semibold text-ink">{d.label.replace(/\s*\[[^\]]*\]$/, '')}</span></p>}
        </div>
        {d.seenIn.length > 0 && (
          <p className="text-[12.5px] text-ink-2">
            Seen in Peregrine&apos;s position reads:{' '}
            {d.seenIn.slice(0, 4).map((x, i) => (
              <span key={x.symbol}>{i ? ', ' : ''}<Link prefetch={false} href={`/perps/${encodeURIComponent(x.symbol)}`} className="font-semibold text-ink hover:underline">{x.symbol}</Link> {x.side} {usd(x.valueUsd)} <span className="text-ink-muted">({new Date(x.at).toISOString().slice(5, 16).replace('T', ' ')} UTC)</span></span>
            ))}
          </p>
        )}
      </div>
      <ul className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Account value', usd(d.account?.valueUsd), d.account?.withdrawableUsd != null ? `${usd(d.account.withdrawableUsd)} withdrawable` : ''],
          ['Open positions', usd(openUsd), `${positions.length} coin${positions.length === 1 ? '' : 's'}`],
          ['Unrealized PnL', pnl(upnl), 'across open positions'],
          ['Realized PnL, 30d', s ? pnl(s.realized_pnl_usd) : 'n/a', s ? `${s.closed_trade_count.toLocaleString('en-US')} closed trades` : ''],
          ['Win rate, 30d', s ? pct(s.win_rate, 0) : 'n/a', s ? `${s.winning_trade_count} of ${s.closed_trade_count} closed` : ''],
          ['Fees, 30d', s ? usd(s.fees_usd) : 'n/a', s ? `${s.traded_coin_count} coins traded` : ''],
        ].map(([k, v, note]) => (
          <li key={String(k)} className="min-w-0 bg-[var(--surface-1)] px-3.5 py-2.5">
            <span className="block text-[11.5px] font-semibold text-ink-muted">{k}</span>
            <span className="num mt-0.5 block truncate text-[16px] font-bold tracking-[-0.02em] text-ink">{v}</span>
            <span className="block truncate text-[11.5px] text-ink-2">{note}</span>
          </li>
        ))}
      </ul>
      {s && s.top5_coins.length > 0 && (
        <p className="text-[12.5px] text-ink-2">
          Best coins, 30d:{' '}
          {s.top5_coins.map((c, i) => <span key={c.coin}>{i ? ' · ' : ''}{coinLink(c.coin)} {pnl(c.realized_pnl_usd)} over {c.closed_trade_count} trades</span>)}
        </p>
      )}
      <div>
        <h3 className="mb-2 text-[13.5px] font-bold text-ink">Open positions</h3>
        {'unavailable' in d.positions ? <p className="text-[12.5px] text-ink-muted">{d.positions.unavailable}</p>
          : <DataTable rows={positions} cols={posCols} rowKey={(p) => `${p.coin}:${p.side}`} initialSort={{ key: 'value', dir: -1 }} label="Open Hyperliquid positions" empty="No open positions right now." pageSize={20} />}
      </div>
      <details>
        <summary className="text-[13.5px] font-bold text-ink">Recent fills, 30 days <span className="font-normal text-ink-muted">· {fills.length}</span></summary>
        <div className="mt-2">
          {'unavailable' in d.fills ? <p className="text-[12.5px] text-ink-muted">{d.fills.unavailable}</p>
            : <DataTable rows={fills} cols={fillCols} rowKey={(f) => `${f.tx}:${f.at}:${f.valueUsd}`} initialSort={{ key: 'at', dir: -1 }} label="Recent fills" empty="No fills in 30 days." pageSize={25} />}
        </div>
      </details>
    </section>
  );
}
