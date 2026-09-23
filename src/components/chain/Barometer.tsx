'use client';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { InfoPopover } from '@/components/InfoPopover';
import { pressureBand } from '@/lib/models/cpi';
import { chainName, num } from '@/lib/viz/format';
import { TimeAgo } from '@/components/TimeAgo';
import type { ChainWeather } from '@/server/weather/queries';
import type { Provenance } from '@/lib/provenance';

const BAND_TEXT = { high: 'high pressure — smart money net-buying', low: 'low pressure — smart money net-selling', neutral: 'no pressure system' } as const;

export function barometerTitle(w: ChainWeather): string {
  if (w.cpi == null) return `${chainName(w.chain)} has no pressure reading yet`;
  const who = w.source === 'market-flow' ? 'all traders' : 'smart money';
  const band = pressureBand(w.cpi);
  const text = band === 'neutral' ? 'no pressure system' : BAND_TEXT[band].replace('smart money', who);
  return `${chainName(w.chain)} pressure ${num(w.cpi, 0)} — ${text}`;
}

export function Barometer({ w, provenance }: { w: ChainWeather; provenance: Provenance | null }) {
  const c = useThemeColors();
  if (w.cpi == null) {
    return <p className="text-sm text-ink-2">{w.unavailable}</p>;
  }
  const option = c && {
    series: [{
      type: 'gauge' as const, animation: false,
      min: 0, max: 100, startAngle: 210, endAngle: -30, radius: '95%', center: ['50%', '58%'],
      axisLine: {
        lineStyle: {
          width: 14,
          color: [
            [0.2, c['out-4']], [0.35, c['out-3']], [0.45, c['out-1']], [0.55, c.mid],
            [0.65, c['in-1']], [0.8, c['in-3']], [1, c['in-4']],
          ] as [number, string][],
        },
      },
      splitLine: { distance: -14, length: 14, lineStyle: { color: c['surface-1'], width: 2 } },
      axisTick: { show: false },
      axisLabel: { distance: 20, color: c['ink-muted'], fontSize: 10, formatter: (v: number) => ([0, 35, 50, 65, 100].includes(v) ? String(v) : '') },
      pointer: { length: '62%', width: 4, itemStyle: { color: c['ink-1'] } },
      anchor: { show: true, size: 10, itemStyle: { color: c['ink-1'], borderColor: c['surface-1'], borderWidth: 2 } },
      title: { show: false },
      detail: { offsetCenter: [0, '42%'], fontSize: 30, fontWeight: 600, color: c['ink-1'], fontFamily: 'var(--font-geist-mono), monospace', formatter: (v: number) => v.toFixed(1) },
      data: [{ value: w.cpi }],
    }],
  };

  const series = w.series;
  const W = 280, H = 44;
  const t0 = series[0]?.t ?? 0, t1 = series.at(-1)?.t ?? 1;
  const x = (t: number) => (t1 === t0 ? W / 2 : ((t - t0) / (t1 - t0)) * W);
  const y = (v: number) => 4 + (1 - v / 100) * (H - 8);

  return (
    <div>
      <div className="flex items-start justify-end">{provenance && <InfoPopover p={provenance} />}</div>
      {option ? <EChart option={option} height={210} ariaLabel={`Barometer: CPI ${num(w.cpi)}`} /> : <div style={{ height: 210 }} />}
      <div className="mt-1">
        <div className="mb-1 flex justify-between text-[11px] text-ink-muted">
          <span>CPI, last 7 days</span>
          <span>{series.length} snapshots · updated <TimeAgo ts={w.updatedAt} /></span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-11 w-full" preserveAspectRatio="none" role="img" aria-label="CPI trend">
          {[35, 50, 65].map((v) => <line key={v} x1="0" x2={W} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          {series.length > 1 && (
            <polyline points={series.map((p) => `${x(p.t)},${y(p.cpi)}`).join(' ')} fill="none" stroke="var(--ink-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          )}
        </svg>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {w.windows.map((x) => (
          <div key={x.window} className="rounded-md bg-accent/50 px-2 py-1.5">
            <dt className="text-[11px] text-ink-muted">{x.window}</dt>
            <dd className="num text-sm text-ink">{num(x.cpi, 0)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
