import { describe, it, expect } from 'vitest';
import { categoryHeat, heatLabel, holderBalance, isSkilled, skilledDivergence, impliedPct, isMover, type HolderLike } from './predict';

describe('category heat', () => {
  it('compares today with the week\'s daily pace', () => {
    // Real Sports shape: $8.09M today, $21.5M over the week (≈ $3.07M a day).
    const s = categoryHeat({ volume24h: 8_091_003, volume1w: 21_521_522, openInterest: 1 });
    expect(s.heat!).toBeCloseTo(2.63, 2);
    expect(heatLabel(s.weather!)).toBe('Hot');
    const p = categoryHeat({ volume24h: 7_682_453, volume1w: 57_156_228, openInterest: 1 }); // Politics
    expect(p.heat!).toBeCloseTo(0.94, 2);
    expect(heatLabel(p.weather!)).toBe('Normal pace');
    expect(categoryHeat({ volume24h: 1, volume1w: 0, openInterest: 0 }).weather).toBeNull();
    expect(categoryHeat({ volume24h: 1, volume1w: 7, openInterest: 0 }).weather).toBeCloseTo(50);
  });
});

const h = (address: string, side: 'Yes' | 'No', size: number, price: number, pnl = 0): HolderLike => ({ address, side, outcomeIndex: side === 'Yes' ? 1 : 2, size, currentPrice: price, avgEntry: null, unrealizedUsd: pnl });

describe('holders', () => {
  it('values each side at its current price', () => {
    const b = holderBalance([h('a', 'Yes', 1000, 0.35, 10), h('b', 'No', 1000, 0.65, -5), h('c', 'Yes', 0, 0.35)]);
    expect(b.yesUsd).toBe(350);
    expect(b.noUsd).toBe(650);
    expect(b.yesShare).toBeCloseTo(0.35);
    expect(b.yesInProfit).toBe(1);
    expect(b.noInProfit).toBe(0);
  });

  it('calls a record skilled only with enough markets, profit and wins', () => {
    expect(isSkilled({ marketsTraded: 40, winRate: 0.6, totalPnlUsd: 5000 })).toBe(true);
    expect(isSkilled({ marketsTraded: 4, winRate: 0.9, totalPnlUsd: 5000 })).toBe(false);
    expect(isSkilled({ marketsTraded: 40, winRate: 0.6, totalPnlUsd: -1 })).toBe(false);
    expect(isSkilled(null)).toBe(false);
  });

  it('measures skilled money against the price, and needs two skilled holders', () => {
    const holders = [h('a', 'Yes', 1000, 0.35), h('b', 'Yes', 1000, 0.35), h('c', 'No', 500, 0.65), h('d', 'No', 9000, 0.65)];
    const good = { marketsTraded: 50, winRate: 0.6, totalPnlUsd: 1e4 };
    const rec = new Map([['a', good], ['b', good], ['c', good]]);
    const d = skilledDivergence(holders, rec, 0.35);
    expect(d.skilled).toBe(3);
    expect(d.skilledYesShare!).toBeCloseTo(700 / (700 + 325));
    expect(d.divergence!).toBeGreaterThan(0.3);
    expect(skilledDivergence(holders, new Map([['a', good]]), 0.35).divergence).toBeNull();
  });
});

describe('implied probability', () => {
  it('reads like a forecast', () => {
    expect(impliedPct(0.004)).toBe('<1%');
    expect(impliedPct(0.35)).toBe('35%');
    expect(impliedPct(0.997)).toBe('>99%');
    expect(impliedPct(null)).toBe('n/a');
  });
});

describe('movers', () => {
  const now = Date.parse('2026-09-24T00:00:00Z');
  it('skips thin markets and ones that resolve within two days', () => {
    expect(isMover({ volume24h: 60_000, change1d: -0.11, endDate: '2026-10-29T03:59:00' }, now)).toBe(true);
    expect(isMover({ volume24h: 60_000, change1d: -0.85, endDate: '2026-09-24T18:00:00' }, now)).toBe(false);
    expect(isMover({ volume24h: 10_000, change1d: 0.5, endDate: null }, now)).toBe(false);
    expect(isMover({ volume24h: 60_000, change1d: 0, endDate: null }, now)).toBe(false);
    // A match that just ended: settled near 0 though its end date is weeks away.
    expect(isMover({ volume24h: 90_000, change1d: -0.85, endDate: '2026-10-30T00:00:00', price: 0.01 }, now)).toBe(false);
    expect(isMover({ volume24h: 90_000, change1d: -0.2, endDate: '2026-10-30T00:00:00', price: 0.4 }, now)).toBe(true);
  });
});
