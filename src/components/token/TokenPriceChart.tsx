'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { usd } from '@/lib/viz/format';
import type { Candle } from '@/server/token/waves';
import type { SmEvent } from './CandleChart';

type Range = '1H' | '4H' | '1D' | '1W' | '1M' | '3M' | '1Y';
type Style = 'candles' | 'line' | 'area';
const TF: Record<Range, string> = { '1H': '1m', '4H': '5m', '1D': '15m', '1W': '1h', '1M': '4h', '3M': '1d', '1Y': '1d' };

const px = (v: number) => (v >= 1000 ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : v >= 1 ? `$${v.toFixed(v >= 100 ? 2 : 3)}` : `$${v.toPrecision(4)}`);
const sma = (xs: number[], n: number) => xs.map((_, i) => (i + 1 < n ? null : xs.slice(i + 1 - n, i + 1).reduce((a, v) => a + v, 0) / n));

/** Token price chart: any range from 1 hour (1m candles) to 1 year, candles, line or area, volume, moving averages and Smart Money trades. */
export function TokenPriceChart({ chain, address, initial, events = [], onChange }: { chain: string; address: string; initial: Candle[]; events?: SmEvent[]; onChange?: (change: number | null, range: string) => void }) {
  const c = useThemeColors();
  const router = useRouter();
  const [range, setRange] = useState<Range | '14D'>('14D');
  const [style, setStyle] = useState<Style>('candles');
  const [ma, setMa] = useState({ 20: true, 50: false });
  const [showEvents, setShowEvents] = useState(true);
  const [candles, setCandles] = useState<Candle[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cache = useRef(new Map<string, Candle[]>([['14D', initial]]));

  useEffect(() => {
    const hit = cache.current.get(range);
    if (hit) { setCandles(hit); setErr(''); return; }
    let live = true;
    setBusy(true); setErr('');
    fetch(`/api/token/candles?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}&range=${range}`)
      .then((r) => r.json())
      .then((d: { candles?: Candle[]; unavailable?: string; error?: string }) => {
        if (!live) return;
        if (d.candles?.length) { cache.current.set(range, d.candles); setCandles(d.candles); } else setErr(d.unavailable ?? d.error ?? 'No candles for this range.');
      })
      .catch(() => live && setErr('Could not load candles.'))
      .finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [range, chain, address]);

  const change = candles.length > 1 ? candles.at(-1)!.c / candles[0].o - 1 : null;
  useEffect(() => { onChange?.(change, range); }, [change, range, onChange]);

  const option = useMemo(() => {
    if (!c || candles.length < 2) return null;
    const t0 = candles[0].t;
    const up = c.mint, dn = c.flare;
    const closes = candles.map((k) => k.c);
    const last = candles.at(-1)!;
    const evs = showEvents ? events.filter((e) => e.t >= t0) : [];
    const maxEv = Math.max(1, ...evs.map((e) => e.usd));
    const closeAt = (t: number) => candles.reduce((b, k) => (Math.abs(k.t - t) < Math.abs(b.t - t) ? k : b), candles[0]).c;
    const series: unknown[] = [];
    if (style === 'candles') series.push({ name: 'Price', type: 'candlestick', data: candles.map((k) => [k.t, k.o, k.c, k.l, k.h]), barMaxWidth: 12, itemStyle: { color: up, color0: dn, borderColor: up, borderColor0: dn } });
    else series.push({ name: 'Price', type: 'line', data: candles.map((k) => [k.t, k.c]), showSymbol: false, lineStyle: { width: 1.8, color: (change ?? 0) >= 0 ? up : dn }, ...(style === 'area' ? { areaStyle: { color: (change ?? 0) >= 0 ? up : dn, opacity: 0.12 } } : {}) });
    series[0] = { ...(series[0] as object), markLine: { silent: true, symbol: 'none', data: [{ yAxis: last.c }], lineStyle: { color: last.c >= last.o ? up : dn, type: 'dashed' }, label: { position: 'insideEndTop', formatter: px(last.c), color: c['ink-1'], fontSize: 10.5, backgroundColor: c['surface-2'], padding: [2, 5], borderRadius: 4 } } };
    const maColors: Record<number, string> = { 20: c.amber, 50: c.violet };
    for (const n of [20, 50] as const) if (ma[n] && candles.length > n) series.push({ name: `MA${n}`, type: 'line', data: sma(closes, n).map((v, i) => [candles[i].t, v]), showSymbol: false, lineStyle: { width: 1.2, color: maColors[n] } });
    series.push({ name: 'Volume', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: candles.map((k) => ({ value: [k.t, k.v], itemStyle: { color: k.c >= k.o ? up : dn, opacity: 0.55 } })), barMaxWidth: 10 });
    if (evs.length) series.push({ name: 'Smart Money', type: 'scatter', data: evs.map((e) => ({ value: [e.t, closeAt(e.t)], ev: e })), symbol: 'circle', symbolSize: (_v: unknown, p: { data: { ev: SmEvent } }) => 7 + 11 * Math.sqrt(p.data.ev.usd / maxEv),
      itemStyle: { color: (p: { data: { ev: SmEvent } }) => (p.data.ev.side === 'buy' ? up : dn), borderColor: c['surface-1'], borderWidth: 1.5 }, z: 5 });
    return {
      animation: false,
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: [{ left: 64, right: 16, top: 12, height: '64%' }, { left: 64, right: 16, top: '80%', bottom: 44 }],
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'cross', lineStyle: { color: c.axis } }, backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 }, confine: true,
        formatter: (raw: unknown) => {
          const ps = raw as Array<{ seriesName: string; dataIndex: number; data: unknown }>;
          const i = ps.find((p) => p.seriesName === 'Price' || p.seriesName === 'Volume')?.dataIndex ?? 0;
          const k = candles[i]; if (!k) return '';
          const ch = k.c / k.o - 1;
          const ev = ps.find((p) => p.seriesName === 'Smart Money')?.data as { ev?: SmEvent } | undefined;
          return `<b>${new Date(k.t).toISOString().slice(0, 16).replace('T', ' ')} UTC</b><br/>O ${px(k.o)} · H ${px(k.h)}<br/>L ${px(k.l)} · C ${px(k.c)} <span style="color:${ch >= 0 ? up : dn}">${ch >= 0 ? '+' : ''}${(ch * 100).toFixed(2)}%</span><br/>Volume ${usd(k.v)}${ev?.ev ? `<br/><b>${ev.ev.label ?? 'Smart Money wallet'}</b> ${ev.ev.side === 'buy' ? 'bought' : 'sold'} ${usd(ev.ev.usd)}` : ''}`;
        },
      },
      xAxis: [
        { type: 'time', gridIndex: 0, axisLine: { lineStyle: { color: c.axis } }, axisLabel: { show: false }, splitLine: { show: false } },
        { type: 'time', gridIndex: 1, axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c['ink-muted'], fontSize: 10 }, splitLine: { show: false } },
      ],
      yAxis: [
        { type: 'value', gridIndex: 0, scale: true, position: 'left', axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => px(v) }, splitLine: { lineStyle: { color: c.grid } }, splitNumber: 5 },
        { type: 'value', gridIndex: 1, axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => usd(v) }, splitLine: { show: false }, splitNumber: 2 },
      ],
      dataZoom: [{ type: 'inside', xAxisIndex: [0, 1] }, { type: 'slider', xAxisIndex: [0, 1], height: 16, bottom: 8, borderColor: c.axis, fillerColor: 'rgba(127,127,127,.15)', textStyle: { color: c['ink-muted'] } }],
      series,
    };
  }, [c, candles, style, ma, showEvents, events, change]);

  const chip = (on: boolean) => `rounded-[7px] px-2 py-1 text-[11.5px] font-semibold transition-colors ${on ? 'bg-ink/12 text-ink' : 'text-ink-muted hover:text-ink'}`;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div role="tablist" aria-label="Range" className="inline-flex rounded-[9px] border border-[var(--hair)] p-0.5">
          {(['1H', '4H', '1D', '1W', '14D', '1M', '3M', '1Y'] as const).map((r) => (
            <button key={r} type="button" role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={chip(range === r)}>{r}</button>
          ))}
        </div>
        <div role="tablist" aria-label="Style" className="inline-flex rounded-[9px] border border-[var(--hair)] p-0.5">
          {(['candles', 'line', 'area'] as const).map((s) => <button key={s} type="button" role="tab" aria-selected={style === s} onClick={() => setStyle(s)} className={`${chip(style === s)} capitalize`}>{s}</button>)}
        </div>
        <div className="inline-flex gap-1">
          <button type="button" aria-pressed={ma[20]} onClick={() => setMa((m) => ({ ...m, 20: !m[20] }))} className={chip(ma[20])}><span className="mr-1 inline-block h-0.5 w-3 bg-[var(--amber)] align-middle" />MA20</button>
          <button type="button" aria-pressed={ma[50]} onClick={() => setMa((m) => ({ ...m, 50: !m[50] }))} className={chip(ma[50])}><span className="mr-1 inline-block h-0.5 w-3 bg-[var(--violet)] align-middle" />MA50</button>
          {events.length > 0 && <button type="button" aria-pressed={showEvents} onClick={() => setShowEvents((v) => !v)} className={chip(showEvents)}><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--mint)] align-middle" />Smart Money</button>}
        </div>
        <span className="num ml-auto text-[11.5px] text-ink-muted">{range === '14D' ? '4h' : TF[range as Range]} candles · {candles.length}{busy ? ' · loading…' : ''}</span>
      </div>
      <div className="relative">
        {option && <EChart option={option as never} height={420} ariaLabel={`Price chart, ${range}, ${style}`} onEvents={{ click: (e: { seriesName?: string; data?: { ev?: SmEvent } }) => { if (e.seriesName === 'Smart Money' && e.data?.ev) router.push(`/wallet/${e.data.ev.wallet}`); } }} />}
        {busy && <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--surface-1)_45%,transparent)]"><span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--hair-2)] border-t-[#1fe0a3]" /></div>}
      </div>
      {err && <p className="mt-1 text-[12px] text-ink-muted">{err}</p>}
    </div>
  );
}
