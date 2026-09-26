'use client';
import { useMemo, useState } from 'react';
import { chainName, pct, usd } from '@/lib/viz/format';
import type { DeskHolding } from '@/server/smart-money/desk';
import { Go, Back, Up } from '@/components/ui/Icons';

const W = 760,
  H = 420,
  PAD = { l: 52, r: 18, t: 18, b: 40 };
const X_MAX = 0.25;
// Symmetric log: most daily balance changes sit within ±2%, so a linear
// axis would stack them on the zero line. ±1%, ±5% and ±25% get room each.
const K = 0.01;
const symlog = (c: number) => (Math.sign(c) * Math.log1p(Math.abs(Math.max(-X_MAX, Math.min(X_MAX, c))) / K)) / Math.log1p(X_MAX / K);

/**
 * Where smart money is leaning, in one picture. Across: the cohort's 24h
 * balance change (right = adding, left = trimming; beyond ±25% pinned to
 * the edge, symmetric-log so small moves spread out). Up: how many smart-money wallets hold it (log scale, so a
 * 5-wallet niche and a 150-wallet crowd both read). Size: value held.
 * A mint ring marks tokens that top-PnL wallets hold among their five
 * largest balances; a magenta ring marks a crowded exit.
 */
export function ConvictionMap({
  holdings,
  crowdedAt,
  onPick,
}: {
  holdings: DeskHolding[];
  crowdedAt: number;
  onPick?: (h: DeskHolding) => void;
}) {
  const [hover, setHover] = useState<DeskHolding | null>(null);
  const pts = useMemo(() => holdings.filter((h) => h.change24h != null && h.holders > 0), [holdings]);
  if (!pts.length) return <p className="text-sm text-ink-2">Nansen returned no smart-money balance changes to plot.</p>;

  const maxH = Math.max(2, ...pts.map((h) => h.holders));
  const maxV = Math.max(1, ...pts.map((h) => h.valueUsd));
  const x = (c: number) => PAD.l + ((symlog(c) + 1) / 2) * (W - PAD.l - PAD.r);
  // Headroom above the busiest token so its bubble isn't cut by the frame.
  const y = (n: number) => H - PAD.b - (Math.log(n) / Math.log(maxH * 1.4)) * (H - PAD.t - PAD.b);
  const r = (v: number) => 3 + Math.sqrt(v / maxV) * 19;
  const yTicks = [1, 3, 10, 30, 100, 300].filter((t) => t <= maxH);
  const order = [...pts].sort((a, b) => b.valueUsd - a.valueUsd);
  // Direct labels for the largest holdings and the strongest convictions,
  // placed right of the bubble (or left when that is off the plot), and
  // skipped when they would overlap one already placed.
  const wanted = [...pts]
    .filter((p) => p.conviction != null)
    .sort((a, b) => Math.abs(b.conviction!) - Math.abs(a.conviction!))
    .slice(0, 5)
    .concat(order.slice(0, 10));
  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
  const crowdLabel = `crowded (top fifth, ≥${crowdedAt} wallets)`;
  const showCrowd = crowdedAt > 1 && crowdedAt <= maxH;
  // The crowded line's own label claims its space first.
  if (showCrowd) placed.push({ x: W - PAD.r - 4 - crowdLabel.length * 5.8, y: y(crowdedAt) - 16, w: crowdLabel.length * 5.8, h: 13 });
  const labels = new Map<string, { x: number; y: number; anchor: 'start' | 'end' }>();
  const hit = (b: { x: number; y: number; w: number; h: number }) =>
    placed.some((o) => b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h);
  for (const p of wanted) {
    const k = p.chain + p.tokenAddress;
    if (labels.has(k)) continue;
    const cx = x(p.change24h!),
      cy = y(p.holders),
      rr = r(p.valueUsd),
      w = p.symbol.length * 6.6 + 2;
    for (const side of ['start', 'end'] as const) {
      const bx = side === 'start' ? cx + rr + 4 : cx - rr - 4 - w;
      const box = { x: bx, y: cy - 9, w, h: 13 };
      if (bx < PAD.l || bx + w > W - PAD.r || hit(box)) continue;
      placed.push(box);
      labels.set(k, { x: side === 'start' ? bx : bx + w, y: cy + 4, anchor: side });
      break;
    }
  }

  return (
    <div className="relative">
      <div tabIndex={0} role="region" aria-label="Conviction map" className="-mx-1 overflow-x-auto px-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[600px]"
          role="img"
          aria-label={`Conviction map: ${pts.length} tokens by smart money's 24h balance change and wallets holding. ${pts.filter((p) => p.change24h! > 0).length} being added to, ${pts.filter((p) => p.change24h! < 0).length} trimmed.`}
        >
          {/* quadrants */}
          <rect x={x(0)} y={PAD.t} width={W - PAD.r - x(0)} height={H - PAD.t - PAD.b} fill="var(--in-2)" opacity={0.04} />
          <rect x={PAD.l} y={PAD.t} width={x(0) - PAD.l} height={H - PAD.t - PAD.b} fill="var(--out-2)" opacity={0.04} />
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-muted text-[11px]">
                {t}
              </text>
            </g>
          ))}
          {[-0.25, -0.05, -0.01, 0, 0.01, 0.05, 0.25].map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'}
                strokeDasharray={t === 0 ? undefined : '2 4'}
              />
              <text x={x(t)} y={H - PAD.b + 16} textAnchor="middle" className="fill-ink-muted text-[11px]">
                {t > 0 ? '+' : t < 0 ? '−' : ''}
                {Math.abs(t * 100)}%{Math.abs(t) === X_MAX ? '+' : ''}
              </text>
            </g>
          ))}
          <text x={W - PAD.r} y={H - 6} textAnchor="end" className="fill-ink-2 text-[11px]">
            adding <Go />
          </text>
          <text x={PAD.l} y={H - 6} className="fill-ink-2 text-[11px]">
            <Back /> trimming
          </text>
          <text x={12} y={PAD.t + 4} className="fill-ink-2 text-[11px]" transform={`rotate(-90 12 ${PAD.t + 4})`} textAnchor="end">
            wallets holding <Up />
          </text>
          {showCrowd && (
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={y(crowdedAt)}
              y2={y(crowdedAt)}
              stroke="var(--storm-2)"
              strokeDasharray="4 4"
              opacity={0.6}
            />
          )}
          {order.map((p) => {
            const cx = x(p.change24h!),
              cy = y(p.holders),
              rr = r(p.valueUsd);
            const col = p.change24h! > 0.001 ? 'var(--in-2)' : p.change24h! < -0.001 ? 'var(--out-2)' : 'var(--axis)';
            const on = hover === p;
            return (
              <g
                key={p.chain + p.tokenAddress}
                onPointerEnter={() => setHover(p)}
                onPointerLeave={() => setHover(null)}
                onClick={() => onPick?.(p)}
                className="cursor-pointer"
              >
                <circle cx={cx} cy={cy} r={rr} fill={col} fillOpacity={on ? 0.95 : 0.6} stroke="var(--surface-1)" strokeWidth={1.5} />
                {p.backers > 0 && <circle cx={cx} cy={cy} r={rr + 3} fill="none" stroke="var(--brand)" strokeWidth={1.5} />}
                {p.crowdedExit && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={rr + (p.backers > 0 ? 6 : 3)}
                    fill="none"
                    stroke="var(--storm-2)"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                )}
                {labels.has(p.chain + p.tokenAddress) &&
                  (() => {
                    const l = labels.get(p.chain + p.tokenAddress)!;
                    return (
                      <text x={l.x} y={l.y} textAnchor={l.anchor} className="pointer-events-none fill-ink text-[11px] font-medium">
                        {p.symbol}
                      </text>
                    );
                  })()}
              </g>
            );
          })}
          {showCrowd && (
            <text
              x={W - PAD.r - 4}
              y={y(crowdedAt) - 5}
              textAnchor="end"
              className="pointer-events-none fill-ink-2 text-[10.5px]"
              paintOrder="stroke"
              stroke="var(--surface-1)"
              strokeWidth={3}
            >
              {crowdLabel}
            </text>
          )}
        </svg>
      </div>
      {hover && (
        <div className="material-strong pointer-events-none absolute right-3 top-3 max-w-[250px] rounded-xl p-2.5 text-[12px]">
          <div className="font-medium text-ink">
            {hover.symbol} <span className="font-normal text-ink-muted">· {chainName(hover.chain)}</span>
          </div>
          <div className="num text-ink-2">
            {hover.change24h! >= 0 ? '+' : '−'}
            {pct(Math.abs(hover.change24h!), 1)} balance in 24h · {hover.holders} wallets
          </div>
          <div className="num text-ink-2">
            {usd(hover.valueUsd)} held{hover.share != null ? ` · ${pct(hover.share, 1)} of the cohort's holdings` : ''}
          </div>
          <div className="text-ink-muted">
            {hover.backers
              ? `${hover.backers} top-PnL wallet${hover.backers === 1 ? '' : 's'} hold it (best #${hover.bestRank})`
              : 'No top-100 PnL wallet holds it in its top five'}
            {hover.crowdedExit ? ' · crowded exit' : ''}
          </div>
          {hover.conviction != null && (
            <div className="num mt-0.5 text-ink">
              Conviction {hover.conviction > 0 ? '+' : ''}
              {hover.conviction}
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--in-2)' }} />
          adding
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--out-2)' }} />
          trimming
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-[1.5px]" style={{ borderColor: 'var(--brand)' }} />
          held by top-PnL wallets
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border-[1.5px] border-dashed" style={{ borderColor: 'var(--storm-2)' }} />
          crowded exit
        </span>
        <span>size = value held · select a token for its 30-day history</span>
      </div>
    </div>
  );
}
