import { describe, it, expect } from 'vitest';
import { normalizeRow, mergeCohorts, markOf, parseLeverage, type Position } from './positions';
import { liquidationBands, positionsInBand, nearestToLiquidation, leverageDistribution, entryDistribution, cohortMatrix, crowding, applyFilters, bandIndex, bandRange } from './liquidation';
import { diffSnapshots, convictionShift, observedEdge } from './changes';

const P = (o: Partial<Position> & { address: string }): Position => ({
  label: null, side: 'long', valueUsd: 1000, size: 1, leverage: 10, leverageType: 'cross', entry: 100, mark: 100, liq: 90, fundingUsd: 0, upnlUsd: 0, cohorts: [], ...o,
});

describe('positions', () => {
  it('normalizes Nansen rows and drops empty ones', () => {
    expect(parseLeverage('20X')).toBe(20);
    expect(parseLeverage('x')).toBeNull();
    const p = normalizeRow({ address: '0xA', address_label: ' Smart HL Perps Trader ', side: 'Short', position_value_usd: 5e5, leverage: '5X', liquidation_price: 120, mark_price: 100 });
    expect(p).toMatchObject({ side: 'short', label: 'Smart HL Perps Trader', leverage: 5, liq: 120 });
    expect(normalizeRow({ address: '0xB', position_value_usd: 0 })).toBeNull();
    expect(normalizeRow({ address: '0xC', position_value_usd: 5, liquidation_price: -1 })?.liq).toBeNull();
  });
  it('merges cohort pages: tags known positions and keeps cohort-only ones', () => {
    const all = [P({ address: '0xa', valueUsd: 10 }), P({ address: '0xb', valueUsd: 5 })];
    const merged = mergeCohorts(all, { smart_money: [P({ address: '0xA', label: 'SM' }), P({ address: '0xz', valueUsd: 1 })], whale: [P({ address: '0xb' })] });
    expect(merged.find((p) => p.address === '0xa')).toMatchObject({ cohorts: ['smart_money'], label: 'SM' });
    expect(merged.find((p) => p.address === '0xb')?.cohorts).toEqual(['whale']);
    expect(merged.find((p) => p.address === '0xz')?.cohorts).toEqual(['smart_money']);
    expect(markOf([P({ address: '1', mark: 1 }), P({ address: '2', mark: 3 }), P({ address: '3', mark: 2 })])).toBe(2);
  });
});

describe('liquidation bands', () => {
  const ps = [
    P({ address: '1', side: 'long', liq: 95.1, valueUsd: 100, cohorts: ['smart_money'] }),
    P({ address: '2', side: 'long', liq: 95.2, valueUsd: 50, leverage: 20 }),
    P({ address: '3', side: 'short', liq: 110, valueUsd: 70, cohorts: ['whale'] }),
    P({ address: '4', side: 'long', liq: 10, valueUsd: 999 }),
    P({ address: '5', liq: null }),
  ];
  it('anchors bands at the mark and places each position by its liquidation price', () => {
    expect(bandIndex(100, 100, 0.01)).toBe(0);
    expect(bandRange(0, 100, 0.01)).toEqual({ lo: 99.5, hi: 100.5 });
    const { bands, unplaced } = liquidationBands(ps, 100, 0.01, 0.25);
    expect(unplaced).toBe(2);
    const b95 = bands.find((b) => b.lo <= 95.1 && b.hi > 95.1)!;
    expect(b95).toMatchObject({ longUsd: 150, shortUsd: 0, positions: 2, traders: 2, smUsd: 100, smTraders: 1, medianLeverage: 15 });
    expect(b95.largest?.address).toBe('1');
    expect(bands[0].shortUsd).toBe(70);
    expect(bands[0].whaleUsd).toBe(70);
    expect(positionsInBand(ps, b95.lo, b95.hi)).toHaveLength(2);
  });
  it('ranks positions by the adverse move that liquidates them', () => {
    const near = nearestToLiquidation(ps, 100);
    expect(near[0].p.address).toBe('2');
    expect(near[0].d).toBeCloseTo(0.048, 3);
    expect(near.map((x) => x.p.address)).not.toContain('5');
  });
  it('buckets leverage and entries by exposure, not only count', () => {
    const lev = leverageDistribution(ps);
    expect(lev.find((b) => b.key === '10-20')).toMatchObject({ count: 4, longUsd: 100 + 999 + 1000, shortUsd: 70 });
    expect(lev.find((b) => b.key === '20+')).toMatchObject({ count: 1, longUsd: 50 });
    const entries = entryDistribution([P({ address: '1', entry: 100.2, valueUsd: 3 }), P({ address: '2', entry: 99.9, side: 'short', valueUsd: 2 })], 100);
    expect(entries).toEqual([{ lo: 99.5, hi: 100.5, longUsd: 3, shortUsd: 2, count: 2 }]);
  });
  it('builds the cohort matrix, crowding components and filters', () => {
    const m = cohortMatrix(ps, 100);
    expect(m[0]).toMatchObject({ cohort: 'all', positions: 5, longShare: expect.any(Number) });
    expect(m[1]).toMatchObject({ cohort: 'smart_money', positions: 1, longUsd: 100, shortUsd: 0, longShare: 1 });
    expect(m[0].nearLiqUsd).toBe(150);
    const c = crowding(ps);
    expect(c.totalUsd).toBe(100 + 50 + 70 + 999 + 1000);
    expect(c.top10Share).toBe(1);
    expect(applyFilters(ps, { cohort: 'all', side: 'short', minUsd: 0, minLeverage: 1 })).toHaveLength(1);
    expect(applyFilters(ps, { cohort: 'all', side: 'both', minUsd: 60, minLeverage: 15 })).toHaveLength(0);
  });
});

describe('what changed', () => {
  const prev = [P({ address: 'a', valueUsd: 100, size: 1, cohorts: ['smart_money'] }), P({ address: 'b', valueUsd: 100, size: 1 }), P({ address: 'c', valueUsd: 500, size: 5, cohorts: ['smart_money'] }), P({ address: 'd', valueUsd: 50, size: 1 }), P({ address: 'e', valueUsd: 100, size: 1 })];
  const cur = [P({ address: 'A', valueUsd: 200, size: 2, cohorts: ['smart_money'] }), P({ address: 'b', side: 'short', valueUsd: 80, size: 1 }), P({ address: 'e', valueUsd: 104, size: 1.02 }), P({ address: 'n', valueUsd: 300, size: 3, cohorts: ['smart_money'] })];
  const changes = diffSnapshots(prev, cur, observedEdge(prev) + 10);
  it('classifies opens, increases, flips, closes, and ignores price-only moves', () => {
    const kind = (a: string) => changes.find((c) => c.address.toLowerCase() === a)?.kind;
    expect(kind('a')).toBe('increased');
    expect(kind('b')).toBe('flipped');
    expect(kind('c')).toBe('closed');
    expect(kind('d')).toBe('left-set');
    expect(kind('n')).toBe('opened');
    expect(kind('e')).toBeUndefined();
  });
  it('summarizes Smart Money conviction from the same records', () => {
    const s = convictionShift(changes, 'smart_money');
    expect(s.counts).toMatchObject({ opened: 1, increased: 1, closed: 1 });
    expect(s.longDeltaUsd).toBe(100 + 300 - 500);
    expect(s.direction).toBe('reducing-long');
    expect(convictionShift([], 'all').direction).toBe('unchanged');
    const all = convictionShift(changes, 'all');
    expect(all.shortDeltaUsd).toBe(80);
    expect(all.tradersAddingShort).toBe(1);
  });
});
