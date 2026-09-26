'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors, type ThemeColors } from '@/components/charts/useThemeColors';
import { chainName, pct, usd } from '@/lib/viz/format';
import type { GraphLink, GraphNode } from '@/server/graph/series';

const axis = (c: ThemeColors) => ({ axisLabel: { color: c['ink-muted'], fontSize: 10 }, axisLine: { lineStyle: { color: c.axis } }, splitLine: { lineStyle: { color: c.grid } } });
const tip = (c: ThemeColors) => ({ backgroundColor: c['surface-2'], borderColor: c.axis, textStyle: { color: c['ink-1'], fontSize: 12 }, confine: true });
const hour = (t: number) => new Date(t).toISOString().slice(5, 13).replace('T', ' ') + ':00';

// ------------------------------------------------ Smart Money flow over time

export type SmFlowPoint = { t: number; buy: number; sell: number; net: number; wallets: number; top: Array<{ symbol: string; chain: string; token: string; net: number }> };

/** Smart Money DEX buys (up) and sells (down) per hour with the net as a line; brush the slider to zoom; click an hour for its tokens. */
export function SmFlowChart({ points }: { points: SmFlowPoint[] }) {
  const c = useThemeColors();
  const router = useRouter();
  const [picked, setPicked] = useState<SmFlowPoint | null>(null);
  const option = useMemo(() => c && {
    animationDuration: 500,
    grid: { left: 64, right: 56, top: 16, bottom: 58 },
    tooltip: { trigger: 'axis' as const, ...tip(c), formatter: (raw: unknown) => { const ps = raw as Array<{ dataIndex: number }>;
      const p = points[ps[0].dataIndex];
      return `<b>${hour(p.t)} UTC</b><br/>Bought ${usd(p.buy)} · Sold ${usd(p.sell)}<br/>Net <b>${usd(p.net, { signed: true })}</b> · ${p.wallets} wallets${p.top[0] ? `<br/><span style="opacity:.75">Top: ${p.top.slice(0, 3).map((x) => `${x.symbol} ${usd(x.net, { signed: true })}`).join(', ')}</span>` : ''}`;
    } },
    xAxis: { type: 'time' as const, ...axis(c), splitLine: { show: false } },
    yAxis: [{ type: 'value' as const, ...axis(c), axisLabel: { ...axis(c).axisLabel, formatter: (v: number) => usd(v) } }, { type: 'value' as const, ...axis(c), splitLine: { show: false }, axisLabel: { ...axis(c).axisLabel, formatter: (v: number) => `${v}` } }],
    dataZoom: [{ type: 'inside' as const }, { type: 'slider' as const, height: 18, bottom: 8, borderColor: c.axis, fillerColor: 'rgba(127,127,127,.15)', textStyle: { color: c['ink-muted'] } }],
    series: [
      { name: 'Bought', type: 'bar' as const, stack: 'f', data: points.map((p) => [p.t, p.buy]), itemStyle: { color: c.mint, borderRadius: [2, 2, 0, 0] }, barMaxWidth: 10 },
      { name: 'Sold', type: 'bar' as const, stack: 'f', data: points.map((p) => [p.t, -p.sell]), itemStyle: { color: c.flare, borderRadius: [0, 0, 2, 2] }, barMaxWidth: 10 },
      { name: 'Net', type: 'line' as const, data: points.map((p) => [p.t, p.net]), smooth: 0.3, showSymbol: false, lineStyle: { color: c['ink-1'], width: 1.6 } },
      { name: 'Wallets', type: 'line' as const, yAxisIndex: 1, data: points.map((p) => [p.t, p.wallets]), showSymbol: false, lineStyle: { color: c.signal, width: 1, type: 'dashed' as const } },
    ],
  }, [c, points]);
  if (points.length < 2) return <p className="text-[13px] text-ink-muted">The scanner has not stored enough Smart Money trades yet.</p>;
  return (
    <div>
      {option && <EChart option={option} height={300} ariaLabel={`Smart Money DEX buys and sells per hour over ${points.length} hours`} onEvents={{ click: (e: { dataIndex: number }) => setPicked(points[e.dataIndex] ?? null) }} />}
      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11.5px] text-ink-muted">
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-[2px] bg-[var(--mint)]" />bought</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-[2px] bg-[var(--flare)]" />sold</span>
        <span className="flex items-center gap-1"><span className="h-px w-3 bg-ink" />net</span>
        <span className="flex items-center gap-1"><span className="h-px w-3 border-t border-dashed border-[var(--signal)]" />wallets (right axis)</span>
        <span>· select an hour for its tokens</span>
      </div>
      {picked && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px]">
          <span className="font-semibold text-ink">{hour(picked.t)} UTC:</span>
          {picked.top.map((x) => (
            <button key={`${x.chain}:${x.token}`} type="button" onClick={() => router.push(`/token/${x.chain}/${encodeURIComponent(x.token)}`)} className="rounded-full border border-[var(--hair)] px-2.5 py-0.5 hover:border-[var(--hair-2)]">
              <span className="font-semibold text-ink">{x.symbol}</span> <span className="num" style={{ color: x.net >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(x.net, { signed: true })}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------- positioning history

export type PositionPoint = { at: number; mark: number | null; smLong: number; smShort: number; allLong: number; allShort: number; smTraders: number };

/** Smart Money long and short exposure per stored snapshot, with the crowd's long share; click a point to replay it. */
export function PositioningHistory({ points, onReplay }: { points: PositionPoint[]; onReplay?: (at: number) => void }) {
  const c = useThemeColors();
  // The parent re-renders on its freshness ticker; keep the option stable so the chart is not reset each second.
  const replay = useRef(onReplay);
  replay.current = onReplay;
  const canReplay = !!onReplay;
  const option = useMemo(() => c && {
    animationDuration: 500,
    grid: { left: 64, right: 52, top: 16, bottom: 30 },
    tooltip: { trigger: 'axis' as const, ...tip(c), formatter: (raw: unknown) => { const ps = raw as Array<{ dataIndex: number }>;
      const p = points[ps[0].dataIndex];
      const share = p.allLong + p.allShort ? p.allLong / (p.allLong + p.allShort) : null;
      return `<b>${new Date(p.at).toISOString().slice(5, 16).replace('T', ' ')} UTC</b><br/>Smart Money long ${usd(p.smLong)} · short ${usd(p.smShort)}<br/>All observed ${pct(share, 0)} long · mark ${p.mark ? `$${Math.round(p.mark).toLocaleString('en-US')}` : 'n/a'}${canReplay ? '<br/><span style="opacity:.7">Select to replay this snapshot</span>' : ''}`;
    } },
    xAxis: { type: 'time' as const, ...axis(c), splitLine: { show: false } },
    yAxis: [{ type: 'value' as const, ...axis(c), axisLabel: { ...axis(c).axisLabel, formatter: (v: number) => usd(v) } }, { type: 'value' as const, min: 0, max: 100, ...axis(c), splitLine: { show: false }, axisLabel: { ...axis(c).axisLabel, formatter: (v: number) => `${v}%` } }],
    series: [
      { name: 'Smart Money long', type: 'line' as const, data: points.map((p) => [p.at, p.smLong]), showSymbol: points.length < 40, symbolSize: 5, lineStyle: { color: c.mint, width: 2 }, itemStyle: { color: c.mint }, areaStyle: { color: c.mint, opacity: 0.08 } },
      { name: 'Smart Money short', type: 'line' as const, data: points.map((p) => [p.at, p.smShort]), showSymbol: points.length < 40, symbolSize: 5, lineStyle: { color: c.flare, width: 2 }, itemStyle: { color: c.flare }, areaStyle: { color: c.flare, opacity: 0.08 } },
      { name: 'All observed long share', type: 'line' as const, yAxisIndex: 1, data: points.map((p) => [p.at, p.allLong + p.allShort ? (100 * p.allLong) / (p.allLong + p.allShort) : null]), showSymbol: false, lineStyle: { color: c.signal, width: 1.2, type: 'dashed' as const } },
    ],
  }, [c, points, canReplay]);
  if (points.length < 2) return <p className="text-[13px] text-ink-muted">History builds with each stored snapshot (the scanner stores BTC and ETH every run).</p>;
  return (
    <div>
      {option && <EChart option={option} height={240} ariaLabel={`Smart Money perp positioning across ${points.length} snapshots`} onEvents={canReplay ? { click: (e: { dataIndex: number }) => points[e.dataIndex] && replay.current?.(points[e.dataIndex].at) } : undefined} />}
      <div className="mt-1 flex flex-wrap gap-3 text-[11.5px] text-ink-muted">
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[var(--mint)]" />Smart Money long</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[var(--flare)]" />Smart Money short</span>
        <span className="flex items-center gap-1"><span className="h-px w-3 border-t border-dashed border-[var(--signal)]" />all observed long share (right)</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------- flow index history

/** Flow Index over time for the chains that moved most; 50 is neutral. Click a line for its chain. */
export function FlowIndexHistory({ series }: { series: Array<{ chain: string; points: Array<[number, number]> }> }) {
  const c = useThemeColors();
  const router = useRouter();
  const palette = c ? [c.mint, c.flare, c.signal, c.amber, c.violet, c['ink-2']] : [];
  const option = useMemo(() => c && {
    animationDuration: 500,
    grid: { left: 40, right: 16, top: 16, bottom: 30 },
    tooltip: { trigger: 'axis' as const, ...tip(c), valueFormatter: (v: unknown) => Math.round(Number(v)).toString() },
    xAxis: { type: 'time' as const, ...axis(c), splitLine: { show: false } },
    yAxis: { type: 'value' as const, min: 0, max: 100, ...axis(c) },
    series: series.map((s, i) => ({
      name: chainName(s.chain), type: 'line' as const, data: s.points, showSymbol: false, smooth: 0.2, lineStyle: { width: 1.8, color: palette[i % palette.length] }, itemStyle: { color: palette[i % palette.length] }, emphasis: { focus: 'series' as const },
      ...(i === 0 ? { markLine: { silent: true, symbol: 'none', lineStyle: { color: c.axis, type: 'dashed' as const }, data: [{ yAxis: 50 }], label: { show: false } } } : {}),
    })),
  }, [c, series]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!series.length) return <p className="text-[13px] text-ink-muted">Flow Index history appears after a few scans.</p>;
  return (
    <div>
      {option && <EChart option={option} height={260} ariaLabel={`Flow Index history for ${series.map((s) => chainName(s.chain)).join(', ')}`} onEvents={{ click: (e: { seriesIndex: number }) => series[e.seriesIndex] && router.push(`/chain/${series[e.seriesIndex].chain}`) }} />}
      <div className="mt-1 flex flex-wrap gap-3 text-[11.5px] text-ink-2">
        {series.map((s, i) => <button key={s.chain} type="button" onClick={() => router.push(`/chain/${s.chain}`)} className="flex items-center gap-1 hover:text-ink"><span className="h-0.5 w-3" style={{ background: palette[i % palette.length] }} />{chainName(s.chain)} {Math.round(s.points.at(-1)![1])}</button>)}
      </div>
    </div>
  );
}

// --------------------------------------------------------- wallet graph

/** Wallets tied to the markets they hold or trade: every edge is a stored Nansen record. Drag to explore, select a node to open it. */
export function WalletGraph({ nodes, links }: { nodes: GraphNode[]; links: GraphLink[] }) {
  const c = useThemeColors();
  const router = useRouter();
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const option = useMemo(() => {
    if (!c) return null;
    const maxV = Math.max(1, ...nodes.map((n) => n.value));
    const col = { wallet: c['ink-2'], perp: c.signal, token: c.amber };
    const markets = nodes.filter((n) => n.kind !== 'wallet').map((n) => n.id);
    return {
      animationDuration: 700,
      tooltip: { ...tip(c), formatter: (raw: unknown) => { const p = raw as { dataType: string; data: { id?: string; source?: string; target?: string; value?: number; side?: string } };
        if (p.dataType === 'edge') { const s = byId.get(p.data.source!), t = byId.get(p.data.target!); return `${s?.name} <b>${p.data.side}</b> ${t?.name}<br/>${usd(p.data.value)}`; }
        const n = byId.get(p.data.id!); return `<b>${n?.name}</b><br/>${n?.kind === 'wallet' ? `wallet${n.sm ? ' · Smart Money' : ''}` : n?.kind === 'perp' ? 'perp market' : 'token'} · ${usd(n?.value)}<br/><span style="opacity:.7">Select to open</span>`;
      } },
      series: [{
        type: 'graph' as const, layout: 'force' as const, roam: true, draggable: true,
        force: { repulsion: 220, edgeLength: [50, 150], gravity: 0.05, layoutAnimation: true },
        label: { show: true, position: 'right' as const, color: c['ink-2'], fontSize: 10, formatter: (raw: unknown) => { const p = raw as { data: { kind: string; name: string } }; return p.data.kind === 'wallet' ? '' : p.data.name; } },
        emphasis: { focus: 'adjacency' as const, label: { show: true, formatter: '{b}' } },
        data: nodes.map((n) => {
          // Markets start spread on a ring so their wallet clusters separate instead of stacking in the centre.
          const mi = markets.indexOf(n.id), ang = (2 * Math.PI * mi) / Math.max(1, markets.length);
          return {
          id: n.id, name: n.name, kind: n.kind, value: n.value,
          ...(mi >= 0 ? { x: 300 + 160 * Math.cos(ang), y: 220 + 120 * Math.sin(ang), fixed: markets.length > 1 } : {}),
          symbolSize: n.kind === 'wallet' ? 6 + 14 * Math.sqrt(n.value / maxV) : 16 + 20 * Math.sqrt(n.value / maxV),
          itemStyle: { color: col[n.kind], borderColor: n.sm ? c.signal : 'transparent', borderWidth: n.sm ? 2 : 0 },
        }; }),
        links: links.map((l) => ({ source: l.source, target: l.target, value: l.value, side: l.side, lineStyle: { color: l.side === 'long' || l.side === 'bought' ? c.mint : c.flare, opacity: 0.45, width: 1 } })),
      }],
    };
  }, [c, nodes, links, byId]);
  if (!nodes.length) return <p className="text-[13px] text-ink-muted">No wallet ties two markets yet; the graph grows as the scanner stores snapshots and trades.</p>;
  return (
    <div>
      {option && <EChart option={option} height={460} ariaLabel={`Wallet network: ${nodes.filter((n) => n.kind === 'wallet').length} wallets connected to ${nodes.filter((n) => n.kind !== 'wallet').length} markets`} onEvents={{ click: (e: { dataType: string; data: { id?: string } }) => { if (e.dataType === 'node') { const n = byId.get(e.data.id!); if (n) router.push(n.href); } } }} />}
      <div className="mt-1 flex flex-wrap gap-3 text-[11.5px] text-ink-muted">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[var(--signal)]" />perp market</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[var(--amber)]" />token (Smart Money DEX)</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-ink-2" />wallet (blue ring = Smart Money)</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[var(--mint)]" />long or bought</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[var(--flare)]" />short or sold</span>
        <span>· drag, zoom, hover to isolate a wallet</span>
      </div>
    </div>
  );
}
