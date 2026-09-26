'use client';
import { useEffect, useMemo, useRef } from 'react';
import { liquidationBands, totalUsd, type Band } from '@/lib/perps/liquidation';
import type { Position } from '@/lib/perps/positions';
import { pct, price, usd } from '@/lib/viz/format';

/** Smart Money Liquidation Cascade Radar: observed exposure by liquidation
 *  price band around the mark. Longs (mint) liquidate below the mark, shorts
 *  (flare) above; the signal-blue inset is the Smart Money share. Every band
 *  is a button that selects it for the rest of the terminal. */
export function LiquidationRadar({
  positions, mark, bandPct, window, selected, highlightLiq, smAvailable, onSelect,
}: {
  positions: Position[];
  mark: number;
  bandPct: number;
  window: number;
  selected: { lo: number; hi: number } | null;
  highlightLiq: number | null;
  smAvailable: boolean;
  onSelect: (b: Band | null) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const markRow = useRef<HTMLDivElement>(null);
  const { bands, unplaced } = useMemo(() => liquidationBands(positions, mark, bandPct, window), [positions, mark, bandPct, window]);
  const max = Math.max(1, ...bands.map(totalUsd));
  const total = bands.reduce((a, b) => a + totalUsd(b), 0);
  const dense = useMemo(() => new Set([...bands].sort((a, b) => totalUsd(b) - totalUsd(a)).slice(0, 3).filter((b) => totalUsd(b) / total >= 0.08).map((b) => b.lo)), [bands, total]);
  const above = bands.filter((b) => b.lo >= mark);
  const below = bands.filter((b) => b.lo < mark);
  const isSel = (b: Band) => !!selected && Math.abs(selected.lo - b.lo) < 1e-9 * mark + 1e-9 && Math.abs(selected.hi - b.hi) < 1e-9 * mark + 1e-9;

  const row = (b: Band) => {
    const t = totalUsd(b);
    const w = (t / max) * 100;
    const hot = highlightLiq != null && highlightLiq >= b.lo && highlightLiq < b.hi;
    const sel = isSel(b);
    return (
      <li key={b.lo}>
        <button
          type="button"
          onClick={() => onSelect(sel ? null : b)}
          aria-pressed={sel}
          aria-label={`${price(b.lo)} to ${price(b.hi)}: ${usd(t)} observed, ${usd(b.longUsd)} long, ${usd(b.shortUsd)} short, ${b.traders} traders${b.smTraders ? `, ${b.smTraders} Smart Money` : ''}, ${pct(Math.abs(b.distance), 1)} ${b.distance >= 0 ? 'above' : 'below'} price`}
          className={`radar-row group grid h-[24px] w-full grid-cols-[88px_minmax(0,1fr)_132px] items-center gap-3 rounded-[6px] px-2 text-left transition-colors duration-[var(--dur-fast)] ${sel ? 'bg-[color-mix(in_srgb,var(--ink-1)_12%,transparent)] ring-1 ring-[var(--hair-2)]' : hot ? 'bg-[color-mix(in_srgb,var(--ink-1)_8%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--ink-1)_5%,transparent)]'}`}
        >
          <span className="num truncate text-right text-[11.5px] text-ink-2">{price((b.lo + b.hi) / 2)}</span>
          <span className="relative h-[14px] min-w-0">
            <span className="absolute inset-y-0 left-0 flex overflow-hidden rounded-[3px]" style={{ width: `${Math.max(w, 0.8)}%` }}>
              {b.longUsd > 0 && <span className="h-full" style={{ width: `${(b.longUsd / t) * 100}%`, background: 'var(--mint)', opacity: sel || hot ? 1 : 0.78 }} />}
              {b.shortUsd > 0 && <span className="h-full" style={{ width: `${(b.shortUsd / t) * 100}%`, background: 'var(--flare)', opacity: sel || hot ? 1 : 0.78 }} />}
            </span>
            {smAvailable && b.smUsd > 0 && (
              <span className="absolute bottom-0 left-0 h-[4px] rounded-[2px]" style={{ width: `${Math.max((b.smUsd / max) * 100, 0.8)}%`, background: 'var(--signal)' }} title={`Smart Money: ${usd(b.smUsd)} from ${b.smTraders} trader${b.smTraders === 1 ? '' : 's'}`} />
            )}
            {dense.has(b.lo) && <span className="absolute -top-px right-0 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">dense</span>}
          </span>
          <span className="num flex items-baseline justify-end gap-2 text-[11.5px]">
            <span className="font-semibold text-ink">{usd(t)}</span>
            <span className="w-[48px] text-right text-ink-muted">{b.distance >= 0 ? '+' : '−'}{pct(Math.abs(b.distance), 1)}</span>
          </span>
        </button>
      </li>
    );
  };

  // Keep the mark in view: centre it when the grid changes (not on selection).
  useEffect(() => {
    const box = scroller.current, row = markRow.current;
    if (box && row) box.scrollTop = row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2;
  }, [bandPct, window, bands.length]);

  if (!bands.length) return <p className="py-8 text-center text-[13px] text-ink-muted">No observed liquidation prices within {pct(window, 0)} of the mark for these filters.</p>;
  return (
    <div>
      <div ref={scroller} tabIndex={0} role="region" aria-label="Liquidation bands" className="relative max-h-[560px] overflow-y-auto pr-1">
      <ol className="space-y-px" aria-label="Short liquidation exposure above the mark">{above.map(row)}</ol>
      <div ref={markRow} className="sticky bottom-0 top-0 z-[1] my-1 grid bg-[var(--surface-1)] py-0.5 grid-cols-[88px_minmax(0,1fr)_132px] items-center gap-3 px-2" aria-label={`Mark price ${price(mark)}`}>
        <span className="num text-right text-[12px] font-bold text-ink">{price(mark)}</span>
        <span className="h-px bg-ink/60" />
        <span className="text-right text-[11px] font-bold uppercase tracking-[0.06em] text-ink">Mark</span>
      </div>
      <ol className="space-y-px" aria-label="Long liquidation exposure below the mark">{below.map(row)}</ol>
      </div>
      <p className="mt-3 text-[11.5px] text-ink-muted">
        {usd(total)} of observed exposure in {bands.length} bands of {pct(bandPct, 2).replace('.00', '')}. {unplaced ? `${unplaced} positions have no liquidation price or sit beyond ±${pct(window, 0)}.` : ''}
      </p>
    </div>
  );
}
