// Liquidation, entry and leverage analytics over observed positions. Pure and
// unit-tested; every number the terminal shows about exposure comes from here.
//
// Methodology (shown in the UI's ⓘ): a position's liquidation price is Nansen's
// liquidation_price. A band is a price range of `bandPct` of the current mark;
// a position falls in the band containing its liquidation price, and its
// position_value_usd is that band's exposure. This measures where observed
// positions would be force-closed if price reached them. It does not predict
// that price will get there, and it covers only the positions Nansen returned.
import { inCohort, type Cohort, type Position, type Side } from './positions';

export interface Band {
  /** Inclusive lower and exclusive upper price of the band. */
  lo: number;
  hi: number;
  /** Signed distance of the band's midpoint from the mark, as a fraction. */
  distance: number;
  longUsd: number;
  shortUsd: number;
  positions: number;
  traders: number;
  smUsd: number;
  smTraders: number;
  whaleUsd: number;
  avgLeverage: number | null;
  medianLeverage: number | null;
  largest: Position | null;
}

export const totalUsd = (b: Band) => b.longUsd + b.shortUsd;

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Stable band index for a price: bands are anchored at the mark so the band
 *  holding the mark is centred on it, and the grid never shifts with filters. */
export function bandIndex(price: number, mark: number, bandPct: number): number {
  const w = mark * bandPct;
  return Math.floor((price - mark) / w + 0.5);
}

export function bandRange(i: number, mark: number, bandPct: number): { lo: number; hi: number } {
  const w = mark * bandPct;
  return { lo: mark + (i - 0.5) * w, hi: mark + (i + 0.5) * w };
}

/** Liquidation bands within ±`window` of the mark, nearest first on each side
 *  when sorted by price. Positions without a liquidation price, or outside the
 *  window, are not placed (counted in `unplaced`). */
export function liquidationBands(positions: Position[], mark: number, bandPct = 0.005, window = 0.25) {
  const byIndex = new Map<number, Position[]>();
  let unplaced = 0;
  for (const p of positions) {
    if (p.liq == null || Math.abs(p.liq - mark) / mark > window) { unplaced++; continue; }
    const i = bandIndex(p.liq, mark, bandPct);
    const list = byIndex.get(i) ?? [];
    list.push(p);
    byIndex.set(i, list);
  }
  const bands: Band[] = [...byIndex.entries()].map(([i, list]) => {
    const { lo, hi } = bandRange(i, mark, bandPct);
    const levs = list.map((p) => p.leverage).filter((x): x is number => x != null);
    const sm = list.filter((p) => p.cohorts.includes('smart_money'));
    return {
      lo, hi, distance: (lo + hi) / 2 / mark - 1,
      longUsd: list.filter((p) => p.side === 'long').reduce((a, p) => a + p.valueUsd, 0),
      shortUsd: list.filter((p) => p.side === 'short').reduce((a, p) => a + p.valueUsd, 0),
      positions: list.length,
      traders: new Set(list.map((p) => p.address.toLowerCase())).size,
      smUsd: sm.reduce((a, p) => a + p.valueUsd, 0),
      smTraders: new Set(sm.map((p) => p.address.toLowerCase())).size,
      whaleUsd: list.filter((p) => p.cohorts.includes('whale')).reduce((a, p) => a + p.valueUsd, 0),
      avgLeverage: levs.length ? levs.reduce((a, x) => a + x, 0) / levs.length : null,
      medianLeverage: median(levs),
      largest: list.reduce<Position | null>((a, p) => (!a || p.valueUsd > a.valueUsd ? p : a), null),
    };
  }).sort((a, b) => b.lo - a.lo);
  return { bands, unplaced };
}

/** Positions whose liquidation price lies in [lo, hi). */
export const positionsInBand = (positions: Position[], lo: number, hi: number) =>
  positions.filter((p) => p.liq != null && p.liq >= lo && p.liq < hi);

/** Fraction of the way from mark to liquidation, signed so that 0.05 means a
 *  5% adverse move liquidates the position. Null without both prices. */
export function liquidationDistance(p: Position, mark: number): number | null {
  if (p.liq == null || !mark) return null;
  return p.side === 'long' ? (mark - p.liq) / mark : (p.liq - mark) / mark;
}

/** The positions a smaller adverse move would liquidate, nearest first. */
export function nearestToLiquidation(positions: Position[], mark: number, limit = 50) {
  return positions
    .map((p) => ({ p, d: liquidationDistance(p, mark) }))
    .filter((x): x is { p: Position; d: number } => x.d != null && x.d >= 0)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit);
}

export const LEVERAGE_BUCKETS = [
  { key: '1-2', label: '1x to 2x', lo: 0, hi: 2 },
  { key: '2-5', label: '2x to 5x', lo: 2, hi: 5 },
  { key: '5-10', label: '5x to 10x', lo: 5, hi: 10 },
  { key: '10-20', label: '10x to 20x', lo: 10, hi: 20 },
  { key: '20+', label: '20x and above', lo: 20, hi: Infinity },
] as const;
export type LeverageKey = (typeof LEVERAGE_BUCKETS)[number]['key'];

