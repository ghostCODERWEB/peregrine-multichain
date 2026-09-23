'use client';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { usd } from '@/lib/viz/format';
import type { HoldingsTrend } from '@/server/wallet/wallet-page';

/** One line: the daily value of today's top holdings; the tooltip breaks
 *  the day down by token (largest first). Single series, so no legend. */
export function HoldingsTrendChart({ days, symbols }: { days: HoldingsTrend['days']; symbols: string[] }) {
  const c = useThemeColors();
  const data = days.map((d) => [Date.parse(`${d.day}T00:00:00Z`), d.valueUsd]);
  const option = c && {
    grid: { left: 64, right: 16, top: 12, bottom: 28 },
    xAxis: {
      type: 'time' as const, axisLine: { lineStyle: { color: c.axis } }, splitLine: { show: false },
      // One consistent "Sep 2" format (the default mixes day numbers and
      // month names, which collide on a phone), and never overlapping.
      axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: '{MMM} {d}', hideOverlap: true },
    },
    yAxis: {
      type: 'value' as const, scale: true, axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => usd(v) },
      splitLine: { lineStyle: { color: c.grid, width: 1 } }, axisLine: { show: false },
    },
    tooltip: {
      trigger: 'axis' as const, backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 },
      axisPointer: { type: 'line' as const, lineStyle: { color: c['ink-muted'], width: 1 } },
      formatter: (raw: unknown) => {
        const p = (Array.isArray(raw) ? raw : [raw])[0] as { dataIndex: number } | undefined;
        const d = p ? days[p.dataIndex] : undefined;
        if (!d) return '';
        const parts = Object.entries(d.bySymbol).sort((a, b) => b[1] - a[1]).map(([s, v]) => `${s} ${usd(v)}`).join('<br/>');
        return `<b>${usd(d.valueUsd)}</b> · ${d.day}<br/><span style="opacity:.75">${parts}</span>`;
      },
    },
    series: [{ name: 'Value', type: 'line' as const, data, showSymbol: false, lineStyle: { color: c['ink-1'], width: 2 }, areaStyle: { color: c['ink-1'], opacity: 0.06 }, emphasis: { disabled: true } }],
  };
  return option ? <EChart option={option} height={220} ariaLabel={`Daily value of ${symbols.join(', ')} over 30 days`} /> : null;
}
