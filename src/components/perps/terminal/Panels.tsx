'use client';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { AddressLink } from '@/components/entity/AddressLink';
import { CohortBadges } from '@/components/entity/CohortBadges';
import { cohortMatrix, entryDistribution, leverageDistribution, liquidationDistance, nearestToLiquidation, type Band, type CohortRow } from '@/lib/perps/liquidation';
import { COHORT_NAME, type Cohort, type Position } from '@/lib/perps/positions';
import { num, pct, price, usd } from '@/lib/viz/format';
import type { PerpTrade } from '@/server/perps/terminal';

// ------------------------------------------------------------ sortable table

type Col<T> = { key: string; label: string; right?: boolean; sort?: (r: T) => number | string | null; cell: (r: T) => React.ReactNode; title?: string };

export function DataTable<T>({ rows, cols, rowKey, initialSort, onRowHover, onRowClick, empty, pageSize = 50, label }: {
  rows: T[]; cols: Col<T>[]; rowKey: (r: T) => string; initialSort?: { key: string; dir: 1 | -1 };
  onRowHover?: (r: T | null) => void; onRowClick?: (r: T) => void; empty: React.ReactNode; pageSize?: number; label: string;
}) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [limit, setLimit] = useState(pageSize);
  const sorted = useMemo(() => {
    const col = sort && cols.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const get = col.sort;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort!.dir;
    });
  }, [rows, cols, sort]);
  if (!rows.length) return <div className="py-8 text-center text-[13px] text-ink-muted">{empty}</div>;
  return (
    <div>
      <div tabIndex={0} role="region" aria-label={label} className="max-h-[560px] overflow-auto rounded-[10px] border border-[var(--hair)]">
        <table className="w-full min-w-[820px] border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-[1] bg-[var(--surface-1)] text-[11.5px] text-ink-muted shadow-[0_1px_0_var(--hair)]">
            <tr>
              {cols.map((c) => (
                <th key={c.key} scope="col" title={c.title} className={`whitespace-nowrap px-3 py-2 font-semibold ${c.right ? 'text-right' : 'text-left'}`}>
                  {c.sort ? (
                    <button type="button" className={`inline-flex items-center gap-1 hover:text-ink ${sort?.key === c.key ? 'text-ink' : ''}`}
                      onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: -1 }))}>
                      {c.label}
                      {sort?.key === c.key && (sort.dir === -1 ? <ArrowDown className="h-3 w-3" aria-hidden /> : <ArrowUp className="h-3 w-3" aria-hidden />)}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((r) => (
              <tr key={rowKey(r)} onMouseEnter={() => onRowHover?.(r)} onMouseLeave={() => onRowHover?.(null)} onClick={() => onRowClick?.(r)}
                className={`border-t border-[var(--hair)] transition-colors duration-[var(--dur-fast)] hover:bg-[color-mix(in_srgb,var(--ink-1)_5%,transparent)] ${onRowClick ? 'cursor-pointer' : ''}`}>
                {cols.map((c) => <td key={c.key} className={`whitespace-nowrap px-3 py-1.5 ${c.right ? 'num text-right' : ''}`}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + pageSize * 2)} className="mt-2 text-[12.5px] font-semibold text-brand">
          Show {Math.min(pageSize * 2, sorted.length - limit)} more of {sorted.length - limit}
        </button>
      )}
    </div>
  );
}

