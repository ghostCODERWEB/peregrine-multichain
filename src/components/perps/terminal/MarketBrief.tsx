'use client';
import { useMemo } from 'react';
import { AddressLink } from '@/components/entity/AddressLink';
import { DIRECTION_TEXT } from '@/lib/perps/changes';
import { cohortMatrix, crowding, liquidationBands, liquidationDistance, totalUsd, type Band } from '@/lib/perps/liquidation';
import type { Cohort } from '@/lib/perps/positions';
import { pct, price, usd } from '@/lib/viz/format';
import type { ChangesData, TerminalData } from '@/server/perps/terminal';
import type { Tab } from './state';

/** Market Intelligence Brief: deterministic statements computed from the data on
 *  screen (Derived, not AI). Every statement opens the records behind it. */
export function MarketBrief({ data, mark, changes, available, onBand, onTab, onCohort }: {
  data: TerminalData; mark: number; changes: ChangesData | { unavailable: string } | null; available: Cohort[];
  onBand: (b: Band) => void; onTab: (t: Tab) => void; onCohort: (c: Cohort | 'all') => void;
}) {
  const b = useMemo(() => {
    const all = crowding(data.positions);
    const m = cohortMatrix(data.positions, mark, ['all', ...available]);
    const sm = m.find((r) => r.cohort === 'smart_money');
    const { bands } = liquidationBands(data.positions, mark, 0.005, 0.15);
    const below = bands.filter((x) => x.hi <= mark).sort((a, c) => totalUsd(c) - totalUsd(a))[0];
    const above = bands.filter((x) => x.lo >= mark).sort((a, c) => totalUsd(c) - totalUsd(a))[0];
    const near = data.positions.filter((p) => { const d = liquidationDistance(p, mark); return d != null && d >= 0 && d <= 0.05; });
    const largest = data.positions[0];
    const smTrade = Array.isArray(data.smTrades) ? [...data.smTrades].sort((a, c) => (c.valueUsd ?? 0) - (a.valueUsd ?? 0))[0] : null;
    return { all, sm, below, above, near, largest, smTrade };
  }, [data, mark, available]);
  const shift = changes && !('unavailable' in changes) ? changes.shift.smart_money ?? changes.shift.all : null;
  const item = 'flex flex-wrap items-baseline gap-x-1.5 py-1.5 text-[13px] text-ink-2';
  const link = 'font-semibold text-ink underline decoration-[var(--hair-2)] decoration-dotted underline-offset-2 hover:decoration-solid';
  return (
    <section aria-labelledby="brief-title" className="material p-4 sm:p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="brief-title" className="text-[13.5px] font-bold text-ink">Market brief</h2>
        <span className="text-[11.5px] text-ink-muted"><span className="rounded bg-ink/10 px-1.5 py-px font-bold text-ink-2">Derived</span> from observed positions at {new Date(data.at).toISOString().slice(11, 16)} UTC · select any statement for its records</span>
      </div>
      <ul className="divide-y divide-[var(--hair)]">
        <li className={item}>
          Observed book <button type="button" className={link} onClick={() => onTab('positions')}>{pct(b.all.longShare, 0)} long</button>
          across {b.all.traders} traders and {usd(b.all.totalUsd)}; the ten largest hold <button type="button" className={link} onClick={() => onTab('positions')}>{pct(b.all.top10Share, 0)}</button>.
        </li>
        {b.sm && b.sm.positions > 0 && (
          <li className={item}>
            <button type="button" className={link} onClick={() => onCohort('smart_money')}>Smart Money</button> is {pct(b.sm.longShare, 0)} long ({usd(b.sm.longUsd)} long, {usd(b.sm.shortUsd)} short, {b.sm.traders} traders)
            {b.sm.longShare != null && b.all.longShare != null && Math.abs(b.sm.longShare - b.all.longShare) >= 0.15 ? <>, <button type="button" className={link} onClick={() => onTab('cohorts')}>positioned differently from the crowd</button>.</> : '.'}
          </li>
        )}
        {shift && (
          <li className={item}>
            Since {changes && !('unavailable' in changes) ? new Date(changes.from).toISOString().slice(11, 16) : ''} UTC: <button type="button" className={link} onClick={() => onTab('changes')}>{DIRECTION_TEXT[shift.direction].toLowerCase()}</button>
            ({shift.counts.opened} opened, {shift.counts.increased} added, {shift.counts.reduced} reduced, {shift.counts.closed} closed, {shift.counts.flipped} flipped).
          </li>
        )}
        {b.below && (
          <li className={item}>
            Largest long liquidation concentration: <button type="button" className={link} onClick={() => onBand(b.below!)}>{usd(totalUsd(b.below))} between {price(b.below.lo)} and {price(b.below.hi)}</button>
            ({pct(Math.abs(b.below.distance), 1)} below the mark, {b.below.traders} traders{b.below.smTraders ? `, ${b.below.smTraders} Smart Money` : ''}).
          </li>
        )}
        {b.above && (
          <li className={item}>
            Largest short liquidation concentration: <button type="button" className={link} onClick={() => onBand(b.above!)}>{usd(totalUsd(b.above))} between {price(b.above.lo)} and {price(b.above.hi)}</button>
            ({pct(b.above.distance, 1)} above, {b.above.traders} traders).
          </li>
        )}
        <li className={item}>
          <button type="button" className={link} onClick={() => onTab('proximity')}>{b.near.length} positions ({usd(b.near.reduce((a, p) => a + p.valueUsd, 0))})</button> sit within 5% of their liquidation price.
        </li>
        {b.largest && (
          <li className={item}>
            Largest position: <AddressLink address={b.largest.address} label={b.largest.label} compact /> {b.largest.side} {usd(b.largest.valueUsd)}, entry {price(b.largest.entry)}, liquidation {price(b.largest.liq)}.
          </li>
        )}
        {b.smTrade && (
          <li className={item}>
            Largest Smart Money trade (24h): <AddressLink address={b.smTrade.address} label={b.smTrade.label} compact /> {b.smTrade.side?.toLowerCase()} {b.smTrade.action?.toLowerCase()} {usd(b.smTrade.valueUsd)} at {price(b.smTrade.priceUsd)} <button type="button" className={link} onClick={() => onTab('trades')}>(trades)</button>.
          </li>
        )}
      </ul>
    </section>
  );
}
