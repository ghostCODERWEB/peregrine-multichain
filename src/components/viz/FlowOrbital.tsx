'use client';
// The Overview hero's flow teaser: net sellers on the left of a ring, net
// buyers on the right, each flow an arc bowing through the middle from seller
// to buyer, sized by net USD, with particles along it. The full map and
// detail live on /flows.
//
// Built on the same geometry as the Capital Flows ring (flowLayout): arcs
// start and end at a node's rim and curve toward the centre, so they never
// cross a node, and labels sit on the outside of the ring, away from the
// arcs. At most MAX_PER_SIDE chains a side, in viewBox units, so it holds
// at any screen width.
import { useId } from 'react';
import { chainLogoSrc, SvgChainLogo } from '@/components/Logo';
import { flowLayout } from '@/lib/viz/flow-layout';
import { chainName, usd } from '@/lib/viz/format';

/** A rotation (owner view) or a modeled net-flow arc (public view). */
export interface OrbitalFlow { from: string; to: string; netUsd: number; walletCount: number; inferred?: boolean }

const W = 460, H = 340, RING = 0.4;
export const MAX_PER_SIDE = 3;
const NODE_R = 21;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Pure placement (exported for tests): the ring layout, capped per side,
 *  with at most five flows drawn, largest first. */
export function orbitalLayout(all: OrbitalFlow[]) {
  const edges = all.filter((f) => !f.inferred).sort((a, b) => b.netUsd - a.netUsd)
    .map((f) => ({ from: f.from, to: f.to, netUsd: f.netUsd, walletCount: f.walletCount, confidence: 1 }));
  const full = flowLayout(edges, W, H, RING, MAX_PER_SIDE, NODE_R + 5); // lines meet the outer ring
  return { ...full, arcs: full.arcs.slice(0, 5) };
}

