// Observed Hyperliquid positions for one coin, as Nansen's tgm/perp-positions
// returns them, merged across the cohorts Nansen classifies. Pure: no I/O.
//
// Scope, stated everywhere this is shown: these are the positions Nansen
// returns (the largest by value, per cohort, up to the page size), not the
// whole exchange. "Observed" is the honest word for every aggregate here.

export type Cohort = 'smart_money' | 'whale' | 'public_figure';
export const COHORTS: Cohort[] = ['smart_money', 'whale', 'public_figure'];
export const COHORT_NAME: Record<Cohort | 'all', string> = {
  all: 'All observed',
  smart_money: 'Smart Money',
  whale: 'Whales',
  public_figure: 'Public figures',
};

export type Side = 'long' | 'short';

export interface Position {
  address: string;
  /** Nansen's label for the address, when it has one (owner view only). */
  label: string | null;
  side: Side;
  valueUsd: number;
  size: number | null;
  leverage: number | null;
  leverageType: string | null;
  entry: number | null;
  mark: number | null;
  liq: number | null;
  fundingUsd: number | null;
  upnlUsd: number | null;
  /** Cohorts Nansen placed this address in for this coin. Empty = all traders only. */
  cohorts: Cohort[];
}

export interface RawPositionRow {
  address?: string | null;
  address_label?: string | null;
  side?: string | null;
  position_value_usd?: number | null;
  position_size?: number | null;
  leverage?: string | number | null;
  leverage_type?: string | null;
  entry_price?: number | null;
  mark_price?: number | null;
  liquidation_price?: number | null;
  funding_usd?: number | null;
  upnl_usd?: number | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** "20X", "20x", 20 → 20. */
export function parseLeverage(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== 'string') return null;
  const n = Number.parseFloat(v.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeRow(r: RawPositionRow): Position | null {
  const address = typeof r.address === 'string' ? r.address : '';
  const valueUsd = num(r.position_value_usd);
  if (!address || valueUsd == null || valueUsd <= 0) return null;
  const liq = num(r.liquidation_price);
  return {
    address,
    label: typeof r.address_label === 'string' && r.address_label.trim() ? r.address_label.trim() : null,
    side: String(r.side ?? '').toLowerCase().startsWith('s') ? 'short' : 'long',
    valueUsd,
    size: num(r.position_size),
    leverage: parseLeverage(r.leverage),
    leverageType: typeof r.leverage_type === 'string' ? r.leverage_type : null,
    entry: num(r.entry_price),
    mark: num(r.mark_price),
    liq: liq != null && liq > 0 ? liq : null,
    fundingUsd: num(r.funding_usd),
    upnlUsd: num(r.upnl_usd),
    cohorts: [],
  };
}

export const positionKey = (p: Pick<Position, 'address' | 'side'>) => `${p.address.toLowerCase()}:${p.side}`;

/** One list from the all-traders page plus each cohort's page: a position in
 *  a cohort page is tagged with that cohort; positions only a cohort page
 *  returned (outside the all-traders top N) are added, not lost. */
export function mergeCohorts(all: Position[], byCohort: Partial<Record<Cohort, Position[]>>): Position[] {
  const map = new Map<string, Position>();
  for (const p of all) map.set(positionKey(p), { ...p, cohorts: [] });
  for (const c of COHORTS) {
    for (const p of byCohort[c] ?? []) {
      const k = positionKey(p);
      const cur = map.get(k) ?? { ...p, cohorts: [] };
      if (!cur.label && p.label) cur.label = p.label;
      if (!cur.cohorts.includes(c)) cur.cohorts.push(c);
      map.set(k, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.valueUsd - a.valueUsd);
}

/** Median of the marks Nansen returned: one number for "current price". */
export function markOf(positions: Position[]): number | null {
  const m = positions.map((p) => p.mark).filter((x): x is number => x != null && x > 0).sort((a, b) => a - b);
  return m.length ? m[Math.floor(m.length / 2)] : null;
}

export function inCohort(p: Position, cohort: Cohort | 'all'): boolean {
  return cohort === 'all' || p.cohorts.includes(cohort);
}
