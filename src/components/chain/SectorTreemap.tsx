'use client';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors } from '@/components/charts/useThemeColors';
import { flowClass } from '@/lib/viz/scales';
import { chainName, usd } from '@/lib/viz/format';
import type { FlowSection } from '@/server/weather/chain-page';

export function sectorsTitle(chain: string, f: FlowSection): string {
  const top = f.sectors.filter((s) => s.sector !== 'Unclassified')[0];
  return top
    ? `${top.sector}, ${usd(top.netFlowUsd, { signed: true })} net, is the busiest smart-money sector on ${chainName(chain)}`
    : `Smart-money flow by sector on ${chainName(chain)}`;
}

/** Area = gross smart-money flow through the sector (|in| + |out|, how much
 *  moved); color = its net direction on the diverging scale. The netflow
 *  endpoint returns no volume, so gross flow — not volume — sizes the
 *  tiles, and the ⓘ on the flows chart says so. */
export function SectorTreemap({ f }: { f: FlowSection }) {
  const c = useThemeColors();
  if (!f.sectors.length) {
    return <p className="text-sm text-ink-2">{f.kind === 'market-flow' ? 'Sector breakdown needs smart-money labels, which Nansen doesn’t have on this chain.' : 'No sector data.'}</p>;
  }
  const maxAbs = Math.max(1, ...f.sectors.map((s) => Math.abs(s.netFlowUsd)));
  const data = f.sectors.slice(0, 18).map((s) => {
    const cls = flowClass(s.netFlowUsd, maxAbs);
    return {
      name: s.sector,
      value: s.grossUsd,
      net: s.netFlowUsd,
      tokens: s.tokens,
      itemStyle: { color: c?.[cls as keyof typeof c] },
      label: { color: c?.[`on-${cls}` as keyof typeof c] },
    };
  });
  const option = c && {
    tooltip: {
      backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 },
      formatter: (raw: unknown) => {
        const p = raw as { data: { name: string; net: number; value: number; tokens: number } };
        return `<b>${usd(p.data.net, { signed: true })}</b> net<br/>${p.data.name}<br/><span style="opacity:.7">${usd(p.data.value)} gross · ${p.data.tokens} tokens</span>`;
      },
    },
    series: [{
      type: 'treemap' as const, data, roam: false, nodeClick: false as const, breadcrumb: { show: false },
      width: '100%', height: '100%', top: 0, left: 0,
      itemStyle: { borderColor: c['surface-1'], borderWidth: 2, gapWidth: 2 },
      label: { show: true, fontSize: 11, formatter: (raw: unknown) => {
        const p = raw as { data: { name: string; net: number } };
        return `${p.data.name}\n${usd(p.data.net, { signed: true })}`;
      } },
      upperLabel: { show: false },
    }],
  };
  // As tall as the token flows beside it (a 24px row per token and its axis line), so the pair ends together.
  const height = f.kind === 'unavailable' ? 260 : Math.max(260, (f.inflows.length + f.outflows.length) * 24 + 20);
  return option ? <EChart option={option} height={height} ariaLabel="Smart-money net flow by token sector" /> : <div style={{ height }} />;
}
