'use client';
import { useEffect, useMemo, useState } from 'react';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { usd } from '@/lib/viz/format';
import type { HlCandle, PositionEvent } from '@/server/research/hyperliquid';

export const fmtPx = (v: number | null | undefined) => (v == null ? 'n/a' : v >= 1000 ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 1 })}` : v >= 1 ? `$${v.toFixed(3)}` : `$${v.toPrecision(4)}`);
const KIND: Record<PositionEvent['kind'], { label: string; symbol: string }> = {
  open: { label: 'Opened', symbol: 'triangle' }, add: { label: 'Added', symbol: 'circle' }, reduce: { label: 'Reduced', symbol: 'diamond' },
  close: { label: 'Closed', symbol: 'rect' }, flip: { label: 'Flipped', symbol: 'pin' },
};

/** A position's story on the market chart: candles over its life, entry, mark and liquidation lines, and every open, add, reduce and close. */
export function PositionChart({ coin, start, end, events, entry, mark, liq, height = 400 }: {
  coin: string; start: number; end: number; events: PositionEvent[]; entry?: number | null; mark?: number | null; liq?: number | null; height?: number;
}) {
  const c = useThemeColors();
  const [data, setData] = useState<{ interval: string; candles: HlCandle[] } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    setData(null); setErr('');
    // A margin either side so the first and last events are not on the edge.
    const pad = Math.max(3.6e6, (end - start) * 0.08);
    fetch(`/api/research/candles?coin=${encodeURIComponent(coin)}&start=${Math.floor(start - pad)}&end=${Math.floor(Math.min(Date.now(), end + pad))}`)
      .then((r) => r.json()).then((d) => { if (live) { if (d.candles?.length) setData(d); else setErr(d.error ?? 'Hyperliquid returned no candles for this period.'); } })
      .catch(() => live && setErr('Could not load candles.'));
    return () => { live = false; };
  }, [coin, start, end]);

  const option = useMemo(() => {
    if (!c || !data) return null;
    const up = c.mint, dn = c.flare;
    const lines = [
      entry ? { yAxis: entry, name: 'Entry', lineStyle: { color: c.signal, type: 'solid' as const, width: 1.4 }, label: { formatter: `Entry ${fmtPx(entry)}`, color: c.signal } } : null,
      mark ? { yAxis: mark, name: 'Mark', lineStyle: { color: c['ink-2'], type: 'dashed' as const }, label: { formatter: `Mark ${fmtPx(mark)}`, color: c['ink-2'] } } : null,
      liq ? { yAxis: liq, name: 'Liquidation', lineStyle: { color: dn, type: 'dashed' as const, width: 1.4 }, label: { formatter: `Liq ${fmtPx(liq)}`, color: dn } } : null,
    ].filter(Boolean);
    const evColor = (e: PositionEvent) => (e.kind === 'open' || e.kind === 'add' ? (e.side === 'long' ? up : dn) : e.kind === 'close' ? c.amber : c.violet);
    const maxN = Math.max(1, ...events.map((e) => e.notional));
    // Many fills in one candle (TWAPs): merge consecutive same-kind fills close in time so the chart stays readable.
    const merged: Array<PositionEvent & { n: number }> = [];
    const bucket = data.candles.length > 1 ? data.candles[1].t - data.candles[0].t : 3.6e6;
    for (const e of events) {
      const last = merged.at(-1);
      if (last && last.kind === e.kind && e.t - last.t < bucket) { last.notional += e.notional; last.size += e.size; last.closedPnl += e.closedPnl; last.sizeAfter = e.sizeAfter; last.n++; last.price = (last.price * (last.n - 1) + e.price) / last.n; }
      else merged.push({ ...e, n: 1 });
    }
    const ys = data.candles.flatMap((k) => [k.h, k.l]).concat([entry, liq].filter((x): x is number => !!x && x > 0));
    return {
      animation: false,
      grid: [{ left: 70, right: 96, top: 14, height: '70%' }, { left: 70, right: 96, top: '84%', bottom: 26 }],
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'cross', lineStyle: { color: c.axis } }, backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 }, confine: true,
        formatter: (raw: unknown) => {
          const ps = raw as Array<{ seriesName: string; dataIndex: number; data: unknown }>;
          const ev = ps.find((p) => p.seriesName === 'Events')?.data as { e?: PositionEvent & { n: number } } | undefined;
          const k = data.candles[ps.find((p) => p.seriesName === 'Price')?.dataIndex ?? -1];
          let s = k ? `<b>${new Date(k.t).toISOString().slice(0, 16).replace('T', ' ')} UTC</b><br/>O ${fmtPx(k.o)} H ${fmtPx(k.h)} L ${fmtPx(k.l)} C ${fmtPx(k.c)}` : '';
          if (ev?.e) { const e = ev.e; s += `<br/><br/><b style="color:${evColor(e)}">${KIND[e.kind].label} ${e.side}</b>${e.n > 1 ? ` (${e.n} fills)` : ''}<br/>${new Date(e.t).toISOString().slice(0, 19).replace('T', ' ')} UTC<br/>Price ${fmtPx(e.price)} · size ${e.size.toLocaleString('en-US', { maximumFractionDigits: 4 })}<br/>Notional ${usd(e.notional)} · position after ${Math.abs(e.sizeAfter).toLocaleString('en-US', { maximumFractionDigits: 4 })}${e.closedPnl ? `<br/>Realized ${usd(e.closedPnl, { signed: true })}` : ''}`; }
          return s;
        },
      },
      xAxis: [{ type: 'time', gridIndex: 0, axisLabel: { show: false }, axisLine: { lineStyle: { color: c.axis } }, splitLine: { show: false } }, { type: 'time', gridIndex: 1, axisLabel: { color: c['ink-muted'], fontSize: 10 }, axisLine: { lineStyle: { color: c.axis } }, splitLine: { show: false } }],
      yAxis: [{ type: 'value', gridIndex: 0, scale: true, min: Math.min(...ys) * 0.995, max: Math.max(...ys) * 1.005, axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => fmtPx(v) }, splitLine: { lineStyle: { color: c.grid } } },
        { type: 'value', gridIndex: 1, splitNumber: 2, axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => usd(v) }, splitLine: { show: false } }],
      dataZoom: [{ type: 'inside', xAxisIndex: [0, 1] }],
      series: [
        { name: 'Price', type: 'candlestick', data: data.candles.map((k) => [k.t, k.o, k.c, k.l, k.h]), itemStyle: { color: up, color0: dn, borderColor: up, borderColor0: dn }, barMaxWidth: 10,
          markLine: { silent: true, symbol: 'none', data: lines, label: { position: 'end', fontSize: 10.5, backgroundColor: c['surface-2'], padding: [2, 5], borderRadius: 4 } } },
        { name: 'Events', type: 'scatter', data: merged.map((e) => ({ value: [e.t, e.price], e })), z: 10,
          symbol: (_v: unknown, p: { data: { e: PositionEvent } }) => KIND[p.data.e.kind].symbol,
          symbolRotate: (_v: unknown, p: { data: { e: PositionEvent } }) => (p.data.e.kind === 'open' && p.data.e.side === 'short' ? 180 : 0),
          symbolSize: (_v: unknown, p: { data: { e: PositionEvent } }) => 9 + 13 * Math.sqrt(p.data.e.notional / maxN),
          itemStyle: { color: (p: { data: { e: PositionEvent } }) => evColor(p.data.e), borderColor: c['surface-1'], borderWidth: 1.5 } },
        { name: 'Volume', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: data.candles.map((k) => ({ value: [k.t, k.v * k.c], itemStyle: { color: k.c >= k.o ? up : dn, opacity: 0.45 } })), barMaxWidth: 8 },
      ],
    };
  }, [c, data, events, entry, mark, liq]);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
        {(['open', 'add', 'reduce', 'close', 'flip'] as const).filter((k) => events.some((e) => e.kind === k)).map((k) => <span key={k} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: k === 'close' ? 'var(--amber)' : k === 'reduce' || k === 'flip' ? 'var(--violet)' : 'var(--mint)' }} />{KIND[k].label} ({events.filter((e) => e.kind === k).length})</span>)}
        {data && <span className="ml-auto num">Hyperliquid {data.interval} candles</span>}
      </div>
      {!data && !err && <div className="animate-pulse rounded-[10px] bg-ink/5" style={{ height }} />}
      {err && <p className="rounded-[10px] border border-[var(--hair)] p-4 text-[12.5px] text-ink-muted">{err}</p>}
      {<EChart option={(option ?? null) as never} height={height} ariaLabel={`${coin} price with position events`} />}
    </div>
  );
}

/** Liquidation, entry and current price on one scale: how far the position is from being liquidated. */
export function LiqDistance({ side, entry, mark, liq }: { side: 'long' | 'short'; entry: number | null; mark: number | null; liq: number | null }) {
  if (!entry || !mark || !liq) return <p className="text-[12px] text-ink-muted">No liquidation price (for example, fully collateralized cross margin).</p>;
  const lo = Math.min(entry, mark, liq), hi = Math.max(entry, mark, liq), span = hi - lo || 1;
  const pos = (v: number) => `${((v - lo) / span) * 92 + 4}%`;
  const dist = side === 'long' ? (mark - liq) / mark : (liq - mark) / mark;
  const tone = dist < 0.05 ? 'var(--flare)' : dist < 0.15 ? 'var(--amber)' : 'var(--mint)';
  const pin = (v: number, label: string, color: string, top: boolean) => (
    <span className="absolute -translate-x-1/2 text-center" style={{ left: pos(v), [top ? 'bottom' : 'top']: 14 }}>
      <span className="block text-[10px] font-bold uppercase tracking-[0.06em]" style={{ color }}>{label}</span>
      <span className="num block text-[11.5px] font-semibold text-ink">{fmtPx(v)}</span>
    </span>
  );
  return (
    <div>
      <div className="relative mx-2 h-[88px]">
        <span className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-[var(--hair)]" />
        <span className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ left: `calc(${pos(Math.min(mark, liq))})`, width: `${(Math.abs(mark - liq) / span) * 92}%`, background: `color-mix(in srgb, ${tone} 55%, transparent)` }} />
        {[[liq, 'var(--flare)'], [entry, 'var(--signal)'], [mark, 'var(--ink-1)']].map(([v, col], i) => <span key={i} className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface-1)]" style={{ left: pos(v as number), background: col as string }} />)}
        {pin(liq, 'Liquidation', 'var(--flare)', true)}{pin(entry, 'Entry', 'var(--signal)', false)}{pin(mark, 'Current', 'var(--ink-2)', true)}
      </div>
      <p className="num mt-1 text-center text-[12.5px]"><span className="font-bold" style={{ color: tone }}>{(dist * 100).toFixed(1)}%</span> <span className="text-ink-muted">price move to liquidation</span></p>
    </div>
  );
}
