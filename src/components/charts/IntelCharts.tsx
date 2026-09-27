'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EChart } from '@/components/charts/EChart';
import { useThemeColors, type ThemeColors } from '@/components/charts/useThemeColors';
import { chainName, pct, usd } from '@/lib/viz/format';
import type { GraphLink, GraphNode } from '@/server/graph/series';
import { clusterGraph } from '@/lib/viz/wallet-clusters';

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

/** Wallets tied to the markets they hold or trade, grouped into clusters that share a position pattern. Every tie is a stored Nansen record. Hover a cluster to isolate it, select a node to open it. */
// Majors: the large, liquid markets (perps by coin, spot by symbol, wrapped forms included).
const MAJOR = /^(W|CB)?(BTC|ETH|SOL|HYPE|BNB|XRP|DOGE)$/i;
const marketSymbol = (n: GraphNode) => n.name.replace(/ perp$/i, '').trim();
export const isMajor = (n: GraphNode) => n.kind !== 'wallet' && MAJOR.test(marketSymbol(n));

/** The graph restricted to chosen markets: ties to other markets drop, and wallets left with none drop too. */
export function filterGraph(nodes: GraphNode[], links: GraphLink[], keep: Set<string>) {
  const kept = links.filter((l) => keep.has(l.target));
  const wallets = new Set(kept.map((l) => l.source));
  const value = new Map<string, number>();
  for (const l of kept) value.set(l.target, (value.get(l.target) ?? 0) + l.value);
  return {
    nodes: nodes.filter((n) => (n.kind === 'wallet' ? wallets.has(n.id) : keep.has(n.id) && value.has(n.id))).map((n) => (n.kind === 'wallet' ? n : { ...n, value: value.get(n.id) ?? n.value })),
    links: kept,
  };
}