export function FlowOrbital({ fronts, modeled = false, nets }: { fronts: OrbitalFlow[]; modeled?: boolean; nets?: Map<string, number> }) {
  const id = useId().replace(/:/g, '');
  if (!fronts.some((f) => !f.inferred)) return <p className="px-6 text-sm text-ink-muted">{modeled ? 'Not enough measured net flow on both sides yet.' : 'No qualifying same-wallet rotations in the last 24 hours.'}</p>;
  const { nodes, arcs, maxUsd } = orbitalLayout(fronts);
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * RING;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="group"
      aria-label={`${modeled ? 'Market-wide net flow, 24 hours, modeled arcs' : 'Capital rotations in 24 hours'}: ${arcs.map((a) => `${chainName(a.from)} to ${chainName(a.to)} ${usd(a.edge.netUsd)}`).join('; ')}`}>
      <defs>
        <radialGradient id={`${id}-glow`}><stop stopColor="var(--mint)" stopOpacity=".13" /><stop offset="1" stopColor="var(--mint)" stopOpacity="0" /></radialGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        {arcs.map((a, i) => (
          <linearGradient key={a.key} id={`${id}-g${i}`} gradientUnits="userSpaceOnUse" x1={r1(a.x1)} y1={r1(a.y1)} x2={r1(a.x2)} y2={r1(a.y2)}>
            <stop stopColor="var(--flare)" /><stop offset="1" stopColor="var(--mint)" />
          </linearGradient>
        ))}
      </defs>
      <circle cx={cx} cy={cy} r={r1(R + 46)} fill={`url(#${id}-glow)`} />
      <circle cx={cx} cy={cy} r={r1(R)} fill="none" stroke="var(--hair-2)" />
      <circle cx={cx} cy={cy} r={r1(R * 0.55)} fill="none" stroke="var(--hair)" strokeDasharray="2 6" />

      {arcs.map((a, i) => {
        const k = Math.sqrt(a.edge.netUsd / maxUsd), w = r1(1.6 + 6 * k), lead = i === 0;
        // Particles carry the lead arc; the rest stay quiet so one story reads first.
        const n = lead ? (modeled ? 3 + Math.round(2 * k) : Math.max(3, Math.min(5, Math.round(a.edge.walletCount / 2) + 1))) : 1;
        const draw = { '--i': i } as React.CSSProperties;
        const dur = (3.4 + i * 0.3).toFixed(2);
        return (
          <g key={a.key}>
            {lead && <path d={a.d} pathLength={1} className="arc-draw" style={draw} fill="none" stroke={`url(#${id}-g${i})`} strokeWidth={w + 6} strokeOpacity={0.3} filter={`url(#${id}-blur)`} />}
            <path id={`${id}-p${i}`} d={a.d} pathLength={1} className="arc-draw" style={draw} fill="none" stroke={`url(#${id}-g${i})`} strokeWidth={w} strokeLinecap="butt" strokeOpacity={lead ? 0.95 : 0.4} />
            {Array.from({ length: n }, (_, j) => (
              <circle key={j} r={lead ? 2.5 : 1.9} fill="#EFFFF8" fillOpacity={lead ? 1 : 0.75} className="flow-particle">
                <animateMotion dur={`${dur}s`} begin={`${(-(j / n) * Number(dur)).toFixed(2)}s`} repeatCount="indefinite"><mpath href={`#${id}-p${i}`} /></animateMotion>
              </circle>
            ))}
            <circle className="flow-static hidden" cx={r1(a.x2)} cy={r1(a.y2)} r="3" fill="var(--mint)" />
          </g>
        );
      })}

      {nodes.map((nd, ni) => {
        const v = nets?.get(nd.chain) ?? nd.net, col = v >= 0 ? 'var(--mint)' : 'var(--flare)', src = chainLogoSrc(nd.chain);
        const left = nd.side === 'left', lx = r1(nd.x + (left ? -(NODE_R + 9) : NODE_R + 9)), anchor = left ? 'end' : 'start';
        return (
          <a key={nd.chain} href={`/chain/${nd.chain}`} aria-label={`${chainName(nd.chain)}: open chain`} className="orbital-node">
          <g className="node-in" style={{ '--i': ni } as React.CSSProperties}>
            <circle cx={nd.x} cy={nd.y} r={NODE_R + 5} fill="none" stroke={col} strokeOpacity={0.3} />
            <circle cx={nd.x} cy={nd.y} r={NODE_R} fill="var(--surface-1)" stroke="var(--hair-2)" />
            {src ? <SvgChainLogo chain={nd.chain} x={r1(nd.x - 11)} y={r1(nd.y - 11)} size={22} />
              : <text x={nd.x} y={r1(nd.y + 4)} textAnchor="middle" className="fill-ink text-[11px] font-bold">{chainName(nd.chain).slice(0, 2)}</text>}
            <text x={lx} y={r1(nd.y - 2)} textAnchor={anchor} className="fill-ink text-[12.5px] font-bold">{chainName(nd.chain)}</text>
            <text x={lx} y={r1(nd.y + 13)} textAnchor={anchor} className="num text-[11px] font-bold" style={{ fill: col }}>{v >= 0 ? '+' : '−'}{usd(Math.abs(v))}</text>
          </g>
          </a>
        );
      })}
      <text x={14} y={H - 8} className="fill-[var(--flare)] text-[10px] font-extrabold tracking-[0.08em]">{modeled ? 'NET OUTFLOW' : 'NET SELLERS'}</text>
      <text x={W - 14} y={H - 8} textAnchor="end" className="fill-[var(--mint)] text-[10px] font-extrabold tracking-[0.08em]">{modeled ? 'NET INFLOW' : 'NET BUYERS'}</text>
      {modeled && <text x={cx} y={H - 8} textAnchor="middle" className="fill-ink-muted text-[10px] font-bold">arcs modeled · nodes measured</text>}
    </svg>
  );
}
