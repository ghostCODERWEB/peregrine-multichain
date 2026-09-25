'use client';
// The Radar hero's rotation teaser: chains on a tilted orbit (net sellers on
// the left, net buyers on the right, nearer = larger), each flow a raised arc
// from the selling chain to the buying one, sized by net USD, with particles
// for the wallets behind it. The full map and detail live on /flows.
import { useId } from 'react';
import { chainLogoSrc } from '@/components/Logo';
import { chainName, usd } from '@/lib/viz/format';
/** A rotation (owner view) or a modeled net-flow arc (public view). */
export interface OrbitalFlow { from: string; to: string; netUsd: number; walletCount: number; inferred?: boolean }

const W = 440, H = 330, CX = 220, CY = 212, RX = 176, RY = 70;
// Server and browser trig can differ in the last digit; rounded coordinates
// keep hydration stable.
const r1 = (n: number) => Math.round(n * 10) / 10;

export function FlowOrbital({ fronts, modeled = false }: { fronts: OrbitalFlow[]; modeled?: boolean }) {
  const id = useId().replace(/:/g, '');
  const flows = fronts.filter((f) => !f.inferred).slice(0, 6);
  if (!flows.length) return <p className="px-6 text-sm text-ink-muted">{modeled ? 'Not enough measured net flow on both sides yet.' : 'No qualifying same-wallet rotations in the last 24 hours.'}</p>;

  const net = new Map<string, number>();
  for (const f of flows) {
    net.set(f.from, (net.get(f.from) ?? 0) - f.netUsd);
    net.set(f.to, (net.get(f.to) ?? 0) + f.netUsd);
  }
  // Sellers fill the left half of the orbit, buyers the right; within a side,
  // the largest mover sits nearest the viewer.
  const place = (chains: string[], from: number, to: number) => chains.map((chain, i) => {
    const deg = chains.length === 1 ? (from + to) / 2 : from + ((to - from) * i) / (chains.length - 1);
    const a = (deg * Math.PI) / 180, depth = (Math.sin(a) + 1) / 2;
    return { chain, x: r1(CX + RX * Math.cos(a)), y: r1(CY + RY * Math.sin(a)), s: 0.8 + 0.3 * depth, depth };
  });
  const byNet = [...net.entries()].sort((a, b) => a[1] - b[1]);
  const sellers = byNet.filter(([, v]) => v < 0).map(([c]) => c);
  const buyers = byNet.filter(([, v]) => v >= 0).map(([c]) => c).reverse();
  const nodes = [...place(sellers, 150, 235), ...place(buyers, -55, 30)];
  const at = new Map(nodes.map((n) => [n.chain, n]));
  const max = Math.max(...flows.map((f) => f.netUsd), 1);

  const arcs = flows.map((f, i) => {
    const a = at.get(f.from)!, b = at.get(f.to)!, k = Math.sqrt(f.netUsd / max);
    const qx = r1((a.x + b.x) / 2), qy = r1(Math.max(18, Math.min(a.y, b.y) - 50 - 70 * k));
    // Rotations: more wallets, more particles. Modeled arcs have no wallets: size decides.
    const n = modeled ? 2 + Math.round(3 * k) : Math.max(2, Math.min(6, Math.round(f.walletCount / 2) + 1));
    return { f, i, a, b, d: `M${a.x},${a.y} Q${qx},${qy} ${b.x},${b.y}`, w: r1(1.6 + 7 * k), n };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`${modeled ? 'Market-wide net flow, 24 hours, modeled arcs' : 'Capital rotations in 24 hours'}: ${flows.map((f) => `${chainName(f.from)} to ${chainName(f.to)} ${usd(f.netUsd)}`).join('; ')}`}>
      <defs>
        <radialGradient id={`${id}-floor`}><stop stopColor="var(--mint)" stopOpacity=".16" /><stop offset="1" stopColor="var(--mint)" stopOpacity="0" /></radialGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
        {arcs.map(({ i, a, b }) => (
          <linearGradient key={i} id={`${id}-g${i}`} gradientUnits="userSpaceOnUse" x1={a.x} y1={0} x2={b.x} y2={0}>
            <stop stopColor="var(--flare)" /><stop offset="1" stopColor="var(--mint)" />
          </linearGradient>
        ))}
      </defs>
      <ellipse cx={CX} cy={CY + 8} rx={RX + 34} ry={RY + 46} fill={`url(#${id}-floor)`} />
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="var(--hair-2)" />
      <ellipse cx={CX} cy={CY} rx={r1(RX * 0.7)} ry={r1(RY * 0.7)} fill="none" stroke="var(--hair)" strokeDasharray="2 6" />
      <text x={24} y={H - 8} className="fill-[var(--flare)] text-[10px] font-extrabold tracking-[0.08em]">{modeled ? 'NET OUTFLOW' : 'NET SELLERS'}</text>
      <text x={W - 24} y={H - 8} textAnchor="end" className="fill-[var(--mint)] text-[10px] font-extrabold tracking-[0.08em]">{modeled ? 'NET INFLOW' : 'NET BUYERS'}</text>
      {modeled && <text x={CX} y={H - 8} textAnchor="middle" className="fill-ink-muted text-[10px] font-bold">arcs modeled · nodes measured</text>}

      {arcs.map(({ i, d, w }) => (
        <g key={i}>
          {i === 0 && <path d={d} fill="none" stroke={`url(#${id}-g${i})`} strokeWidth={w + 6} strokeOpacity={0.35} filter={`url(#${id}-blur)`} />}
          <path id={`${id}-p${i}`} d={d} fill="none" stroke={`url(#${id}-g${i})`} strokeWidth={w} strokeLinecap="round" strokeOpacity={i === 0 ? 0.95 : 0.5} />
        </g>
      ))}
      {arcs.map(({ i, n, b }) => (
        <g key={`p${i}`}>
          {Array.from({ length: n }, (_, j) => (
            <circle key={j} r={i === 0 ? 2.6 : 2} fill="#EFFFF8" className="flow-particle">
              <animateMotion dur={`${(3.2 + i * 0.35).toFixed(2)}s`} begin={`${(-(j / n) * (3.2 + i * 0.35)).toFixed(2)}s`} repeatCount="indefinite">
                <mpath href={`#${id}-p${i}`} />
              </animateMotion>
            </circle>
          ))}
          <circle className="flow-static hidden" cx={b.x} cy={b.y} r="3" fill="var(--mint)" />
        </g>
      ))}

      {[...nodes].sort((p, q) => p.depth - q.depth).map((n) => {
        const r = r1(19 * n.s), v = net.get(n.chain) ?? 0, src = chainLogoSrc(n.chain);
        return (
          <g key={n.chain}>
            <ellipse cx={n.x} cy={r1(n.y + r * 0.8)} rx={r} ry={r1(r * 0.5)} fill="#000" fillOpacity={0.35} filter={`url(#${id}-blur)`} />
            <circle cx={n.x} cy={n.y} r={r} fill="var(--surface-1)" stroke={v >= 0 ? 'var(--mint)' : 'var(--flare)'} strokeOpacity={0.45} />
            {src ? <image href={src} x={r1(n.x - r * 0.55)} y={r1(n.y - r * 0.55)} width={r1(r * 1.1)} height={r1(r * 1.1)} />
              : <text x={n.x} y={r1(n.y + 4)} textAnchor="middle" className="fill-ink text-[11px] font-bold">{chainName(n.chain).slice(0, 2)}</text>}
            <text x={n.x} y={r1(n.y + r + 15)} textAnchor="middle" className="fill-ink-2 text-[11.5px] font-bold">{chainName(n.chain)}</text>
          </g>
        );
      })}
    </svg>
  );
}