export function WalletGraph({ nodes: allNodes, links: allLinks }: { nodes: GraphNode[]; links: GraphLink[] }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);
  const markets = useMemo(() => allNodes.filter((n) => n.kind !== 'wallet').sort((a, b) => b.value - a.value), [allNodes]);
  const [scope, setScope] = useState<'majors' | 'all'>('majors');
  const [off, setOff] = useState<Set<string>>(new Set());
  const inScope = useMemo(() => markets.filter((m) => scope === 'all' || isMajor(m)), [markets, scope]);
  const keep = useMemo(() => new Set(inScope.filter((m) => !off.has(m.id)).map((m) => m.id)), [inScope, off]);
  const { nodes, links } = useMemo(() => filterGraph(allNodes, allLinks, keep), [allNodes, allLinks, keep]);
  const L = useMemo(() => clusterGraph(nodes, links), [nodes, links]);
  const toggle = (id: string) => setOff((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picker = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Markets" className="segmented segmented-inline" style={{ '--segments': 2, '--selected': scope === 'majors' ? 0 : 1 } as React.CSSProperties}>
        <span className="segmented-thumb" aria-hidden />
        <button type="button" aria-pressed={scope === 'majors'} onClick={() => setScope('majors')}>Majors</button>
        <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All markets</button>
      </div>
      {inScope.map((m) => {
        const on = !off.has(m.id);
        return (
          <button key={m.id} type="button" aria-pressed={on} onClick={() => toggle(m.id)}
            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${on ? 'border-transparent text-[#04121c]' : 'border-[var(--hair-2)] text-ink-muted hover:text-ink'}`}
            style={on ? { background: m.kind === 'perp' ? 'var(--signal)' : 'var(--amber)' } : undefined}>
            {marketSymbol(m)}{m.kind === 'perp' ? ' perp' : ''}
          </button>
        );
      })}
      {!inScope.length && <span className="text-[12px] text-ink-muted">No major markets in the stored ties right now.</span>}
    </div>
  );
  if (!allNodes.length) return <p className="text-[13px] text-ink-muted">No wallet ties two markets yet; the graph grows as the scanner stores snapshots and trades.</p>;
  if (!L.clusters.length) return <div>{picker}<p className="py-10 text-center text-[13px] text-ink-muted">No wallets hold the selected markets. Turn a market back on or switch to All markets.</p></div>;
  const pts = [...L.markets.map((m) => ({ x: m.x, y: m.y, r: 30 })), ...L.clusters.map((c) => ({ x: c.x, y: c.y, r: c.r + 26 }))];
  const x0 = Math.min(...pts.map((p) => p.x - p.r)) - 110, x1 = Math.max(...pts.map((p) => p.x + p.r)) + 110;
  const y0 = Math.min(...pts.map((p) => p.y - p.r)) - 10, y1 = Math.max(...pts.map((p) => p.y + p.r)) + 10;
  const maxTie = Math.max(1, ...L.clusters.flatMap((c) => c.ties.map((t) => t.value)));
  const maxM = Math.max(1, ...L.markets.map((m) => m.value));
  const mById = new Map(L.markets.map((m) => [m.id, m]));
  const active = hover ? L.clusters.find((c) => c.id === hover) : null;
  const dim = (id: string, markets?: string[]) => (active ? (id === active.id || markets?.some((m) => active.ties.some((t) => t.market === m)) ? 1 : 0.15) : 1);
  const col = (m: GraphNode) => (m.kind === 'perp' ? 'var(--signal)' : 'var(--amber)');
  const top = L.clusters.slice(0, 8);
  return (
    <div>
    {picker}
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} className="h-auto max-h-[520px] w-full" role="img" aria-label={`Wallet network: ${L.wallets.length} wallets in ${L.clusters.length} clusters across ${L.markets.length} markets`} onMouseLeave={() => setHover(null)}>
        <defs><filter id="wg-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter></defs>
        {L.clusters.flatMap((c) => c.ties.map((t) => { const m = mById.get(t.market); if (!m) return null; const up = t.side === 'up';
          const mx = (c.x + m.x) / 2, my = (c.y + m.y) / 2 - (up ? 10 : -10);
          return <path key={`${c.id}-${t.market}`} d={`M${c.x},${c.y} Q${mx},${my} ${m.x},${m.y}`} fill="none" stroke={up ? 'var(--mint)' : 'var(--flare)'} strokeWidth={1 + 9 * Math.sqrt(t.value / maxTie)} strokeOpacity={0.55 * dim(c.id)} strokeLinecap="round" />; }))}
        {L.clusters.map((c) => (
          <g key={c.id} onMouseEnter={() => setHover(c.id)} style={{ opacity: dim(c.id), transition: 'opacity .15s' }} className="cursor-pointer">
            <title>{`${c.label}\n${c.wallets.length} wallets${c.sm ? ` (${c.sm} Smart Money)` : ''} · ${usd(c.value)}\n${c.ties.map((t) => `${mById.get(t.market)?.name}: ${t.side === 'up' ? 'long/bought' : 'short/sold'} ${usd(t.value)}`).join('\n')}`}</title>
            <circle cx={c.x} cy={c.y} r={c.r} fill="var(--surface-2)" stroke={c.ties.every((t) => t.side === 'up') ? 'var(--mint)' : c.ties.every((t) => t.side === 'down') ? 'var(--flare)' : 'var(--amber)'} strokeOpacity={0.7} strokeWidth={1.2} />
            {(() => { const d = Math.hypot(c.x, c.y) || 1, ux = c.x / d, uy = c.y / d, lx = c.x + ux * (c.r + 6), ly = c.y + uy * (c.r + 6) + (uy > 0.3 ? 8 : uy < -0.3 ? -10 : 0), anchor = ux > 0.3 ? 'start' : ux < -0.3 ? 'end' : 'middle'; return (<>
            <text x={lx} y={ly} textAnchor={anchor} className="fill-ink-2 text-[9px] font-semibold">{c.label.length > 34 ? `${c.label.slice(0, 33)}…` : c.label}</text>
            <text x={lx} y={ly + 10} textAnchor={anchor} className="num fill-ink-muted text-[8px]">{c.wallets.length} wallet{c.wallets.length > 1 ? 's' : ''} · {usd(c.value)}</text></>); })()}
          </g>
        ))}
        {L.wallets.map((w) => (
          <circle key={w.id} cx={w.x} cy={w.y} r={w.sm ? 2.6 : 2.1} fill={w.sm ? 'var(--signal)' : 'var(--ink-2)'} opacity={dim(w.cluster)} className="cursor-pointer" onClick={() => router.push(w.href)}>
            <title>{`${w.name}${w.sm ? ' · Smart Money' : ''} · ${usd(w.value)}\nSelect to open`}</title>
          </circle>
        ))}
        {L.markets.map((m) => { const r = 12 + 14 * Math.sqrt(m.value / maxM);
          return (
            <g key={m.id} className="cursor-pointer" onClick={() => router.push(m.href)} style={{ opacity: dim('', [m.id]) }}>
              <title>{`${m.name} · ${usd(m.value)} tied\nSelect to open`}</title>
              <circle cx={m.x} cy={m.y} r={r + 4} fill={col(m)} opacity={0.35} filter="url(#wg-glow)" />
              <circle cx={m.x} cy={m.y} r={r} fill={col(m)} />
              <text x={m.x} y={m.y + 3} textAnchor="middle" className="text-[8.5px] font-extrabold" fill="#04121c">{m.name.replace(/ perp$/, '')}</text>
              <text x={m.x} y={m.y + r + 11} textAnchor="middle" className="num fill-ink-muted text-[7.5px]">{m.kind === 'perp' ? 'perp' : 'token'} · {usd(m.value)}</text>
            </g>
          ); })}
      </svg>
      <div className="min-w-0">
        <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Largest clusters</h3>
        <ol className="divide-y divide-[var(--hair)]">
          {top.map((c) => (
            <li key={c.id} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} className={`cursor-default rounded-md px-1.5 py-2 text-[12.5px] ${hover === c.id ? 'bg-[var(--surface-2)]' : ''}`}>
              <div className="font-semibold text-ink">{c.label}</div>
              <div className="num text-[11.5px] text-ink-muted">{c.wallets.length} wallets{c.sm ? ` · ${c.sm} Smart Money` : ''} · {usd(c.value)}</div>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-muted">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[var(--signal)]" />perp</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[var(--amber)]" />token</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--signal)]" />Smart Money wallet</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[var(--mint)]" />long / bought</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-[var(--flare)]" />short / sold</span>
          <span>Line width = dollars. Ring: green all long, red all short, amber hedged.</span>
        </div>
      </div>
    </div>
    </div>
  );
}

// ------------------------------------------------------------ ranked bars

export type RankRow = { label: string; value: number; href: string; sub?: string };
const fmtBy = { usd: (v: number) => usd(v, { signed: true }), abs: (v: number) => usd(v), pct: (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0)}%`, pts: (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v))}` };

/** Horizontal bars, largest first, signed colours; each bar opens its page. */
export function RankBars({ rows, format = 'usd', height, label }: { rows: RankRow[]; format?: keyof typeof fmtBy; height?: number; label: string }) {
  const c = useThemeColors();
  const router = useRouter();
  const fmt = fmtBy[format];
  const shown = rows.slice(0, 16);
  const option = useMemo(() => c && {
    animationDuration: 500,
    grid: { left: 8, right: 64, top: 6, bottom: 6, containLabel: true },
    tooltip: { trigger: 'item' as const, ...tip(c), formatter: (raw: unknown) => { const i = (raw as { dataIndex: number }).dataIndex; const r = [...shown].reverse()[i]; return `<b>${r.label}</b><br/>${fmt(r.value)}${r.sub ? `<br/><span style="opacity:.7">${r.sub}</span>` : ''}<br/><span style="opacity:.6">Select to open</span>`; } },
    xAxis: { type: 'value' as const, ...axis(c), axisLabel: { show: false }, splitLine: { lineStyle: { color: c.grid } } },
    yAxis: { type: 'category' as const, data: [...shown].reverse().map((r) => r.label), axisLabel: { color: c['ink-2'], fontSize: 11, width: 130, overflow: 'truncate' as const }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: 'bar' as const, barMaxWidth: 12, data: [...shown].reverse().map((r) => ({ value: r.value, itemStyle: { color: r.value >= 0 ? c.mint : c.flare, borderRadius: r.value >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3] } })),
      label: { show: true, position: 'right' as const, color: c['ink-2'], fontSize: 10.5, formatter: (raw: unknown) => fmt(Number((raw as { value: number }).value)) } }],
  }, [c, shown, fmt]);
  if (!shown.length) return <p className="text-[13px] text-ink-muted">No readings yet.</p>;
  return option ? <EChart option={option} height={height ?? Math.max(160, shown.length * 24 + 16)} ariaLabel={label} onEvents={{ click: (e: { dataIndex: number }) => { const r = [...shown].reverse()[e.dataIndex]; if (r) router.push(r.href); } }} /> : null;
}

// ----------------------------------------------------------- history lines

/** Lines over time on one scale, with crosshair tooltip; a legend below. */
export function HistoryLines({ series, format = 'usd', height = 260, label, zeroLine = false }: { series: Array<{ name: string; points: Array<[number, number]>; href?: string }>; format?: keyof typeof fmtBy; height?: number; label: string; zeroLine?: boolean }) {
  const c = useThemeColors();
  const router = useRouter();
  const palette = c ? [c.mint, c.signal, c.amber, c.violet, c.flare, c['ink-2']] : [];
  const fmt = format === 'usd' ? (v: number) => usd(v, { signed: zeroLine }) : fmtBy[format];
  const option = useMemo(() => c && {
    animationDuration: 500,
    grid: { left: 64, right: 16, top: 12, bottom: 28 },
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'cross' as const, lineStyle: { color: c.axis } }, ...tip(c), valueFormatter: (v: unknown) => fmt(Number(v)) },
    xAxis: { type: 'time' as const, ...axis(c), splitLine: { show: false } },
    yAxis: { type: 'value' as const, scale: !zeroLine, ...axis(c), axisLabel: { ...axis(c).axisLabel, formatter: (v: number) => (format === 'usd' ? usd(v) : String(v)) } },
    dataZoom: [{ type: 'inside' as const }],
    series: series.map((s, i) => ({ name: s.name, type: 'line' as const, data: s.points, showSymbol: false, smooth: 0.25, lineStyle: { width: 1.8, color: palette[i % palette.length] }, itemStyle: { color: palette[i % palette.length] }, emphasis: { focus: 'series' as const },
      ...(series.length === 1 ? { areaStyle: { color: palette[0], opacity: 0.08 } } : {}),
      ...(i === 0 && zeroLine ? { markLine: { silent: true, symbol: 'none', lineStyle: { color: c.axis, type: 'dashed' as const }, data: [{ yAxis: 0 }], label: { show: false } } } : {}) })),
  }, [c, series, format, zeroLine]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!series.some((s) => s.points.length > 1)) return <p className="text-[13px] text-ink-muted">History builds with each scan.</p>;
  return (
    <div>
      {option && <EChart option={option} height={height} ariaLabel={label} onEvents={{ click: (e: { seriesIndex: number }) => { const h = series[e.seriesIndex]?.href; if (h) router.push(h); } }} />}
      {series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-3 text-[11.5px] text-ink-2">
          {series.map((s, i) => {
            const last = s.points.at(-1)?.[1];
            const body = <><span className="h-0.5 w-3" style={{ background: palette[i % palette.length] }} />{s.name}{last != null ? <span className="num text-ink-muted">{fmt(last)}</span> : null}</>;
            return s.href ? <button key={s.name} type="button" onClick={() => router.push(s.href!)} className="flex items-center gap-1 hover:text-ink">{body}</button> : <span key={s.name} className="flex items-center gap-1">{body}</span>;
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------- prediction market charts

/** Probability (line, 0–100) over hourly volume (bars), sharing a zoomable time axis with a crosshair. */
export function ProbabilityChart({ candles, height = 340 }: { candles: Array<{ t: string; close: number; volume: number }>; height?: number }) {
  const c = useThemeColors();
  const option = useMemo(() => {
    if (!c) return null;
    const pts = candles.map((x) => [Date.parse(x.t), Math.round(x.close * 1000) / 10] as [number, number]);
    const vol = candles.map((x) => [Date.parse(x.t), Math.round(x.volume)] as [number, number]);
    return {
      animationDuration: 500,
      axisPointer: { link: [{ xAxisIndex: 'all' as const }] },
      grid: [{ left: 48, right: 16, top: 12, height: '58%' }, { left: 48, right: 16, top: '74%', bottom: 44 }],
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'cross' as const, lineStyle: { color: c.axis } }, ...tip(c), formatter: (raw: unknown) => {
        const ps = raw as Array<{ seriesName: string; value: [number, number] }>;
        const t = ps[0]?.value[0]; const p = ps.find((x) => x.seriesName === 'YES'); const v = ps.find((x) => x.seriesName === 'Volume');
        return `<b>${t ? new Date(t).toISOString().slice(5, 16).replace('T', ' ') : ''} UTC</b>${p ? `<br/>YES ${p.value[1]}%` : ''}${v ? `<br/>Volume ${usd(v.value[1])}` : ''}`;
      } },
      xAxis: [{ type: 'time' as const, gridIndex: 0, ...axis(c), axisLabel: { show: false }, splitLine: { show: false } }, { type: 'time' as const, gridIndex: 1, ...axis(c), splitLine: { show: false } }],
      yAxis: [{ type: 'value' as const, gridIndex: 0, min: 0, max: 100, ...axis(c), axisLabel: { ...axis(c).axisLabel, formatter: '{value}%' } }, { type: 'value' as const, gridIndex: 1, ...axis(c), splitNumber: 2, axisLabel: { ...axis(c).axisLabel, formatter: (v: number) => usd(v) } }],
      dataZoom: [{ type: 'inside' as const, xAxisIndex: [0, 1] }, { type: 'slider' as const, xAxisIndex: [0, 1], height: 16, bottom: 6, borderColor: c.axis, fillerColor: 'rgba(127,127,127,.15)', textStyle: { color: c['ink-muted'] } }],
      series: [
        { name: 'YES', type: 'line' as const, xAxisIndex: 0, yAxisIndex: 0, data: pts, showSymbol: false, smooth: 0.2, lineStyle: { width: 2, color: c.signal }, itemStyle: { color: c.signal }, areaStyle: { color: c.signal, opacity: 0.1 },
          markLine: { silent: true, symbol: 'none', lineStyle: { color: c.axis, type: 'dashed' as const }, data: [{ yAxis: 50 }], label: { show: false } } },
        { name: 'Volume', type: 'bar' as const, xAxisIndex: 1, yAxisIndex: 1, data: vol, barMaxWidth: 6, itemStyle: { color: c['ink-muted'], opacity: 0.6 } },
      ],
    };
  }, [c, candles]);
  if (candles.length < 2) return <p className="text-[13px] text-ink-muted">Nansen returned no price history for this market.</p>;
  return option ? <EChart option={option} height={height} ariaLabel={`YES probability and hourly volume over ${candles.length} hours`} /> : null;
}

/** Cumulative order-book depth around the price: bids (buy YES) left, asks right. */
export function DepthChart({ bids, asks, height = 200 }: { bids: Array<{ price: number; size: number }>; asks: Array<{ price: number; size: number }>; height?: number }) {
  const c = useThemeColors();
  const option = useMemo(() => {
    if (!c) return null;
    const cum = (xs: Array<{ price: number; size: number }>) => { let a = 0; return xs.map((x) => { a += x.price * x.size; return [Math.round(x.price * 1000) / 10, Math.round(a)] as [number, number]; }); };
    const b = cum(bids.slice(0, 40)).reverse(), a = cum(asks.slice(0, 40));
    return {
      animationDuration: 400,
      grid: { left: 52, right: 12, top: 10, bottom: 26 },
      tooltip: { trigger: 'axis' as const, ...tip(c), valueFormatter: (v: unknown) => usd(Number(v)) },
      xAxis: { type: 'value' as const, scale: true, ...axis(c), axisLabel: { ...axis(c).axisLabel, formatter: '{value}%' }, splitLine: { show: false } },
      yAxis: { type: 'value' as const, ...axis(c), axisLabel: { ...axis(c).axisLabel, formatter: (v: number) => usd(v) } },
      series: [
        { name: 'Bids', type: 'line' as const, step: 'end' as const, data: b, showSymbol: false, lineStyle: { color: c.mint, width: 1.5 }, areaStyle: { color: c.mint, opacity: 0.15 } },
        { name: 'Asks', type: 'line' as const, step: 'start' as const, data: a, showSymbol: false, lineStyle: { color: c.flare, width: 1.5 }, areaStyle: { color: c.flare, opacity: 0.15 } },
      ],
    };
  }, [c, bids, asks]);
  if (!bids.length && !asks.length) return <p className="text-[13px] text-ink-muted">No order book returned.</p>;
  return option ? <EChart option={option} height={height} ariaLabel="Cumulative order book depth for YES shares" /> : null;
}

// ------------------------------------------------------------ allocation

/** Portfolio treemap: chains as groups, assets inside, area = USD value; a tile opens the token. */
export function AllocationTreemap({ items, height = 320 }: { items: Array<{ chain: string; symbol: string; href: string; value: number; share: number }>; height?: number }) {
  const c = useThemeColors();
  const router = useRouter();
  const option = useMemo(() => {
    if (!c) return null;
    const palette = [c.mint, c.signal, c.amber, c.violet, c.flare, c['ink-2']];
    const chains = [...new Set(items.map((i) => i.chain))];
    return {
      animationDuration: 400,
      tooltip: { ...tip(c), formatter: (raw: unknown) => { const d = (raw as { data: { name: string; value: number; share?: number; chain?: string } }).data; return `<b>${d.name}</b>${d.chain ? ` · ${chainName(d.chain)}` : ''}<br/>${usd(d.value)}${d.share != null ? ` · ${(d.share * 100).toFixed(1)}%` : ''}`; } },
      series: [{
        type: 'treemap', name: 'Portfolio', roam: false, nodeClick: false, breadcrumb: { show: false }, width: '100%', height: '100%', top: 0, left: 0,
        levels: [{ upperLabel: { show: false }, itemStyle: { borderColor: c['surface-page'], borderWidth: 0, gapWidth: 3 } }, { itemStyle: { borderColor: c['surface-page'], borderWidth: 3, gapWidth: 2 } }, { itemStyle: { borderColor: c['surface-1'], borderWidth: 1, gapWidth: 1 } }],
        upperLabel: { show: true, height: 18, color: c['ink-1'], fontSize: 11, fontWeight: 'bold' },
        label: { show: true, formatter: (p: { data: { name: string; share?: number } }) => `${p.data.name}\n${((p.data.share ?? 0) * 100).toFixed(1)}%`, color: '#fff', fontSize: 11, fontWeight: 'bold' },
        data: chains.map((ch, i) => ({ name: chainName(ch), value: items.filter((x) => x.chain === ch).reduce((a, x) => a + x.value, 0), itemStyle: { color: palette[i % palette.length] },
          children: items.filter((x) => x.chain === ch).map((x) => ({ name: x.symbol, value: x.value, share: x.share, chain: ch, href: x.href, itemStyle: { color: palette[i % palette.length], opacity: 0.35 + 0.65 * Math.min(1, x.share * 4) } })) })),
      }],
    };
  }, [c, items]);
  if (!items.length) return <p className="text-[13px] text-ink-muted">No priced holdings.</p>;
  return option ? <EChart option={option as never} height={height} ariaLabel="Portfolio allocation by chain and asset" onEvents={{ click: (e: { data?: { href?: string } }) => { if (e.data?.href) router.push(e.data.href); } }} /> : null;
}
