'use client';
import { useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, num, pct } from '@/lib/viz/format';
import type { ChainPageData } from '@/server/weather/chain-page';

export function peersTitle(chain: string, p: ChainPageData['peers']): string {
  if (!p.self || p.self.dexVolumeChange == null) return `${chainName(chain)} isn't in Nansen's chain rankings`;
  const pc = p.growthPercentile == null ? '' : `, ${num(p.growthPercentile * 100, 0)}th percentile of all chains`;
  return `${chainName(chain)} DEX volume ${p.self.dexVolumeChange >= 0 ? 'grew' : 'fell'} ${pct(Math.abs(p.self.dexVolumeChange), 0)} in 7 days${pc}`;
}

/** Slope chart, emphasis form: every chain's DEX volume indexed to 100 at
 *  the prior 7 days, this chain in ink and every peer in the de-emphasis
 *  gray. Indices beyond ±150% are clamped to the plot edge (marked with a
 *  caret) so one outlier chain can't flatten the rest into a line. */
export function PeersSlope({ chain, p }: { chain: string; p: ChainPageData['peers'] }) {
  const [hover, setHover] = useState<string | null>(null);
  if (!p.provenance) return <p className="text-sm text-ink-2">Chain rank unavailable: {'error' in p ? p.error : ''}</p>;
  const rows = p.rows.filter((r) => r.dexVolumeChange != null);
  const W = 320, H = 240, top = 14, bottom = 22, left = 44, right = 96;
  const lo = 0, hi = 250;
  const y = (idx: number) => top + (1 - (Math.min(hi, Math.max(lo, idx)) - lo) / (hi - lo)) * (H - top - bottom);
  const xL = left, xR = W - right;
  const idx = (r: typeof rows[number]) => 100 * (1 + r.dexVolumeChange!);
  const focus = hover ?? chain;
  const ordered = [...rows].sort((a) => (a.chain === focus ? 1 : -1)); // focus drawn last, on top
  const f = rows.find((r) => r.chain === focus);

  return (
    <div>
      <div className="flex justify-end"><InfoPopover p={p.provenance} /></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="DEX volume growth, this chain vs every other chain">
        {[0, 100, 200].map((v) => (
          <g key={v}>
            <line x1={xL} x2={xR} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
            <text x={xL - 6} y={y(v) + 3} textAnchor="end" className="num fill-ink-muted text-[9px]">{v}</text>
          </g>
        ))}
        <text x={xL} y={H - 6} textAnchor="middle" className="fill-ink-muted text-[9px]">prior 7d</text>
        <text x={xR} y={H - 6} textAnchor="middle" className="fill-ink-muted text-[9px]">last 7d</text>
        {ordered.map((r) => {
          const isFocus = r.chain === focus;
          const v = idx(r);
          const clipped = v > hi || v < lo;
          return (
            <g key={r.chain} onPointerEnter={() => setHover(r.chain)} onPointerLeave={() => setHover(null)} className="cursor-default">
              <line x1={xL} y1={y(100)} x2={xR} y2={y(v)} stroke={isFocus ? 'var(--ink-1)' : 'var(--axis)'} strokeWidth={isFocus ? 2 : 1} strokeLinecap="round" />
              <line x1={xL} y1={y(100)} x2={xR} y2={y(v)} stroke="transparent" strokeWidth="10" />
              {isFocus && (
                <>
                  <circle cx={xR} cy={y(v)} r="4" fill="var(--ink-1)" stroke="var(--surface-1)" strokeWidth="2" />
                  <text x={xR + 8} y={y(v) + 3} className="fill-ink text-[10.5px] font-medium">
                    {chainName(r.chain)} {clipped ? (v > hi ? '▲' : '▼') : ''} {num(v, 0)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[11px] text-ink-muted">
        {f && f.chain !== chain ? `${chainName(f.chain)}: ${pct(f.dexVolumeChange)}, ` : ''}hover a line for a peer; {rows.length} chains ranked.
      </p>
    </div>
  );
}
