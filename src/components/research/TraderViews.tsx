'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { MiniLines } from '@/components/charts/Mini';
import { AddressLink } from '@/components/entity/AddressLink';
import { pct, usd } from '@/lib/viz/format';
import type { TraderWorkspace } from '@/server/research/hyperliquid';
import { toggleWatch, watched, type Watched } from './watchlist';

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const tone = (v: number | null | undefined) => ({ color: (v ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' });
const sgn = (v: number | null | undefined) => (v == null ? 'n/a' : usd(v, { signed: true }));

function useTraders(addresses: string[]) {
  const [data, setData] = useState<Record<string, TraderWorkspace | { error: string }>>({});
  const key = addresses.join(',');
  useEffect(() => {
    let live = true;
    for (const a of addresses) {
      if (data[a]) continue;
      fetch(`/api/research/trader?address=${a}`).then((r) => r.json()).then((x) => { if (live) setData((cur) => ({ ...cur, [a]: x.error ? { error: x.error } : x })); }).catch(() => live && setData((cur) => ({ ...cur, [a]: { error: 'Could not load.' } })));
    }
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch only when the address set changes
  }, [key]);
  return data;
}
const P = (d: TraderWorkspace) => (Array.isArray(d.positions) ? d.positions : []);
const hist = (d: TraderWorkspace, r: 'day' | 'week' | 'month') => ('day' in d.history ? d.history[r] : null);
const change = (s: Array<{ v: number }> | undefined) => (s && s.length > 1 ? s.at(-1)!.v - s[0].v : null);

function AddBox({ onAdd, label }: { onAdd: (a: string) => void; label: string }) {
  const [v, setV] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ADDR.test(v.trim())) { onAdd(v.trim()); setV(''); } }} className="flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="0x… Hyperliquid address" aria-label="Hyperliquid address" className="inset-well h-9 min-w-0 flex-1 rounded-[10px] px-3 font-mono text-[12.5px] text-ink" />
      <button type="submit" disabled={!ADDR.test(v.trim())} className="pill-button pill-primary min-h-9 px-4 text-[12.5px] disabled:opacity-40">{label}</button>
    </form>
  );
}

