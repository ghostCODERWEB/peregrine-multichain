'use client';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { chainName, pct, usd } from '@/lib/viz/format';

/** Share of the wallet's value per chain. One neutral fill with surface
 *  gaps; chain identity is carried by the hover label and the list below
 *  (its table twin), since a wallet can span more chains than a
 *  categorical palette has safe hues. */
export function BalanceDonut({ byChain, total }: { byChain: Array<{ chain: string; valueUsd: number }>; total: number }) {
  const c = useThemeColors();
  const top = byChain.slice(0, 6);
  const rest = byChain.slice(6).reduce((s, x) => s + x.valueUsd, 0);
  const data = [...top.map((x) => ({ name: chainName(x.chain), value: x.valueUsd })), ...(rest > 0 ? [{ name: `${byChain.length - 6} more`, value: rest }] : [])];
  const option = c && {
    tooltip: {
      backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 },
      formatter: (raw: unknown) => { const p = raw as { name: string; value: number }; return `<b>${usd(p.value)}</b><br/>${p.name} · ${pct(p.value / total, 1)}`; },
    },
    series: [{
      type: 'pie' as const, radius: ['58%', '84%'], center: ['50%', '50%'], data, startAngle: 90,
      itemStyle: { color: c['ink-2'], borderColor: c['surface-1'], borderWidth: 2 },
      emphasis: { itemStyle: { color: c['ink-1'] }, scale: false },
      label: { show: false },
    }],
    graphic: [{ type: 'text' as const, left: 'center', top: 'middle', style: { text: usd(total), fill: c['ink-1'], fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-geist-mono), monospace', textAlign: 'center' } }],
  };
  return (
    <div>
      {option ? <EChart option={option} height={180} ariaLabel={`Balance by chain, total ${usd(total)}`} /> : <div style={{ height: 180 }} />}
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12px]" aria-label="Balance by chain">
        {data.map((d) => (
          <li key={d.name} className="flex justify-between gap-2">
            <span className="truncate text-ink-2">{d.name}</span>
            <span className="num text-ink">{pct(d.value / total, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
