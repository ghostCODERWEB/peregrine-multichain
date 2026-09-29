'use client';
import { ArrowUpRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, GitCompare } from 'lucide-react';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { TokenLogo } from '@/components/Logo';
import { hyperliquidTrade } from '@/config/external';
import { pct, usd } from '@/lib/viz/format';
import type { ClosedPosition, Position, TraderWorkspace } from '@/server/research/hyperliquid';
import { LiqDistance, PositionChart, fmtPx } from './PositionChart';
import { isWatched, toggleWatch } from './watchlist';
import { activateProps } from '@/components/ui/activate';

const tone = (v: number | null | undefined) => ({ color: (v ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' });
const sgn = (v: number | null | undefined) => (v == null ? 'n/a' : usd(v, { signed: true }));
const dur = (ms: number) => { const h = ms / 3.6e6; return h < 1 ? `${Math.round(h * 60)}m` : h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`; };
const ago = (t: number | null) => (t == null ? 'n/a' : `${dur(Date.now() - t)} ago`);

function Metric({ k, v, note, style }: { k: string; v: string; note?: string; style?: React.CSSProperties }) {
  return <li className="min-w-0 bg-[var(--surface-1)] px-3 py-2"><span className="block truncate text-[11px] font-semibold text-ink-muted">{k}</span><span className="num block truncate text-[16px] font-bold text-ink" style={style}>{v}</span>{note && <span className="block truncate text-[10.5px] text-ink-2">{note}</span>}</li>;
}

/** The Profiler's Hyperliquid trader workspace for any public address: analysis only, never copying trades. */
export function HyperliquidWorkspace({ address }: { address: string }) {
  const [d, setD] = useState<TraderWorkspace | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<{ kind: 'open'; p: Position } | { kind: 'closed'; p: ClosedPosition } | null>(null);
  const [watch, setWatch] = useState(false);
  useEffect(() => { setWatch(isWatched(address)); }, [address]);
  useEffect(() => {
    let live = true;
    setD(null); setErr(''); setSel(null);
    fetch(`/api/research/trader?address=${address}`).then((r) => r.json()).then((x) => { if (!live) return; if (x.error) setErr(x.error); else { setD(x); const P = Array.isArray(x.positions) ? x.positions : []; if (P[0]) setSel({ kind: 'open', p: P[0] }); else if (x.closed?.[0]) setSel({ kind: 'closed', p: x.closed[0] }); } })
      .catch(() => live && setErr('Could not reach the server.'));
    return () => { live = false; };
  }, [address]);

  if (err) return <section className="material p-4 text-[13px] text-ink-2">{err}</section>;
  if (!d) return <section className="material space-y-3 p-4" aria-busy><div className="h-5 w-56 animate-pulse rounded bg-ink/8" /><div className="grid grid-cols-4 gap-2 lg:grid-cols-8">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-14 animate-pulse rounded bg-ink/6" />)}</div><div className="h-[320px] animate-pulse rounded bg-ink/5" /></section>;
  const P = Array.isArray(d.positions) ? d.positions : [];
  const active = !!P.length || d.events.length > 0 || (d.account?.valueUsd ?? 0) > 0;
  if (!active) return null;
  const s = d.stats, x = d.exposure;
  return (
    <section aria-labelledby="hl" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="hl" className="t-section">Hyperliquid trader</h2>
        {d.label && <span className="rounded-[6px] bg-ink/8 px-2 py-0.5 text-[11.5px] font-semibold text-ink-2">{d.label}</span>}
        <span className="num text-[11px] text-ink-muted">positions and labels: Nansen · history and fills: Hyperliquid · updated {ago(d.at)}</span>
        <span className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setWatch(toggleWatch(address, d.label))} aria-pressed={watch} className="pill-button pill-secondary min-h-8 px-3 text-[12px]">{watch ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}{watch ? 'Watching' : 'Watch trader'}</button>
          <Link prefetch={false} href={`/wallet?a=${address}#compare`} className="pill-button pill-secondary min-h-8 px-3 text-[12px]"><GitCompare className="h-3.5 w-3.5" aria-hidden />Compare</Link>
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-4 xl:grid-cols-8">
        <Metric k="Account equity" v={usd(d.account?.valueUsd)} note={d.account?.withdrawableUsd != null ? `withdrawable ${usd(d.account.withdrawableUsd)}` : undefined} />
        <Metric k="Unrealized PnL" v={sgn(x.upnlUsd)} style={tone(x.upnlUsd)} note={`${P.length} open positions`} />
        <Metric k="Long exposure" v={usd(x.longUsd)} style={{ color: 'var(--mint)' }} />
        <Metric k="Short exposure" v={usd(x.shortUsd)} style={{ color: 'var(--flare)' }} />
        <Metric k="Net exposure" v={sgn(x.netUsd)} style={tone(x.netUsd)} note={d.account?.valueUsd ? `${(x.grossUsd / d.account.valueUsd).toFixed(1)}× gross leverage` : undefined} />
        <Metric k="Margin usage" v={pct(x.marginUsage, 0)} style={{ color: (x.marginUsage ?? 0) > 0.8 ? 'var(--flare)' : undefined }} />
        <Metric k="Realized, 30d" v={sgn(d.nansen30d?.realizedPnl)} style={tone(d.nansen30d?.realizedPnl)} note={d.nansen30d?.trades != null ? `${d.nansen30d.trades} closed trades (Nansen)` : undefined} />
        <Metric k="Win rate" v={s?.winRate != null ? pct(s.winRate, 0) : d.nansen30d?.winRate != null ? pct(d.nansen30d.winRate, 0) : 'n/a'} note={s?.closedTrades ? `${s.closedTrades} rebuilt round trips` : '30d, Nansen'} />
      </ul>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <EquityChart d={d} />
        <PositionsTable d={d} sel={sel} onSel={setSel} />
      </div>

      {sel && <PositionDetail d={d} sel={sel} />}

      {d.closed.length > 0 ? <ClosedTable d={d} onSel={(p) => setSel({ kind: 'closed', p })} /> : (
        <p className="material px-4 py-3 text-[12.5px] text-ink-muted">No complete round trips in the latest {d.events.length.toLocaleString('en-US')} fills{s?.firstFill ? ` (since ${new Date(s.firstFill).toISOString().slice(0, 16).replace('T', ' ')} UTC)` : ''}: trader analytics need positions that were opened and closed within the fill history.</p>
      )}
      {d.closed.length > 0 && <TraderAnalytics d={d} />}
      {d.errors.length > 0 && <p className="text-[11.5px] text-ink-muted">Partial data: {d.errors.join(' · ')}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- equity

function EquityChart({ d }: { d: TraderWorkspace }) {
  const c = useThemeColors();
  const [range, setRange] = useState<'day' | 'week' | 'month' | 'allTime'>('month');
  const [mode, setMode] = useState<'value' | 'pnl' | 'drawdown'>('value');
  const h = 'day' in d.history ? d.history[range] : null;
  const pts = useMemo(() => {
    if (!h) return [];
    if (mode === 'pnl') return h.pnl.map((p) => [p.t, p.v]);
    if (mode === 'value') return h.value.map((p) => [p.t, p.v]);
    let peak = -Infinity; return h.value.map((p) => { peak = Math.max(peak, p.v); return [p.t, peak > 0 ? (p.v / peak - 1) * 100 : 0]; });
  }, [h, mode]);
  const option = c && pts.length > 1 && {
    animationDuration: 400, grid: { left: 64, right: 12, top: 10, bottom: 26 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' }, backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 }, valueFormatter: (v: unknown) => (mode === 'drawdown' ? `${Number(v).toFixed(1)}%` : usd(Number(v))) },
    xAxis: { type: 'time', axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c['ink-muted'], fontSize: 10 }, splitLine: { show: false } },
    yAxis: { type: 'value', scale: mode !== 'drawdown', axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => (mode === 'drawdown' ? `${v.toFixed(0)}%` : usd(v)) }, splitLine: { lineStyle: { color: c.grid } } },
    series: [{ type: 'line', data: pts, showSymbol: false, smooth: 0.15, lineStyle: { width: 1.8, color: mode === 'drawdown' ? c.flare : c.mint }, areaStyle: { color: mode === 'drawdown' ? c.flare : c.mint, opacity: 0.1 } }],
  };
  const chip = (on: boolean) => `rounded-[7px] px-2 py-0.5 text-[11.5px] font-semibold ${on ? 'bg-ink/12 text-ink' : 'text-ink-muted hover:text-ink'}`;
  return (
    <div className="material min-w-0 p-3.5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-bold text-ink">Account history</h3>
        <span className="inline-flex rounded-[9px] border border-[var(--hair)] p-0.5">{(['value', 'pnl', 'drawdown'] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={chip(mode === m)}>{m === 'value' ? 'Equity' : m === 'pnl' ? 'PnL' : 'Drawdown'}</button>)}</span>
        <span className="ml-auto inline-flex rounded-[9px] border border-[var(--hair)] p-0.5">{(['day', 'week', 'month', 'allTime'] as const).map((r) => <button key={r} type="button" onClick={() => setRange(r)} className={chip(range === r)}>{r === 'allTime' ? 'All' : r === 'day' ? '24H' : r === 'week' ? '7D' : '30D'}</button>)}</span>
      </div>
      {option ? <EChart option={option as never} height={280} ariaLabel={`Hyperliquid account ${mode}, ${range}`} /> : <p className="py-10 text-center text-[12.5px] text-ink-muted">No Hyperliquid account history for this range.</p>}
      {h?.volume != null && <p className="num text-[11px] text-ink-muted">Volume in range {usd(h.volume)}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- tables

type SortKey = 'valueUsd' | 'upnlUsd' | 'roe' | 'distanceToLiq' | 'leverage';
function PositionsTable({ d, sel, onSel }: { d: TraderWorkspace; sel: unknown; onSel: (s: { kind: 'open'; p: Position }) => void }) {
  const [key, setKey] = useState<SortKey>('valueUsd');
  const [asc, setAsc] = useState(false);
  const P = Array.isArray(d.positions) ? [...d.positions].sort((a, b) => ((a[key] ?? -Infinity) - (b[key] ?? -Infinity)) * (asc ? 1 : -1)) : [];
  const th = (k: SortKey, label: string) => <th className="cursor-pointer text-right font-normal hover:text-ink" aria-sort={key === k ? (asc ? 'ascending' : 'descending') : undefined} onClick={() => { if (key === k) setAsc(!asc); else { setKey(k); setAsc(false); } }}>{label}{key === k ? (asc ? ' ↑' : ' ↓') : ''}</th>;
  return (
    <div className="material min-w-0 p-3.5">
      <h3 className="mb-2 text-[13px] font-bold text-ink">Open positions <span className="font-normal text-ink-muted">· select one for its chart</span></h3>
      {!Array.isArray(d.positions) ? <p className="text-[12.5px] text-ink-muted">{d.positions.unavailable}</p> : !P.length ? <p className="py-8 text-center text-[12.5px] text-ink-muted">No open Hyperliquid positions.</p> : (
        <div className="max-h-[300px] overflow-auto" tabIndex={0} role="region" aria-label="Open positions">
          <table className="w-full min-w-[620px] text-[12px]">
            <thead className="sticky top-0 bg-[var(--surface-1)] text-[10.5px] uppercase tracking-wider text-ink-muted"><tr><th className="py-1.5 text-left font-normal">Market</th>{th('valueUsd', 'Notional')}<th className="text-right font-normal">Entry</th><th className="text-right font-normal">Mark</th><th className="text-right font-normal">Liq.</th>{th('distanceToLiq', 'To liq.')}{th('leverage', 'Lev.')}{th('upnlUsd', 'uPnL')}{th('roe', 'ROE')}<th className="text-right font-normal">Funding</th></tr></thead>
            <tbody>
              {P.map((p) => (
                <tr key={p.coin} onClick={() => onSel({ kind: 'open', p })} {...activateProps(() => onSel({ kind: 'open', p }))} className={`cursor-pointer border-t border-[var(--hair)] hover:bg-[var(--surface-2)] ${sel && (sel as { p: Position }).p === p ? 'bg-[color-mix(in_srgb,var(--signal)_10%,transparent)]' : ''}`}>
                  <td className="py-1.5"><span className="flex items-center gap-1.5 font-semibold text-ink"><TokenLogo symbol={p.coin} coin={p.coin} size={16} />{p.coin}<span className="text-[10.5px] font-bold uppercase" style={{ color: p.side === 'long' ? 'var(--mint)' : 'var(--flare)' }}>{p.side}</span></span></td>
                  <td className="num text-right text-ink">{usd(p.valueUsd)}</td>
                  <td className="num text-right text-ink-2">{fmtPx(p.entry)}</td>
                  <td className="num text-right text-ink-2">{fmtPx(p.mark)}</td>
                  <td className="num text-right text-ink-2">{fmtPx(p.liq)}</td>
                  <td className="num text-right" style={{ color: p.distanceToLiq == null ? undefined : p.distanceToLiq < 0.05 ? 'var(--flare)' : p.distanceToLiq < 0.15 ? 'var(--amber)' : 'var(--ink-2)' }}>{p.distanceToLiq == null ? 'n/a' : pct(p.distanceToLiq, 1)}</td>
                  <td className="num text-right text-ink-2">{p.leverage ? `${p.leverage}×` : 'n/a'}</td>
                  <td className="num text-right font-semibold" style={tone(p.upnlUsd)}>{sgn(p.upnlUsd)}</td>
                  <td className="num text-right" style={tone(p.roe)}>{p.roe != null ? pct(p.roe, 1) : 'n/a'}</td>
                  <td className="num text-right" style={tone(p.fundingSinceOpenUsd)} title="Funding since the position opened">{sgn(p.fundingSinceOpenUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PositionDetail({ d, sel }: { d: TraderWorkspace; sel: { kind: 'open'; p: Position } | { kind: 'closed'; p: ClosedPosition } }) {
  const now = Date.now();
  const coin = sel.p.coin;
  const start = sel.kind === 'open' ? (sel.p.openedAt ?? now - 7 * 864e5) : sel.p.openedAt;
  const end = sel.kind === 'open' ? now : sel.p.closedAt;
  const events = d.events.filter((e) => e.coin === coin && e.t >= start - 1 && e.t <= end + 1);
  const o = sel.kind === 'open' ? sel.p : null, cl = sel.kind === 'closed' ? sel.p : null;
  const rows: Array<[string, string, React.CSSProperties?]> = o ? [
    ['Side', o.side.toUpperCase(), { color: o.side === 'long' ? 'var(--mint)' : 'var(--flare)' }], ['Size', `${o.size.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${coin}`], ['Position value', usd(o.valueUsd)],
    ['Entry', fmtPx(o.entry)], ['Mark', fmtPx(o.mark)], ['Liquidation', fmtPx(o.liq)], ['Leverage', o.leverage ? `${o.leverage}× ${o.leverageType ?? ''}` : 'n/a'], ['Margin', usd(o.marginUsd)],
    ['Unrealized PnL', sgn(o.upnlUsd), tone(o.upnlUsd)], ['ROE', o.roe != null ? pct(o.roe, 1) : 'n/a', tone(o.roe)], ['Funding since open', sgn(o.fundingSinceOpenUsd), tone(o.fundingSinceOpenUsd)],
    ['Position age', o.openedAt ? dur(now - o.openedAt) : 'opened before the fill history'],
  ] : cl ? [
    ['Side', cl.side.toUpperCase(), { color: cl.side === 'long' ? 'var(--mint)' : 'var(--flare)' }], ['Average entry', fmtPx(cl.avgEntry)], ['Average exit', fmtPx(cl.avgExit)], ['Max size', `${cl.maxSize.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${coin}`],
    ['Max notional', usd(cl.maxNotional)], ['Realized PnL', sgn(cl.realizedPnl), tone(cl.realizedPnl)], ['ROI on max notional', cl.roi != null ? pct(cl.roi, 1) : 'n/a', tone(cl.roi)], ['Fees', usd(cl.fees)],
    ['Duration', dur(cl.closedAt - cl.openedAt)], ['Opened', new Date(cl.openedAt).toISOString().slice(0, 16).replace('T', ' ')], ['Closed', new Date(cl.closedAt).toISOString().slice(0, 16).replace('T', ' ')], ['Fills', String(cl.fills)],
  ] : [];
  return (
    <div className="material grid gap-3 p-3.5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-ink"><TokenLogo symbol={coin} coin={coin} size={18} />{coin} {sel.p.side} {sel.kind === 'closed' ? '(closed)' : ''}</h3>
          <span className="text-[11.5px] text-ink-muted">{events.length} fills in this position{sel.kind === 'open' && !o?.openedAt ? ' · opened before the fill history: showing 7 days' : ''}</span>
          <a href={hyperliquidTrade(coin)} target="_blank" rel="noopener noreferrer" className="ml-auto text-[12px] font-semibold text-ink-2 hover:text-ink">{coin} on Hyperliquid <ArrowUpRight className="inline h-3.5 w-3.5" aria-hidden /></a>
        </div>
        <PositionChart coin={coin} start={start} end={end} events={events} entry={o?.entry ?? cl?.avgEntry} mark={o?.mark ?? null} liq={o?.liq ?? null} />
      </div>
      <div className="space-y-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">{rows.map(([k, v, st]) => <div key={k} className="min-w-0"><dt className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">{k}</dt><dd className="num truncate font-semibold text-ink" style={st}>{v}</dd></div>)}</dl>
        {o && <div className="border-t border-[var(--hair)] pt-2"><p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">Distance to liquidation</p><LiqDistance side={o.side} entry={o.entry} mark={o.mark} liq={o.liq} /></div>}
        {events.length > 0 && (
          <div className="border-t border-[var(--hair)] pt-2">
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">Timeline</p>
            <ol className="max-h-[160px] space-y-0.5 overflow-auto text-[11.5px]">
              {[...events].reverse().slice(0, 40).map((e, i) => <li key={i} className="num flex justify-between gap-2"><span className="text-ink-muted">{new Date(e.t).toISOString().slice(5, 16).replace('T', ' ')}</span><span className="font-semibold capitalize text-ink">{e.kind}</span><span className="text-ink-2">{usd(e.notional)} @ {fmtPx(e.price)}</span></li>)}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function ClosedTable({ d, onSel }: { d: TraderWorkspace; onSel: (p: ClosedPosition) => void }) {
  return (
    <div className="material p-3.5">
      <h3 className="mb-2 text-[13px] font-bold text-ink">Position history <span className="font-normal text-ink-muted">· {d.closed.length} round trips rebuilt from fills · select one for its chart</span></h3>
      <div className="max-h-[340px] overflow-auto" tabIndex={0} role="region" aria-label="Closed positions">
        <table data-sortable className="w-full min-w-[760px] text-[12px]">
          <thead className="sticky top-0 bg-[var(--surface-1)] text-[10.5px] uppercase tracking-wider text-ink-muted"><tr><th className="py-1.5 text-left font-normal">Market</th><th className="text-left font-normal">Side</th><th className="text-right font-normal">Avg entry</th><th className="text-right font-normal">Avg exit</th><th className="text-right font-normal">Max notional</th><th className="text-right font-normal">Realized</th><th className="text-right font-normal">ROI</th><th className="text-right font-normal">Duration</th><th className="text-right font-normal">Closed</th></tr></thead>
          <tbody>
            {d.closed.slice(0, 200).map((p, i) => (
              <tr key={i} onClick={() => onSel(p)} {...activateProps(() => onSel(p))} className="cursor-pointer border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                <td className="py-1.5"><span className="flex items-center gap-1.5 font-semibold text-ink"><TokenLogo symbol={p.coin} coin={p.coin} size={15} />{p.coin}</span></td>
                <td className="text-[10.5px] font-bold uppercase" style={{ color: p.side === 'long' ? 'var(--mint)' : 'var(--flare)' }}>{p.side}</td>
                <td className="num text-right text-ink-2">{fmtPx(p.avgEntry)}</td><td className="num text-right text-ink-2">{fmtPx(p.avgExit)}</td>
                <td className="num text-right text-ink-2">{usd(p.maxNotional)}</td>
                <td className="num text-right font-semibold" style={tone(p.realizedPnl)}>{sgn(p.realizedPnl)}</td>
                <td className="num text-right" style={tone(p.roi)}>{p.roi != null ? pct(p.roi, 1) : 'n/a'}</td>
                <td className="num text-right text-ink-2">{dur(p.closedAt - p.openedAt)}</td>
                <td className="num text-right text-ink-muted">{ago(p.closedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- analytics

function TraderAnalytics({ d }: { d: TraderWorkspace }) {
  const c = useThemeColors();
  const s = d.stats!;
  const opt = useMemo(() => {
    if (!c) return null;
    const base = { animationDuration: 400, tooltip: { backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 } } };
    const ax = { axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c['ink-muted'], fontSize: 10 }, splitLine: { lineStyle: { color: c.grid } } };
    const assets = d.byAsset.slice(0, 12);
    const bins = (xs: number[], n: number) => { if (!xs.length) return { labels: [] as string[], counts: [] as number[] }; const lo = Math.min(...xs), hi = Math.max(...xs), w = (hi - lo) / n || 1; const counts = Array(n).fill(0); xs.forEach((x) => counts[Math.min(n - 1, Math.floor((x - lo) / w))]++); return { labels: counts.map((_, i) => usd(lo + w * (i + 0.5))), counts }; };
    const pnlBins = bins(d.closed.map((x) => x.realizedPnl), 14);
    const holdH = d.closed.map((x) => (x.closedAt - x.openedAt) / 3.6e6);
    const holdEdges = [0, 1, 4, 12, 24, 72, 168, Infinity], holdLabels = ['<1h', '1-4h', '4-12h', '12-24h', '1-3d', '3-7d', '7d+'];
    const hold = holdLabels.map((_, i) => holdH.filter((h) => h >= holdEdges[i] && h < holdEdges[i + 1]).length);
    return {
      byAsset: { ...base, grid: { left: 70, right: 16, top: 8, bottom: 20 }, tooltip: { ...base.tooltip, trigger: 'axis', valueFormatter: (v: unknown) => usd(Number(v), { signed: true }) }, xAxis: { type: 'value', ...ax, axisLabel: { ...ax.axisLabel, formatter: (v: number) => usd(v) } }, yAxis: { type: 'category', data: [...assets].reverse().map((a) => a.coin), ...ax, splitLine: { show: false } }, series: [{ type: 'bar', data: [...assets].reverse().map((a) => ({ value: a.pnl, itemStyle: { color: a.pnl >= 0 ? c.mint : c.flare } })), barMaxWidth: 12 }] },
      scatter: { ...base, grid: { left: 64, right: 16, top: 12, bottom: 30 }, tooltip: { ...base.tooltip, formatter: (raw: unknown) => { const a = (raw as { data: { a: TraderWorkspace['byAsset'][number] } }).data.a; return `<b>${a.coin}</b><br/>PnL ${usd(a.pnl, { signed: true })}<br/>ROI ${a.roi != null ? (a.roi * 100).toFixed(1) + '%' : 'n/a'}<br/>${a.trades} trades · volume ${usd(a.volume)}`; } }, xAxis: { type: 'log', name: 'trades', nameTextStyle: { color: c['ink-muted'], fontSize: 10 }, ...ax }, yAxis: { type: 'value', ...ax, axisLabel: { ...ax.axisLabel, formatter: (v: number) => usd(v) } }, series: [{ type: 'scatter', data: d.byAsset.map((a) => ({ value: [Math.max(1, a.trades), a.pnl], a, symbolSize: 8 + 26 * Math.sqrt(a.volume / Math.max(1, ...d.byAsset.map((b) => b.volume))) })), itemStyle: { color: (p: { data: { a: { pnl: number } } }) => (p.data.a.pnl >= 0 ? c.mint : c.flare), opacity: 0.75 }, label: { show: true, position: 'right', formatter: (p: { data: { a: { coin: string } } }) => p.data.a.coin, color: c['ink-2'], fontSize: 10 } }] },
      dist: { ...base, grid: { left: 40, right: 12, top: 10, bottom: 40 }, tooltip: { ...base.tooltip, trigger: 'axis' }, xAxis: { type: 'category', data: pnlBins.labels, ...ax, axisLabel: { ...ax.axisLabel, rotate: 35, fontSize: 9 } }, yAxis: { type: 'value', ...ax }, series: [{ type: 'bar', data: pnlBins.counts, itemStyle: { color: c.signal }, barMaxWidth: 18 }] },
      hold: { ...base, grid: { left: 40, right: 12, top: 10, bottom: 24 }, tooltip: { ...base.tooltip, trigger: 'axis' }, xAxis: { type: 'category', data: holdLabels, ...ax }, yAxis: { type: 'value', ...ax }, series: [{ type: 'bar', data: hold, itemStyle: { color: c.violet }, barMaxWidth: 22 }] },
      daily: { ...base, grid: { left: 64, right: 12, top: 10, bottom: 24 }, tooltip: { ...base.tooltip, trigger: 'axis', valueFormatter: (v: unknown) => usd(Number(v), { signed: true }) }, xAxis: { type: 'category', data: d.daily.map((x) => x.day.slice(5)), ...ax }, yAxis: { type: 'value', ...ax, axisLabel: { ...ax.axisLabel, formatter: (v: number) => usd(v) } }, series: [{ type: 'bar', data: d.daily.map((x) => ({ value: x.pnl, itemStyle: { color: x.pnl >= 0 ? c.mint : c.flare } })), barMaxWidth: 16 }] },
      hourly: { ...base, grid: { left: 36, right: 12, top: 10, bottom: 24 }, tooltip: { ...base.tooltip, trigger: 'axis' }, xAxis: { type: 'category', data: d.hourly.map((_, i) => `${i}h`), ...ax }, yAxis: { type: 'value', ...ax }, series: [{ type: 'bar', data: d.hourly, itemStyle: { color: c['ink-2'] }, barMaxWidth: 10 }] },
    };
  }, [c, d]);
  const card = (title: string, sub: string, o: unknown, h = 220) => <div className="material min-w-0 p-3.5"><h3 className="text-[13px] font-bold text-ink">{title}</h3><p className="mb-1 text-[11px] text-ink-muted">{sub}</p><EChart option={(o ?? null) as never} height={h} ariaLabel={title} /></div>;
  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-4 xl:grid-cols-8">
        <Metric k="Realized PnL" v={sgn(s.realizedPnl)} style={tone(s.realizedPnl)} note="in the fill history" />
        <Metric k="Profit factor" v={s.profitFactor != null ? s.profitFactor.toFixed(2) : 'n/a'} note="gross wins / gross losses" />
        <Metric k="Average winner" v={sgn(s.avgWin)} style={tone(1)} />
        <Metric k="Average loser" v={sgn(s.avgLoss)} style={tone(-1)} />
        <Metric k="Largest winner" v={sgn(s.largestWin)} style={tone(1)} />
        <Metric k="Largest loser" v={sgn(s.largestLoss)} style={tone(-1)} />
        <Metric k="Average hold" v={s.avgHoldHours != null ? dur(s.avgHoldHours * 3.6e6) : 'n/a'} />
        <Metric k="Long vs short" v={`${sgn(d.bySide.long.pnl)} / ${sgn(d.bySide.short.pnl)}`} note={`${d.bySide.long.trades} long · ${d.bySide.short.trades} short trades`} />
      </ul>
      <div className="grid gap-3 xl:grid-cols-3">
        {card('PnL by asset', 'Realized, closed round trips', opt?.byAsset, 260)}
        {card('Asset performance', 'Trades (log) against PnL · bubble = volume', opt?.scatter, 260)}
        {card('Daily PnL', 'Realized minus fees, per UTC day', opt?.daily, 260)}
        {card('Win and loss distribution', 'Round trips by realized PnL', opt?.dist)}
        {card('Holding time', 'Round trips by duration', opt?.hold)}
        {card('Activity by hour', 'Fills per UTC hour', opt?.hourly)}
      </div>
    </div>
  );
}