export function leverageBucket(lev: number | null): LeverageKey | null {
  if (lev == null) return null;
  // Lower bound inclusive: exactly 10x belongs to "10x to 20x".
  return LEVERAGE_BUCKETS.find((b) => lev >= b.lo && lev < b.hi)?.key ?? '20+';
}

/** Exposure and count per leverage bucket, split by side. */
export function leverageDistribution(positions: Position[]) {
  return LEVERAGE_BUCKETS.map((b) => {
    const list = positions.filter((p) => leverageBucket(p.leverage) === b.key);
    const side = (s: Side) => list.filter((p) => p.side === s);
    return {
      ...b,
      count: list.length,
      longUsd: side('long').reduce((a, p) => a + p.valueUsd, 0),
      shortUsd: side('short').reduce((a, p) => a + p.valueUsd, 0),
    };
  });
}

/** Where observed positions were opened: exposure per entry-price band. */
export function entryDistribution(positions: Position[], mark: number, bandPct = 0.01, window = 0.3) {
  const map = new Map<number, { longUsd: number; shortUsd: number; count: number }>();
  for (const p of positions) {
    if (p.entry == null || Math.abs(p.entry - mark) / mark > window) continue;
    const i = bandIndex(p.entry, mark, bandPct);
    const cur = map.get(i) ?? { longUsd: 0, shortUsd: 0, count: 0 };
    if (p.side === 'long') cur.longUsd += p.valueUsd; else cur.shortUsd += p.valueUsd;
    cur.count++;
    map.set(i, cur);
  }
  return [...map.entries()].map(([i, v]) => ({ ...bandRange(i, mark, bandPct), ...v })).sort((a, b) => b.lo - a.lo);
}

export interface CohortRow {
  cohort: Cohort | 'all';
  positions: number;
  traders: number;
  longUsd: number;
  shortUsd: number;
  /** long share of exposure, 0 to 1. */
  longShare: number | null;
  avgLeverage: number | null;
  medianLeverage: number | null;
  upnlUsd: number;
  fundingUsd: number;
  avgSizeUsd: number | null;
  /** Exposure within 5% of liquidation. */
  nearLiqUsd: number;
}

/** The Smart Money vs crowd matrix: the same measures for each cohort. */
export function cohortMatrix(positions: Position[], mark: number, cohorts: Array<Cohort | 'all'> = ['all', 'smart_money', 'whale', 'public_figure']): CohortRow[] {
  return cohorts.map((cohort) => {
    const list = positions.filter((p) => inCohort(p, cohort));
    const longUsd = list.filter((p) => p.side === 'long').reduce((a, p) => a + p.valueUsd, 0);
    const shortUsd = list.filter((p) => p.side === 'short').reduce((a, p) => a + p.valueUsd, 0);
    const levs = list.map((p) => p.leverage).filter((x): x is number => x != null);
    return {
      cohort,
      positions: list.length,
      traders: new Set(list.map((p) => p.address.toLowerCase())).size,
      longUsd, shortUsd,
      longShare: longUsd + shortUsd ? longUsd / (longUsd + shortUsd) : null,
      avgLeverage: levs.length ? levs.reduce((a, x) => a + x, 0) / levs.length : null,
      medianLeverage: median(levs),
      upnlUsd: list.reduce((a, p) => a + (p.upnlUsd ?? 0), 0),
      fundingUsd: list.reduce((a, p) => a + (p.fundingUsd ?? 0), 0),
      avgSizeUsd: list.length ? (longUsd + shortUsd) / list.length : null,
      nearLiqUsd: list.filter((p) => { const d = liquidationDistance(p, mark); return d != null && d >= 0 && d <= 0.05; }).reduce((a, p) => a + p.valueUsd, 0),
    };
  });
}

/** Crowding, shown as its components, never as one score. */
export function crowding(positions: Position[]) {
  const total = positions.reduce((a, p) => a + p.valueUsd, 0);
  const long = positions.filter((p) => p.side === 'long').reduce((a, p) => a + p.valueUsd, 0);
  const sorted = [...positions].sort((a, b) => b.valueUsd - a.valueUsd);
  const top10 = sorted.slice(0, 10).reduce((a, p) => a + p.valueUsd, 0);
  return {
    totalUsd: total,
    longShare: total ? long / total : null,
    top10Share: total ? top10 / total : null,
    traders: new Set(positions.map((p) => p.address.toLowerCase())).size,
  };
}

export interface Filters {
  cohort: Cohort | 'all';
  side: Side | 'both';
  minUsd: number;
  minLeverage: number;
}

export const applyFilters = (positions: Position[], f: Filters) =>
  positions.filter((p) => inCohort(p, f.cohort) && (f.side === 'both' || p.side === f.side) && p.valueUsd >= f.minUsd && (f.minLeverage <= 1 || (p.leverage ?? 0) >= f.minLeverage));
