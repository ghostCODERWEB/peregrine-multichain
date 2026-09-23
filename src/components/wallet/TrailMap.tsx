'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { layoutHexMap, hexPoints } from '@/lib/viz/hexmap-layout';
import { chainName, usd } from '@/lib/viz/format';
import { TimeAgo } from '@/components/TimeAgo';
import type { TrailStep } from '@/server/wallet/wallet-page';

/**
 * The migration trail drawn over the weather map's own hex layout: every
 * chain a faint outline, the chains this wallet traded on filled, and the
 * path between consecutive chain hops numbered in time order.
 */
export function TrailMap({ steps }: { steps: TrailStep[] }) {
  const layout = useMemo(() => layoutHexMap(20, 640, 22), []);
  const pos = useMemo(() => new Map(layout.tiles.map((t) => [t.chain, t])), [layout]);
  const hops: Array<{ chain: string; first: number }> = [];
  steps.forEach((s, i) => { if (hops.at(-1)?.chain !== s.chain) hops.push({ chain: s.chain, first: i }); });
  const visited = new Set(steps.map((s) => s.chain));
  const pad = 6;

  return (
    <div>
      <svg viewBox={`${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}`} className="h-auto w-full" role="img" aria-label="This wallet's path across chains">
        <defs>
          <marker id="trail-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--storm-3)" />
          </marker>
        </defs>
        {layout.tiles.map((t) => (
          <polygon key={t.chain} points={hexPoints(t.cx, t.cy, layout.radius - 1)}
            fill={visited.has(t.chain) ? 'var(--surface-2)' : 'none'}
            stroke={visited.has(t.chain) ? 'var(--ink-2)' : 'var(--grid)'} strokeWidth={visited.has(t.chain) ? 1.5 : 1} />
        ))}
        {hops.slice(1).map((h, i) => {
          const a = pos.get(hops[i].chain), b = pos.get(h.chain);
          if (!a || !b) return null;
          // Stop short of the centres so the arrowhead sits on the hex edge.
          const dx = b.cx - a.cx, dy = b.cy - a.cy, d = Math.hypot(dx, dy) || 1, k = (layout.radius * 0.6) / d;
          const mx = (a.cx + b.cx) / 2 - dy * 0.18, my = (a.cy + b.cy) / 2 + dx * 0.18;
          return (
            <path key={i} d={`M${a.cx + dx * k},${a.cy + dy * k} Q${mx},${my} ${b.cx - dx * k},${b.cy - dy * k}`}
              fill="none" stroke="var(--storm-3)" strokeWidth="2" markerEnd="url(#trail-head)" opacity={0.5 + 0.5 * ((i + 1) / hops.length)} />
          );
        })}
        {layout.tiles.map((t) => (
          <text key={t.chain} x={t.cx} y={t.cy + 3} textAnchor="middle"
            className={`pointer-events-none text-[7px] ${visited.has(t.chain) ? 'fill-ink font-semibold' : 'fill-ink-muted'}`}>
            {chainName(t.chain).slice(0, 8)}
          </text>
        ))}
        {(() => {
          // A chain visited more than once gets its step numbers side by side.
          const seen = new Map<string, number>();
          return hops.map((h, i) => {
            const p = pos.get(h.chain);
            if (!p) return null;
            const k = seen.get(h.chain) ?? 0;
            seen.set(h.chain, k + 1);
            const x = p.cx + layout.radius * 0.62 + k * 12, y = p.cy - layout.radius * 0.62;
            return (
              <g key={`n${i}`}>
                <circle cx={x} cy={y} r="6" fill="var(--storm-3)" stroke="var(--surface-1)" strokeWidth="1.5" />
                <text x={x} y={y + 3} textAnchor="middle" className="num fill-[var(--on-storm-3)] text-[7.5px] font-semibold">{i + 1}</text>
              </g>
            );
          });
        })()}
      </svg>
      <ol className="mt-3 max-h-[260px] space-y-1 overflow-y-auto text-[12.5px]">
        {[...steps].reverse().map((s, i) => (
          <li key={i} className="flex items-center gap-2 border-b border-border/50 py-1">
            <span className="num w-16 shrink-0 text-ink-muted"><TimeAgo ts={s.at} /></span>
            <span className="inline-flex w-12 shrink-0 items-center gap-1 text-ink-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.side === 'buy' ? 'var(--in-3)' : 'var(--out-3)' }} aria-hidden />
              {s.side === 'buy' ? 'Buy' : 'Sell'}
            </span>
            <Link href={`/token/${s.chain}/${encodeURIComponent(s.tokenAddress)}`} className="min-w-0 flex-1 truncate text-ink hover:underline">{s.symbol ?? s.tokenAddress.slice(0, 8)}</Link>
            <span className="shrink-0 text-ink-muted">{chainName(s.chain)}</span>
            <span className="num w-20 shrink-0 text-right text-ink">{usd(s.usd)}{s.count > 1 && <span className="ml-1 text-[11px] text-ink-muted">×{s.count}</span>}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
