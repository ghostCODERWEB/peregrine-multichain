'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { layoutHexMap, hexPoints } from '@/lib/viz/hexmap-layout';
import { pressureClass, fillVar, onFillVar } from '@/lib/viz/scales';
import { chainName, num, signed, usd } from '@/lib/viz/format';
import type { ChainTile, FrontWithProvenance } from '@/server/weather/bulletin';
import { chainLogoSrc, SvgChainLogo, ChainLogo } from '@/components/Logo';

const TILE_LABEL: Record<string, string> = {
  bnb: 'BNB', hyperevm: 'HyperEVM', iotaevm: 'IOTA', hyperliquid: 'HL perps', robinhood: 'Robinhood',
  injective: 'Injective', avalanche: 'Avalanche',
};
const tileLabel = (chain: string) => TILE_LABEL[chain] ?? chainName(chain);

const TIER_BADGE: Record<string, string> = { A: 'A', B: 'B', C: 'C', perp: 'P' };

/** Pressure rising at least this many CPI points over 6h gets isobar rings. */
const RISING = 5;

interface Hover { chain: string; x: number; y: number }

export function HexMap({
  chains,
  fronts,
  selectedFront,
  onSelectFront,
}: {
  chains: ChainTile[];
  fronts: FrontWithProvenance[];
  selectedFront: string | null;
  onSelectFront: (key: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  // Narrow containers re-flow the clusters into more rows instead of
  // shrinking a desktop-width map until the tile labels are unreadable.
  // Wide containers pack the clusters to their own width (in 50px steps), so
  // tiles stay near full size inside a bento card instead of shrinking a
  // 1100px layout.
  const [span, setSpan] = useState(1100);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setSpan(w < 640 ? 0 : Math.max(700, Math.min(1100, Math.round((w * 1.1) / 50) * 50)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layout = useMemo(() => (span === 0 ? layoutHexMap(34, 420, 28) : layoutHexMap(34, span, 36)), [span]);
  const byChain = useMemo(() => new Map(chains.map((c) => [c.chain, c])), [chains]);
  const pos = useMemo(() => new Map(layout.tiles.map((t) => [t.chain, t])), [layout]);
  const [hover, setHover] = useState<Hover | null>(null);

  const maxFront = Math.max(1, ...fronts.map((f) => f.netUsd));
  const r = layout.radius;
  const pad = 8;

  const showTip = (chain: string, clientX: number, clientY: number) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ chain, x: clientX - box.left, y: clientY - box.top });
  };
  const showTipAtTile = (chain: string, el: Element) => {
    const box = wrap.current?.getBoundingClientRect();
    const t = el.getBoundingClientRect();
    if (!box) return;
    setHover({ chain, x: t.left - box.left + t.width / 2, y: t.top - box.top });
  };

  return (
    <div ref={wrap} className="relative" onPointerLeave={() => setHover(null)}>
      <svg
        viewBox={`${-pad} ${-pad} ${layout.width + pad * 2} ${layout.height + pad * 2}`}
        className="h-auto w-full"
        role="img"
        aria-label="Hex map of every chain the Nansen API lists, colored by Flow Index"
      >
        <defs>
          <linearGradient id="hex-highlight" x1="0" y1="0" x2="0" y2="1"><stop stopColor="white" stopOpacity=".08"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient>
          <marker id="front-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-1)" />
          </marker>
        </defs>

        {layout.groups.map((g) => (
          <text key={g.id} x={g.x} y={g.y + 12} className="fill-ink-muted text-[12px] font-semibold">
            {g.label}
          </text>
        ))}

        {/* Layer 1: tile fills. Visual only, the click targets are layer 4. */}
        <g aria-hidden className="pointer-events-none">
          {layout.tiles.map((t) => {
            const w = byChain.get(t.chain);
            const cls = w?.cpi != null ? pressureClass(w.cpi) : null;
            const rising = cls && (w!.trend6h ?? 0) >= RISING;
            const active = hover?.chain === t.chain;
            return (
              <g key={t.chain}>
                {rising && (
                  <g className="isobar">
                    <polygon points={hexPoints(t.cx, t.cy, r + 5)} fill="none" stroke="var(--in-3)" strokeWidth="1" />
                    <polygon points={hexPoints(t.cx, t.cy, r + 10)} fill="none" stroke="var(--in-3)" strokeWidth="1" opacity="0.5" />
                  </g>
                )}
                <polygon
                  points={hexPoints(t.cx, t.cy, r - 1)}
                  fill={cls ? fillVar(cls) : 'transparent'}
                  stroke={active ? 'var(--ink-1)' : cls ? 'var(--surface-1)' : 'var(--axis)'}
                  strokeWidth={active ? 2 : cls ? 2 : 1.25}
                />
                {cls && <polygon points={hexPoints(t.cx,t.cy,r-2)} fill="url(#hex-highlight)"/>}
              </g>
            );
          })}
        </g>

        {/* Layer 2: rotation fronts. */}
        {fronts.map((f) => {
          const a = pos.get(f.from);
          const b = pos.get(f.to);
          if (!a || !b) return null;
          const key = `${f.inferred ? 'inferred:' : ''}${f.from}>${f.to}`;
          const dx = b.cx - a.cx, dy = b.cy - a.cy;
          const dist = Math.hypot(dx, dy);
          // Start/end at the tile edge, not its centre, so arcs don't bury the numbers.
          const ux = dx / dist, uy = dy / dist;
          const x1 = a.cx + ux * r * 0.7, y1 = a.cy + uy * r * 0.7;
          const x2 = b.cx - ux * r * 0.95, y2 = b.cy - uy * r * 0.95;
          const bow = Math.min(90, dist * 0.28) * (f.inferred ? -1 : 1);
          const mx = (x1 + x2) / 2 - uy * bow, my = (y1 + y2) / 2 + ux * bow;
          const d = `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
          const width = 1.5 + 6 * Math.sqrt(f.netUsd / maxFront);
          const opacity = 0.35 + 0.6 * f.confidence;
          const selected = selectedFront === key;
          return (
            <g key={key} className="cursor-pointer" onClick={() => onSelectFront(key)}>
              <title>{`${f.inferred ? 'Inferred candidate: ' : ''}${chainName(f.from)} to ${chainName(f.to)}: ${usd(f.netUsd)} net, ${f.walletCount} ${f.inferred ? 'groups (not ownership probability)' : 'wallets'}`}</title>
              {/* Surface halo keeps the arc legible where it crosses tiles. */}
              <path d={d} fill="none" stroke="var(--surface-1)" strokeWidth={width + 3} strokeLinecap="round" opacity={0.7} className="pointer-events-none" />
              <path
                d={d}
                fill="none"
                stroke="var(--ink-1)"
                strokeWidth={width}
                strokeLinecap="round"
                opacity={selected ? 1 : opacity}
                markerEnd="url(#front-head)"
                strokeDasharray={f.inferred ? '6 5' : undefined}
                className={f.inferred ? 'pointer-events-none' : 'front-flow pointer-events-none'}
              />
              {/* Fat invisible hit area: arcs are thin, readers aim loosely.
                  Tiles sit above this layer, so a click on a tile always
                  reaches the tile, and a click on open arc reaches the front. */}
              <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(18, width + 12)} />
            </g>
          );
        })}

        {/* Layer 3: tile text, above the arcs so numbers are never buried.
            A stroke halo in the tile's own fill keeps text crisp where an
            arc passes underneath. */}
        <g aria-hidden className="pointer-events-none">
          {layout.tiles.map((t) => {
            const w = byChain.get(t.chain);
            const cls = w?.cpi != null ? pressureClass(w.cpi) : null;
            const ink = cls ? onFillVar(cls) : 'var(--ink-muted)';
            const halo = cls ? fillVar(cls) : 'var(--surface-1)';
            const textProps = { stroke: halo, strokeWidth: 3, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const };
            const logo = chainLogoSrc(t.chain);
            return (
              <g key={t.chain}>
                <SvgChainLogo chain={t.chain} x={t.cx - 7} y={t.cy - 26} size={14} opacity={w?.cpi != null ? 1 : 0.55} />
                <text x={t.cx} y={t.cy + (logo ? 1 : -4)} textAnchor="middle" className="text-[9.5px] font-medium" fill={ink} {...textProps}>
                  {tileLabel(t.chain)}
                </text>
                <text x={t.cx} y={t.cy + (logo ? 15 : 11)} textAnchor="middle" className="num text-[12px] font-semibold" fill={ink} {...textProps}>
                  {w?.cpi != null ? num(w.cpi, 0) : 'n/a'}
                </text>
                <text x={t.cx + r * 0.6} y={t.cy - r * 0.4} textAnchor="middle" className="text-[8px] font-semibold" fill={ink} opacity={0.8}>
                  {TIER_BADGE[w?.tier ?? 'C']}
                </text>
              </g>
            );
          })}
        </g>

        {/* Layer 4: transparent tile click/focus targets, topmost. */}
        {layout.tiles.map((t) => {
          const w = byChain.get(t.chain);
          const label = `${chainName(t.chain)}: ${w?.cpi != null ? `Flow ${num(w.cpi)}` : 'no flow reading'}. Open chain page.`;
          return (
            <Link prefetch={false}
              key={t.chain}
              href={`/chain/${t.chain}`}
              aria-label={label}
              className="group outline-none"
              onPointerMove={(e) => showTip(t.chain, e.clientX, e.clientY)}
              onFocus={(e) => showTipAtTile(t.chain, e.currentTarget)}
              onBlur={() => setHover(null)}
            >
              <polygon points={hexPoints(t.cx, t.cy, r)} fill="transparent" className="cursor-pointer" />
              <polygon
                points={hexPoints(t.cx, t.cy, r + 2)}
                fill="none"
                stroke="var(--ring)"
                strokeWidth="2.5"
                className="opacity-0 group-focus-visible:opacity-100"
              />
            </Link>
          );
        })}
      </svg>

      {hover && (
        <TileTooltip
          w={byChain.get(hover.chain)}
          chain={hover.chain}
          x={hover.x}
          y={hover.y}
          containerWidth={wrap.current?.clientWidth ?? 0}
        />
      )}

      <style>{`
        .front-flow { stroke-dasharray: 10 8; animation: front-flow 1.6s linear infinite; }
        @keyframes front-flow { to { stroke-dashoffset: -18; } }
        .isobar { animation: isobar 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes isobar { 0%,100% { opacity: .35 } 50% { opacity: 1 } }
      `}</style>
    </div>
  );
}

const TIP_W = 240;

function TileTooltip({ w, chain, x, y, containerWidth }: {
  w: ChainTile | undefined; chain: string; x: number; y: number; containerWidth: number;
}) {
  // Centred on the pointer, but clamped so it never leaves the map; flips
  // below the pointer near the top edge.
  const left = Math.min(Math.max(x - TIP_W / 2, 4), Math.max(4, containerWidth - TIP_W - 4));
  const below = y < 170;
  return (
    <div
      className={`pointer-events-none absolute z-20 rounded-lg border border-border bg-popover p-3 text-[12px] shadow-lg ${below ? 'translate-y-4' : '-translate-y-[calc(100%+12px)]'}`}
      style={{ left, top: y, width: TIP_W }}
      role="tooltip"
    >
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 font-medium text-ink"><ChainLogo chain={chain} size={16} />{chainName(chain)}</span>
        <span className="text-ink-muted">Tier {w?.tier ?? 'n/a'}</span>
      </div>
      {w?.cpi != null ? (
        <>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-xl font-semibold text-ink">{num(w.cpi)}</span>
            <span className="text-ink-2">Flow Index{w.trend6h != null ? ` · ${signed(w.trend6h)} over 6h` : ''}</span>
          </div>
          <table className="mt-2 w-full">
            <tbody>
              {w.windows.map((x) => (
                <tr key={x.window} className="text-ink-2">
                  <td className="py-0.5">{x.window}</td>
                  <td className="num text-right text-ink">{usd(x.netFlowUsd, { signed: true })}</td>
                  <td className="num text-right">{num(x.cpi, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 text-ink-muted">
            {w.source === 'smart-money' ? 'Smart-money net flow vs volume' : 'All-trader net flow (no smart-money labels on this chain)'}
          </div>
        </>
      ) : (
        <div className="mt-1 text-ink-2">{w?.unavailable ?? 'No reading.'}</div>
      )}
    </div>
  );
}
