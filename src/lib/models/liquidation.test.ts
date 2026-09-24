import { describe, it, expect } from 'vitest';
import { liquidationLadder, parseLeverage, type PerpPositionLike } from './liquidation';

const pos = (side: 'long' | 'short', valueUsd: number, liquidationPrice: number | null, leverage = 5): PerpPositionLike => ({ side, valueUsd, liquidationPrice, leverage });

describe('liquidation ladder', () => {
  // Real HYPE shapes: a $127M long liquidating at 73.37 and shorts at 267 and 320, mark 92.33.
  it('puts longs below the mark and shorts above, in distance bands', () => {
    const l = liquidationLadder([pos('long', 127e6, 73.37), pos('short', 66.9e6, 267.05), pos('short', 62.7e6, 319.87), pos('long', 1e6, 90)], 92.33)!;
    const long = l.bands.filter((b) => b.side === 'long' && b.usd > 0);
    expect(long.map((b) => [b.inner, b.outer])).toEqual([[-0.02, -0.05], [-0.2, -0.3]]); // 90 is −2.5%, 73.37 is −20.5%
    expect(l.longUsd).toBe(128e6);
    expect(l.near.longUsd).toBe(1e6);
    expect(l.densest!.side).toBe('long');
    // Shorts at +189% and +246% are beyond the ±100% ladder.
    expect(l.bands.filter((b) => b.side === 'short').every((b) => b.usd === 0)).toBe(true);
    expect(l.shortUsd).toBeCloseTo(129.6e6);
  });

  it('counts positions with no liquidation price, or already past it, as unpriced', () => {
    const l = liquidationLadder([pos('long', 10, null), pos('long', 10, 120), pos('short', 10, 50)], 100)!;
    expect(l.unpriced).toBe(3);
    expect(l.bands.every((b) => b.usd === 0)).toBe(true);
  });

  it('weights average leverage by size and reads "5X"', () => {
    expect(parseLeverage('5X')).toBe(5);
    expect(parseLeverage('x')).toBeNull();
    const l = liquidationLadder([pos('long', 300, 90, 10), pos('short', 100, 110, 2)], 100)!;
    expect(l.avgLeverage).toBeCloseTo(8);
  });

  it('needs a mark price', () => {
    expect(liquidationLadder([], 0)).toBeNull();
  });
});
