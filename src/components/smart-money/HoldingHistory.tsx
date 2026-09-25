'use client';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { usd } from '@/lib/viz/format';
import type { SmHistory } from '@/server/smart-money/desk';

/** One token's smart-money value over 30 days, with Nansen's cohort change marked. */
export function HoldingHistory({ h }: { h: SmHistory }) {
  const c = useThemeColors();
  if (!h.points.length) return <p className="text-sm text-ink-2">Nansen has no smart-money history for this token in the last 30 days.</p>;
  const option = c && {
    animation: false,
    grid: { left: 64, right: 16, top: 16, bottom: 32 },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: c['surface-2'],
      borderColor: c.axis,
      textStyle: { color: c['ink-1'], fontSize: 12 },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? usd(v) : '—'),
    },
    xAxis: {
      type: 'category' as const,
      data: h.points.map((p) => p.date.slice(5)),
      axisLine: { lineStyle: { color: c.axis } },
      axisLabel: { color: c['ink-muted'], fontSize: 10, hideOverlap: true },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: { color: c['ink-muted'], fontSize: 10, formatter: (v: number) => usd(v) },
      splitLine: { lineStyle: { color: c.grid } },
    },
    series: [
      {
        type: 'line' as const,
        name: 'Value held by smart money',
        data: h.points.map((p) => p.valueUsd),
        showSymbol: false,
        lineStyle: { color: c['ink-1'], width: 2 },
        areaStyle: { color: c['ink-1'], opacity: 0.06 },
        markLine: h.cohortChange
          ? {
              symbol: 'none',
              silent: true,
              lineStyle: { color: c['storm-2'], type: 'dashed' as const },
              label: { formatter: 'Fund wallets leave the cohort', color: c['ink-2'], fontSize: 10, position: 'insideEndTop' as const },
              data: [{ xAxis: h.cohortChange.slice(5) }],
            }
          : undefined,
      },
    ],
  };
  const first = h.points[0],
    last = h.points.at(-1)!;
  return (
    <div>
      {option ? (
        <EChart
          option={option}
          height={240}
          ariaLabel={`Smart-money value held in ${h.symbol ?? 'this token'}, daily for ${h.points.length} days: ${usd(first.valueUsd)} to ${usd(last.valueUsd)}`}
        />
      ) : (
        <div style={{ height: 240 }} />
      )}
      <details className="mt-2 text-[12px]">
        <summary className="cursor-pointer text-ink-2">Table</summary>
        <div className="mt-1 max-h-48 overflow-auto">
          <table className="w-full text-left">
            <thead className="text-ink-muted">
              <tr>
                <th className="py-1 font-normal">Day</th>
                <th className="font-normal">Value</th>
                <th className="font-normal">Wallets</th>
              </tr>
            </thead>
            <tbody>
              {h.points.map((p) => (
                <tr key={p.date} className="border-t border-border">
                  <td className="num py-1">{p.date}</td>
                  <td className="num">{usd(p.valueUsd)}</td>
                  <td className="num">{p.holders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
