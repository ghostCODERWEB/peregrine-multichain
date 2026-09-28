'use client';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, usd } from '@/lib/viz/format';
import type { ChainPageData } from '@/server/weather/chain-page';

export function tideTitle(chain: string, tide: ChainPageData['tide'], label: string): string {
  const pts = tide.points;
  if (pts.length < 2) return `The ${label} cumulative flow on ${chainName(chain)} starts with the next scans`;
  const net = pts.at(-1)!.cumulativeUsd;
  const hours = Math.max(1, Math.round((pts.at(-1)!.t - pts[0].t) / 3_600_000));
  return `${label[0].toUpperCase()}${label.slice(1)} has ${net >= 0 ? 'put' : 'pulled'} ${usd(Math.abs(net))} ${net >= 0 ? 'into' : 'out of'} ${chainName(chain)} over the last ${hours}h`;
}

export function TideChart({ tide }: { tide: ChainPageData['tide'] }) {
  const c = useThemeColors();
  if (tide.points.length < 2) {
    return (
      <p className="text-sm text-ink-2">
        {tide.points.length} snapshot{tide.points.length === 1 ? '' : 's'} so far. The cumulative flow needs a few scans of history to draw a
        line; the scanner adds one every scan interval.
      </p>
    );
  }
  const hist = tide.points.map((p) => [p.t, p.cumulativeUsd]);
  const last = tide.points.at(-1)!;
  const fc = tide.forecast;
  const option = c && {
    grid: { left: 64, right: 16, top: 12, bottom: 28 },
    xAxis: { type: 'time' as const, axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c['ink-muted'], fontSize: 10 }, splitLine: { show: false } },
    yAxis: {
      type: 'value' as const, axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => usd(v) },
      splitLine: { lineStyle: { color: c.grid, width: 1 } }, axisLine: { show: false },
    },
    tooltip: {
      trigger: 'axis' as const, backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 },
      axisPointer: { type: 'line' as const, lineStyle: { color: c['ink-muted'], width: 1 } },
      formatter: (raw: unknown) => {
        const params = (Array.isArray(raw) ? raw : [raw]) as Array<{ dataIndex: number; seriesName: string; value: [number, number] }>;
        const p = params.find((x) => x.seriesName === 'Cumulative flow');
        if (p) {
          const pt = tide.points[p.dataIndex];
          return `<b>${usd(pt.cumulativeUsd, { signed: true })}</b> cumulative flow<br/>${usd(pt.flowUsd, { signed: true })} this interval<br/><span style="opacity:.7">${new Date(pt.t).toLocaleString()}</span>`;
        }
        const f = params.find((x) => x.seriesName === 'Projection');
        return f ? `<b>${usd(f.value[1], { signed: true })}</b> projection` : '';
      },
    },
    series: [
      { name: 'Cumulative flow', type: 'line' as const, data: hist, showSymbol: false, lineStyle: { color: c['ink-1'], width: 2 }, areaStyle: { color: c['ink-1'], opacity: 0.08 }, emphasis: { disabled: true } },
      ...(fc.length ? [
        { name: 'low', type: 'line' as const, data: [[last.t, last.cumulativeUsd], ...fc.map((p) => [p.t, p.low80])], stack: 'fan', lineStyle: { opacity: 0 }, showSymbol: false, silent: true },
        { name: 'band', type: 'line' as const, data: [[last.t, 0], ...fc.map((p) => [p.t, p.high80 - p.low80])], stack: 'fan', lineStyle: { opacity: 0 }, areaStyle: { color: c['ink-1'], opacity: 0.12 }, showSymbol: false, silent: true },
        { name: 'Projection', type: 'line' as const, data: [[last.t, last.cumulativeUsd], ...fc.map((p) => [p.t, p.forecast])], showSymbol: false, lineStyle: { color: c['ink-2'], width: 2, type: 'solid' as const } },
      ] : []),
    ],
  };
  return (
    <div>
      <div className="flex justify-end"><InfoPopover p={tide.provenance} /></div>
      {<EChart option={option ?? null} height={240} ariaLabel="Cumulative smart-money flow over time" />}
    </div>
  );
}