const sideCell = (s: 'long' | 'short') => (
  <span className="font-semibold" style={{ color: s === 'long' ? 'var(--mint)' : 'var(--flare)' }}>{s === 'long' ? 'Long' : 'Short'}</span>
);
const pnlCell = (v: number | null) => <span style={{ color: v == null ? undefined : v >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(v, { signed: true })}</span>;

export function positionCols(mark: number): Col<Position>[] {
  return [
    { key: 'trader', label: 'Trader', cell: (p) => <span className="flex min-w-0 max-w-[280px] items-center gap-1.5"><AddressLink address={p.address} label={p.label} /><CohortBadges cohorts={p.cohorts} /></span> },
    { key: 'side', label: 'Side', sort: (p) => p.side, cell: (p) => sideCell(p.side) },
    { key: 'value', label: 'Value', right: true, sort: (p) => p.valueUsd, cell: (p) => <span className="font-semibold text-ink">{usd(p.valueUsd)}</span> },
    { key: 'lev', label: 'Leverage', right: true, sort: (p) => p.leverage, cell: (p) => (p.leverage ? `${num(p.leverage, p.leverage < 10 ? 1 : 0)}x${p.leverageType ? ` ${p.leverageType[0].toUpperCase()}` : ''}` : 'n/a'), title: 'C cross, I isolated margin' },
    { key: 'entry', label: 'Entry', right: true, sort: (p) => p.entry, cell: (p) => price(p.entry) },
    { key: 'liq', label: 'Liquidation', right: true, sort: (p) => p.liq, cell: (p) => price(p.liq) },
    { key: 'dist', label: 'To liq.', right: true, sort: (p) => liquidationDistance(p, mark), title: 'Adverse move from the mark that would liquidate the position', cell: (p) => { const d = liquidationDistance(p, mark); return d == null ? 'n/a' : <span className={d < 0.05 ? 'font-semibold text-[var(--flare)]' : ''}>{pct(d, 1)}</span>; } },
    { key: 'upnl', label: 'Unrealized', right: true, sort: (p) => p.upnlUsd, cell: (p) => pnlCell(p.upnlUsd) },
    { key: 'funding', label: 'Funding', right: true, sort: (p) => p.fundingUsd, title: 'Funding paid (negative) or received, USD', cell: (p) => pnlCell(p.fundingUsd) },
  ];
}

// ---------------------------------------------------------- band inspector

export function BandInspector({ band, positions, mark, onClear, onHover }: { band: Band; positions: Position[]; mark: number; onClear: () => void; onHover: (liq: number | null) => void }) {
  const total = band.longUsd + band.shortUsd;
  const traders = [...positions].sort((a, b) => b.valueUsd - a.valueUsd);
  return (
    <section aria-label="Selected liquidation band" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-semibold text-ink-muted">Selected band · {pct(Math.abs(band.distance), 1)} {band.distance >= 0 ? 'above' : 'below'} the mark</p>
          <h3 className="num mt-0.5 text-[17px] font-bold tracking-[-0.02em] text-ink">{price(band.lo)} to {price(band.hi)}</h3>
        </div>
        <button type="button" onClick={onClear} className="rounded-[8px] px-2 py-1 text-[12px] font-semibold text-ink-muted hover:bg-ink/10 hover:text-ink">Clear</button>
      </div>
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-[var(--hair)] bg-[var(--hair)] text-[12px]">
        {[
          ['Observed', usd(total)],
          ['Long', usd(band.longUsd)],
          ['Short', usd(band.shortUsd)],
          ['Positions', String(band.positions)],
          ['Traders', String(band.traders)],
          ['Smart Money', band.smTraders ? `${band.smTraders} · ${usd(band.smUsd)}` : '0'],
          ['Median lev.', band.medianLeverage ? `${num(band.medianLeverage, 1)}x` : 'n/a'],
          ['Avg lev.', band.avgLeverage ? `${num(band.avgLeverage, 1)}x` : 'n/a'],
          ['Whales', usd(band.whaleUsd)],
        ].map(([k, v]) => (
          <div key={k} className="bg-[var(--surface-1)] px-3 py-2"><dt className="text-[11px] text-ink-muted">{k}</dt><dd className="num mt-0.5 truncate font-semibold text-ink">{v}</dd></div>
        ))}
      </dl>
      <div>
        <h4 className="mb-1.5 text-[12px] font-semibold text-ink-muted">Who is exposed here</h4>
        <ol className="max-h-[300px] divide-y divide-[var(--hair)] overflow-auto" tabIndex={0} aria-label="Positions in this band">
          {traders.map((p) => (
            <li key={`${p.address}:${p.side}`} onMouseEnter={() => onHover(p.liq)} onMouseLeave={() => onHover(null)} className="flex items-center gap-2 py-1.5 text-[12.5px]">
              <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><AddressLink address={p.address} label={p.label} compact /><CohortBadges cohorts={p.cohorts} /></span>
                <span className="num block text-[11px] text-ink-muted">{p.side === 'long' ? 'Long' : 'Short'} · entry {price(p.entry)} · {p.leverage ? `${num(p.leverage, 0)}x` : 'n/a'} · liq {price(p.liq)}</span></span>
              <span className="num text-right"><span className="block font-semibold text-ink">{usd(p.valueUsd)}</span><span className="block text-[11px]">{pnlCell(p.upnlUsd)}</span></span>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-[11px] text-ink-muted">Mark {price(mark)}. Exposure is where these observed positions would be force-closed; it does not say price will get there.</p>
    </section>
  );
}

// --------------------------------------------------------- cohort matrix

export function CohortMatrix({ positions, mark, available, active, onPick }: { positions: Position[]; mark: number; available: Cohort[]; active: Cohort | 'all'; onPick: (c: Cohort | 'all') => void }) {
  const rows = useMemo(() => cohortMatrix(positions, mark, ['all', ...available]), [positions, mark, available]);
  const measures: Array<[string, (r: CohortRow) => React.ReactNode, string?]> = [
    ['Traders', (r) => r.traders],
    ['Long exposure', (r) => usd(r.longUsd)],
    ['Short exposure', (r) => usd(r.shortUsd)],
    ['Long share', (r) => (r.longShare == null ? 'n/a' : <span style={{ color: r.longShare >= 0.5 ? 'var(--mint)' : 'var(--flare)' }}>{pct(r.longShare, 0)}</span>)],
    ['Net exposure', (r) => usd(r.longUsd - r.shortUsd, { signed: true })],
    ['Median leverage', (r) => (r.medianLeverage ? `${num(r.medianLeverage, 1)}x` : 'n/a')],
    ['Avg position', (r) => usd(r.avgSizeUsd)],
    ['Unrealized PnL', (r) => pnlCell(r.upnlUsd)],
    ['Funding', (r) => pnlCell(r.fundingUsd)],
    ['Within 5% of liq.', (r) => usd(r.nearLiqUsd), 'Exposure an adverse move of 5% or less would liquidate'],
  ];
  const all = rows[0];
  const divergence = rows.slice(1).filter((r) => r.longShare != null && all.longShare != null && Math.abs(r.longShare - all.longShare) >= 0.15);
  return (
    <div className="space-y-3">
      <div tabIndex={0} role="region" aria-label="Smart Money vs crowd" className="overflow-x-auto rounded-[10px] border border-[var(--hair)]">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead className="bg-[var(--surface-1)] text-[11.5px] text-ink-muted">
            <tr><th className="px-3 py-2 text-left font-semibold">Measure</th>
              {rows.map((r) => (
                <th key={r.cohort} className="px-3 py-2 text-right font-semibold">
                  <button type="button" onClick={() => onPick(r.cohort)} aria-pressed={active === r.cohort} className={`rounded-[6px] px-1.5 py-0.5 ${active === r.cohort ? 'bg-ink/15 text-ink' : 'hover:text-ink'}`}>{COHORT_NAME[r.cohort]}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {measures.map(([k, f, tip]) => (
              <tr key={k} className="border-t border-[var(--hair)]"><th scope="row" title={tip} className="px-3 py-1.5 text-left font-medium text-ink-2">{k}</th>{rows.map((r) => <td key={r.cohort} className="num px-3 py-1.5 text-right text-ink">{f(r)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {divergence.length > 0 && (
        <p className="text-[12.5px] text-ink-2">
          {divergence.map((r) => `${COHORT_NAME[r.cohort]} is ${pct(r.longShare, 0)} long against ${pct(all.longShare, 0)} for all observed traders`).join('; ')}. Descriptive only: positioning differs, it does not say who is right.
        </p>
      )}
      {!available.length && <p className="text-[12px] text-ink-muted">Cohort columns (Smart Money, whales, public figures) are shown in the key owner&apos;s view.</p>}
    </div>
  );
}

// ------------------------------------------------ leverage and entries

export function LeverageChart({ positions, onPick }: { positions: Position[]; onPick: (minLev: number) => void }) {
  const rows = useMemo(() => leverageDistribution(positions), [positions]);
  const max = Math.max(1, ...rows.map((r) => r.longUsd + r.shortUsd));
  return (
    <ol className="space-y-2">
      {rows.map((r) => (
        <li key={r.key}>
          <button type="button" onClick={() => onPick(r.lo || 1)} className="grid w-full grid-cols-[110px_minmax(0,1fr)_170px] items-center gap-3 rounded-[8px] px-2 py-1.5 text-left hover:bg-ink/5" title={`Show positions at ${r.label} leverage or higher`}>
            <span className="text-[12.5px] font-semibold text-ink">{r.label}</span>
            <span className="flex h-3 overflow-hidden rounded-[3px] bg-ink/5">
              <span style={{ width: `${(r.longUsd / max) * 100}%`, background: 'var(--mint)' }} />
              <span style={{ width: `${(r.shortUsd / max) * 100}%`, background: 'var(--flare)' }} />
            </span>
            <span className="num text-right text-[12px] text-ink-2">{usd(r.longUsd + r.shortUsd)} · {r.count} positions</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function EntryChart({ positions, mark, selected, onPick }: { positions: Position[]; mark: number; selected: { lo: number; hi: number } | null; onPick: (r: { lo: number; hi: number } | null) => void }) {
  const rows = useMemo(() => entryDistribution(positions, mark), [positions, mark]);
  const max = Math.max(1, ...rows.map((r) => r.longUsd + r.shortUsd));
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-ink-muted">No entry prices within 30% of the mark.</p>;
  return (
    <ol className="space-y-px">
      {rows.map((r) => {
        const sel = !!selected && Math.abs(selected.lo - r.lo) < 1e-9 * mark + 1e-9;
        const t = r.longUsd + r.shortUsd;
        return (
          <li key={r.lo}>
            <button type="button" aria-pressed={sel} onClick={() => onPick(sel ? null : { lo: r.lo, hi: r.hi })}
              className={`grid h-[24px] w-full grid-cols-[88px_minmax(0,1fr)_150px] items-center gap-3 rounded-[6px] px-2 ${sel ? 'bg-ink/12 ring-1 ring-[var(--hair-2)]' : 'hover:bg-ink/5'}`}>
              <span className={`num text-right text-[11.5px] ${r.lo <= mark && r.hi > mark ? 'font-bold text-ink' : 'text-ink-2'}`}>{price((r.lo + r.hi) / 2)}</span>
              <span className="flex h-3 overflow-hidden rounded-[3px]" style={{ width: `${Math.max(1, (t / max) * 100)}%` }}>
                <span style={{ width: `${(r.longUsd / t) * 100}%`, background: 'var(--mint)' }} />
                <span style={{ width: `${(r.shortUsd / t) * 100}%`, background: 'var(--flare)' }} />
              </span>
              <span className="num text-right text-[11.5px] text-ink-2">{usd(t)} · {r.count}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// --------------------------------------------------------------- trades

export function TradesTable({ trades, label }: { trades: PerpTrade[]; label: string }) {
  const cols: Col<PerpTrade>[] = [
    { key: 'at', label: 'Time (UTC)', sort: (t) => t.at, cell: (t) => <span className="num text-ink-2">{t.at.slice(5, 16).replace('T', ' ')}</span> },
    { key: 'trader', label: 'Trader', cell: (t) => <span className="flex max-w-[260px] items-center gap-1.5"><AddressLink address={t.address} label={t.label} />{t.smartMoney && <CohortBadges cohorts={['smart_money']} />}</span> },
    { key: 'action', label: 'Action', sort: (t) => `${t.action}${t.side}`, cell: (t) => <span><span style={{ color: /long|buy/i.test(t.side ?? '') ? 'var(--mint)' : 'var(--flare)' }} className="font-semibold">{t.side ?? 'n/a'}</span> <span className="text-ink-2">{t.action ?? ''}</span></span> },
    { key: 'value', label: 'Value', right: true, sort: (t) => t.valueUsd, cell: (t) => <span className="font-semibold text-ink">{usd(t.valueUsd)}</span> },
    { key: 'price', label: 'Price', right: true, sort: (t) => t.priceUsd, cell: (t) => price(t.priceUsd) },
    { key: 'type', label: 'Type', cell: (t) => <span className="text-ink-2">{t.type?.toLowerCase() ?? 'n/a'}</span> },
  ];
  return <DataTable rows={trades} cols={cols} rowKey={(t) => `${t.tx}:${t.address}:${t.at}:${t.valueUsd}`} initialSort={{ key: 'at', dir: -1 }} label={label} empty="No trades in this window." />;
}

export function ProximityTable({ positions, mark, onHover }: { positions: Position[]; mark: number; onHover: (liq: number | null) => void }) {
  const rows = useMemo(() => nearestToLiquidation(positions, mark, 200).map((x) => x.p), [positions, mark]);
  return <DataTable rows={rows} cols={positionCols(mark)} rowKey={(p) => `${p.address}:${p.side}`} initialSort={{ key: 'dist', dir: 1 }} onRowHover={(p) => onHover(p?.liq ?? null)} label="Positions nearest to liquidation" empty="No positions with a liquidation price match these filters." />;
}