/** Watched Hyperliquid traders with their live state (analysis only). */
export function WatchlistView() {
  const [list, setList] = useState<Watched[]>([]);
  useEffect(() => { const load = () => setList(watched()); load(); window.addEventListener('peregrine:watch', load); return () => window.removeEventListener('peregrine:watch', load); }, []);
  const data = useTraders(list.map((w) => w.address));
  return (
    <div className="space-y-3">
      <div className="material flex flex-wrap items-center gap-3 p-3.5">
        <p className="text-[12.5px] text-ink-2">{list.length} watched trader{list.length === 1 ? '' : 's'} · saved in this browser · positions refresh on open</p>
        <div className="ml-auto w-full max-w-[520px]"><AddBox label="Watch" onAdd={(a) => { toggleWatch(a, null); setList(watched()); }} /></div>
      </div>
      {!list.length && <p className="material p-4 text-[13px] text-ink-muted">No watched traders yet. Add an address above, or use Watch trader on any Profiler page.</p>}
      {list.length > 0 && (
        <div className="material overflow-x-auto p-3.5">
          <table className="w-full min-w-[980px] text-[12.5px]">
            <thead className="text-[10.5px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 text-left font-normal">Trader</th><th className="text-left font-normal">Equity, 7D</th><th className="text-right font-normal">Equity</th><th className="text-right font-normal">24H PnL</th><th className="text-right font-normal">30D PnL</th><th className="text-right font-normal">Open</th><th className="text-left font-normal">Largest position</th><th className="text-right font-normal">Net exposure</th><th className="text-left font-normal">Latest change</th><th /></tr></thead>
            <tbody>
              {list.map((w) => {
                const d = data[w.address];
                const ok = d && !('error' in d);
                const last = ok ? d.events.at(-1) : null;
                const fresh = last && Date.now() - last.t < 6 * 3.6e6;
                return (
                  <tr key={w.address} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                    <td className="py-2"><AddressLink address={w.address} label={ok ? d.label : w.label} /></td>
                    <td className="w-[110px]">{ok && hist(d, 'week') ? <MiniLines height={24} label="Equity over 7 days" series={[{ values: hist(d, 'week')!.value.map((x) => x.v), color: 'var(--signal)' }]} /> : <span className="text-ink-muted">{d ? '' : '…'}</span>}</td>
                    <td className="num text-right text-ink">{ok ? usd(d.account?.valueUsd) : d ? 'n/a' : '…'}</td>
                    <td className="num text-right" style={tone(ok ? change(hist(d, 'day')?.pnl) : 0)}>{ok ? sgn(change(hist(d, 'day')?.pnl)) : ''}</td>
                    <td className="num text-right" style={tone(ok ? change(hist(d, 'month')?.pnl) : 0)}>{ok ? sgn(change(hist(d, 'month')?.pnl)) : ''}</td>
                    <td className="num text-right text-ink-2">{ok ? P(d).length : ''}</td>
                    <td className="text-ink-2">{ok && P(d)[0] ? <span><b className="text-ink">{P(d)[0].coin}</b> <span style={{ color: P(d)[0].side === 'long' ? 'var(--mint)' : 'var(--flare)' }}>{P(d)[0].side}</span> {usd(P(d)[0].valueUsd)}</span> : ''}</td>
                    <td className="num text-right" style={tone(ok ? d.exposure.netUsd : 0)}>{ok ? sgn(d.exposure.netUsd) : ''}</td>
                    <td className="text-ink-2">{last ? <span className={fresh ? 'rounded bg-[color-mix(in_srgb,var(--amber)_16%,transparent)] px-1.5 py-0.5 font-semibold text-ink' : ''}>{last.kind} {last.coin} {usd(last.notional)} · {Math.max(1, Math.round((Date.now() - last.t) / 3.6e6))}h ago</span> : ''}</td>
                    <td className="text-right"><button type="button" aria-label={`Stop watching ${w.address}`} onClick={() => { toggleWatch(w.address, null); setList(watched()); }} className="grid h-6 w-6 place-items-center rounded hover:bg-ink/10"><X className="h-3.5 w-3.5" aria-hidden /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Two to four public Hyperliquid traders side by side: equity paths, exposure, performance and positions. */
export function CompareView() {
  const params = useSearchParams();
  const router = useRouter();
  const c = useThemeColors();
  const addrs = useMemo(() => ['a', 'b', 'c', 'd'].map((k) => params.get(k) ?? '').filter((a) => ADDR.test(a)), [params]);
  const data = useTraders(addrs);
  const set = (next: string[]) => router.replace(`/wallet/compare?${next.slice(0, 4).map((a, i) => `${'abcd'[i]}=${a}`).join('&')}`);
  const loaded = addrs.map((a) => ({ a, d: data[a] })).filter((x): x is { a: string; d: TraderWorkspace } => !!x.d && !('error' in x.d));
  const palette = c ? [c.mint, c.signal, c.amber, c.violet] : [];
  const equity = c && loaded.length ? {
    animationDuration: 400, grid: { left: 50, right: 12, top: 12, bottom: 26 },
    tooltip: { trigger: 'axis', backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 }, valueFormatter: (v: unknown) => `${Number(v).toFixed(1)}%` },
    xAxis: { type: 'time', axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c['ink-muted'], fontSize: 10 }, splitLine: { show: false } },
    yAxis: { type: 'value', axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: '{value}%' }, splitLine: { lineStyle: { color: c.grid } } },
    series: loaded.map(({ d }, i) => { const v = hist(d, 'month')?.value ?? []; const base = v.find((x) => x.v > 0)?.v ?? 1; return { name: d.label ?? d.address.slice(0, 8), type: 'line', showSymbol: false, data: v.map((x) => [x.t, (x.v / base - 1) * 100]), lineStyle: { width: 1.8, color: palette[i] }, itemStyle: { color: palette[i] } }; }),
  } : null;
  const rows: Array<[string, (d: TraderWorkspace) => string, ((d: TraderWorkspace) => number | null)?]> = [
    ['Equity', (d) => usd(d.account?.valueUsd)],
    ['30D PnL', (d) => sgn(change(hist(d, 'month')?.pnl)), (d) => change(hist(d, 'month')?.pnl)],
    ['30D equity change', (d) => { const v = hist(d, 'month')?.value; return v && v.length > 1 && v[0].v ? pct(v.at(-1)!.v / v[0].v - 1, 1) : 'n/a'; }],
    ['Max drawdown, 30D', (d) => { const v = hist(d, 'month')?.value ?? []; let pk = 0, dd = 0; for (const x of v) { pk = Math.max(pk, x.v); if (pk) dd = Math.min(dd, x.v / pk - 1); } return v.length ? pct(dd, 1) : 'n/a'; }],
    ['Realized, rebuilt trades', (d) => sgn(d.stats?.realizedPnl), (d) => d.stats?.realizedPnl ?? null],
    ['Win rate', (d) => (d.stats?.winRate != null ? pct(d.stats.winRate, 0) : 'n/a')],
    ['Profit factor', (d) => (d.stats?.profitFactor != null ? d.stats.profitFactor.toFixed(2) : 'n/a')],
    ['Round trips', (d) => String(d.closed.length)],
    ['Average hold', (d) => (d.stats?.avgHoldHours != null ? `${d.stats.avgHoldHours.toFixed(1)}h` : 'n/a')],
    ['Open positions', (d) => String(P(d).length)],
    ['Long / short', (d) => `${usd(d.exposure.longUsd)} / ${usd(d.exposure.shortUsd)}`],
    ['Net exposure', (d) => sgn(d.exposure.netUsd), (d) => d.exposure.netUsd],
    ['Margin usage', (d) => pct(d.exposure.marginUsage, 0)],
    ['Largest position', (d) => (P(d)[0] ? `${P(d)[0].coin} ${P(d)[0].side} ${usd(P(d)[0].valueUsd)}` : 'none')],
    ['Top 3 share of exposure', (d) => (d.exposure.grossUsd ? pct(P(d).slice(0, 3).reduce((a, p) => a + (p.valueUsd ?? 0), 0) / d.exposure.grossUsd, 0) : 'n/a')],
    ['Fills, 30D', (d) => String(d.events.length)],
  ];
  return (
    <div className="space-y-3">
      <div className="material flex flex-wrap items-center gap-2 p-3.5">
        {addrs.map((a, i) => <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hair)] py-0.5 pl-2 pr-1 text-[12px]"><span className="h-2 w-2 rounded-full" style={{ background: palette[i] }} /><AddressLink address={a} label={data[a] && !('error' in data[a]) ? (data[a] as TraderWorkspace).label : null} compact /><button type="button" aria-label="Remove" onClick={() => set(addrs.filter((x) => x !== a))} className="grid h-5 w-5 place-items-center rounded hover:bg-ink/10"><X className="h-3 w-3" aria-hidden /></button></span>)}
        {addrs.length < 4 && <div className="ml-auto w-full max-w-[460px]"><AddBox label="Add trader" onAdd={(a) => set([...addrs, a])} /></div>}
        {!addrs.length && watched().length > 1 && <button type="button" onClick={() => set(watched().slice(0, 4).map((w) => w.address))} className="text-[12.5px] font-semibold text-brand">Compare my watchlist</button>}
      </div>
      {addrs.length < 2 && <p className="material p-4 text-[13px] text-ink-muted">Add at least two Hyperliquid addresses to compare.</p>}
      {addrs.length > 0 && loaded.length < addrs.length && <div className="h-40 animate-pulse rounded-[var(--r-card)] bg-ink/5" />}
      {loaded.length > 1 && (
        <>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="material p-3.5"><h3 className="mb-1 text-[13px] font-bold text-ink">Equity, 30D, indexed</h3>{equity && <EChart option={equity as never} height={280} ariaLabel="Equity paths indexed to the start of the month" />}</div>
            <div className="material p-3.5">
              <h3 className="mb-2 text-[13px] font-bold text-ink">Exposure</h3>
              <ul className="space-y-3">
                {loaded.map(({ d }, i) => { const g = Math.max(1, ...loaded.map((x) => x.d.exposure.grossUsd)); return (
                  <li key={d.address} className="text-[12px]">
                    <p className="mb-1 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: palette[i] }} /><span className="font-semibold text-ink">{d.label ?? `${d.address.slice(0, 6)}…${d.address.slice(-4)}`}</span><span className="num ml-auto text-ink-muted">{usd(d.exposure.grossUsd)} gross</span></p>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--hair)]" style={{ width: `${Math.max(6, (d.exposure.grossUsd / g) * 100)}%` }}><span style={{ width: `${d.exposure.grossUsd ? (d.exposure.longUsd / d.exposure.grossUsd) * 100 : 0}%`, background: 'var(--mint)' }} /><span className="flex-1" style={{ background: 'var(--flare)' }} /></div>
                  </li>
                ); })}
              </ul>
            </div>
          </div>
          <div className="material overflow-x-auto p-3.5">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead><tr><th className="py-1.5 text-left text-[10.5px] font-normal uppercase tracking-wider text-ink-muted">Measure</th>{loaded.map(({ d }, i) => <th key={d.address} className="text-right text-[12px] font-semibold" style={{ color: palette[i] }}><Link href={`/wallet/${d.address}`} className="hover:underline">{d.label ?? `${d.address.slice(0, 6)}…${d.address.slice(-4)}`}</Link></th>)}</tr></thead>
              <tbody>{rows.map(([k, f, t]) => <tr key={k} className="border-t border-[var(--hair)]"><td className="py-1.5 text-ink-muted">{k}</td>{loaded.map(({ d }) => <td key={d.address} className="num text-right text-ink" style={t ? tone(t(d)) : undefined}>{f(d)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
