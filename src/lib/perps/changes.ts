// What changed between two observed position snapshots, and the Smart Money
// conviction shift built from it. Pure and unit-tested.
//
// A snapshot is the merged position list Peregrine stored when it last read
// tgm/perp-positions for the coin. Positions are matched by address; a change
// in side is a flip. Because each read covers only the largest positions per
// cohort, a position can "close" by dropping out of the observed set: those
// are reported as "left the observed set", not as closes, unless their value
// was large enough that dropping out means it really shrank (see `edgeUsd`).
import { positionKey, type Cohort, type Position, type Side } from './positions';

export type ChangeKind = 'opened' | 'closed' | 'increased' | 'reduced' | 'flipped' | 'left-set';

export interface PositionChange {
  kind: ChangeKind;
  address: string;
  label: string | null;
  cohorts: Cohort[];
  side: Side;
  /** Side before, for flips. */
  fromSide: Side | null;
  beforeUsd: number;
  afterUsd: number;
  deltaUsd: number;
  before: Position | null;
  after: Position | null;
}

/** Relative change below which a position counts as unchanged (mark moves alone shift value). */
export const MIN_REL_CHANGE = 0.1;

export function diffSnapshots(prev: Position[], cur: Position[], edgeUsd: number): PositionChange[] {
  const byAddr = (list: Position[]) => {
    const m = new Map<string, Position>();
    for (const p of list) {
      const k = p.address.toLowerCase();
      const had = m.get(k);
      if (!had || p.valueUsd > had.valueUsd) m.set(k, p);
    }
    return m;
  };
  const a = byAddr(prev), b = byAddr(cur);
  const out: PositionChange[] = [];
  for (const [k, now] of b) {
    const was = a.get(k);
    const base = { address: now.address, label: now.label ?? was?.label ?? null, cohorts: now.cohorts, after: now, afterUsd: now.valueUsd };
    if (!was) { out.push({ ...base, kind: 'opened', side: now.side, fromSide: null, before: null, beforeUsd: 0, deltaUsd: now.valueUsd }); continue; }
    if (was.side !== now.side) { out.push({ ...base, kind: 'flipped', side: now.side, fromSide: was.side, before: was, beforeUsd: was.valueUsd, deltaUsd: now.valueUsd + was.valueUsd }); continue; }
    const rel = (now.valueUsd - was.valueUsd) / was.valueUsd;
    // Size is the better test when both reads have it: value also moves with price.
    const sizeRel = now.size != null && was.size != null && was.size !== 0 ? (Math.abs(now.size) - Math.abs(was.size)) / Math.abs(was.size) : rel;
    if (Math.abs(sizeRel) < MIN_REL_CHANGE) continue;
    out.push({ ...base, kind: sizeRel > 0 ? 'increased' : 'reduced', side: now.side, fromSide: null, before: was, beforeUsd: was.valueUsd, deltaUsd: now.valueUsd - was.valueUsd });
  }
  for (const [k, was] of a) {
    if (b.has(k)) continue;
    out.push({
      kind: was.valueUsd >= edgeUsd ? 'closed' : 'left-set',
      address: was.address, label: was.label, cohorts: was.cohorts, side: was.side, fromSide: null,
      before: was, after: null, beforeUsd: was.valueUsd, afterUsd: 0, deltaUsd: -was.valueUsd,
    });
  }
  return out.sort((x, y) => Math.abs(y.deltaUsd) - Math.abs(x.deltaUsd));
}

/** The smallest position value in a snapshot: the edge of what Nansen returned. */
export const observedEdge = (list: Position[]) => (list.length ? Math.min(...list.map((p) => p.valueUsd)) : 0);

export interface ShiftSummary {
  cohort: Cohort | 'all';
  /** Net change in long minus short exposure, USD. */
  netExposureDeltaUsd: number;
  longDeltaUsd: number;
  shortDeltaUsd: number;
  counts: Record<ChangeKind, number>;
  /** Distinct traders who moved in the dominant direction. */
  tradersAddingLong: number;
  tradersAddingShort: number;
  direction: 'increasing-long' | 'increasing-short' | 'reducing-long' | 'reducing-short' | 'mixed' | 'unchanged';
}

/** Direction-signed exposure change a single change contributes to longs and shorts. */
function contribution(c: PositionChange): { long: number; short: number } {
  const r = { long: 0, short: 0 };
  if (c.kind === 'flipped') {
    r[c.fromSide!] -= c.beforeUsd;
    r[c.side] += c.afterUsd;
  } else if (c.kind !== 'left-set') {
    r[c.side] += c.deltaUsd;
  }
  return r;
}

/** Conviction shift: explainable aggregates of the changes in one cohort. */
export function convictionShift(changes: PositionChange[], cohort: Cohort | 'all'): ShiftSummary {
  const list = changes.filter((c) => cohort === 'all' || c.cohorts.includes(cohort));
  const counts = { opened: 0, closed: 0, increased: 0, reduced: 0, flipped: 0, 'left-set': 0 } as Record<ChangeKind, number>;
  let longDeltaUsd = 0, shortDeltaUsd = 0;
  const addLong = new Set<string>(), addShort = new Set<string>();
  for (const c of list) {
    counts[c.kind]++;
    const k = contribution(c);
    longDeltaUsd += k.long;
    shortDeltaUsd += k.short;
    if (k.long > 0) addLong.add(c.address.toLowerCase());
    if (k.short > 0) addShort.add(c.address.toLowerCase());
  }
  const net = longDeltaUsd - shortDeltaUsd;
  const gross = Math.abs(longDeltaUsd) + Math.abs(shortDeltaUsd);
  const direction: ShiftSummary['direction'] = !gross ? 'unchanged'
    : Math.abs(net) < gross * 0.2 ? 'mixed'
    : net > 0 ? (longDeltaUsd > 0 ? 'increasing-long' : 'reducing-short')
    : (shortDeltaUsd > 0 ? 'increasing-short' : 'reducing-long');
  return { cohort, netExposureDeltaUsd: net, longDeltaUsd, shortDeltaUsd, counts, tradersAddingLong: addLong.size, tradersAddingShort: addShort.size, direction };
}

export const DIRECTION_TEXT: Record<ShiftSummary['direction'], string> = {
  'increasing-long': 'Increasing long exposure',
  'increasing-short': 'Increasing short exposure',
  'reducing-long': 'Reducing long exposure',
  'reducing-short': 'Reducing short exposure',
  mixed: 'Mixed: adds and cuts roughly offset',
  unchanged: 'No material change',
};

export { positionKey };
