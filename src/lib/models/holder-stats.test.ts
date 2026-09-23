import { describe, it, expect } from 'vitest';
import { hhi, normalizedHhi, gini, topNShare, nakamotoCoefficient, lorenzCurve } from './holder-stats';

describe('hhi', () => {
  it('is 1 for a single holder owning everything', () => {
    expect(hhi([1])).toBe(1);
  });

  it('is 1/N for N equal holders', () => {
    expect(hhi([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(0.25);
    expect(hhi(Array(10).fill(0.1))).toBeCloseTo(0.1);
  });

  it('is 0 for an empty holder list', () => {
    expect(hhi([])).toBe(0);
  });

  it('is higher for a more concentrated distribution with the same holder count', () => {
    const even = [0.25, 0.25, 0.25, 0.25];
    const skewed = [0.7, 0.1, 0.1, 0.1];
    expect(hhi(skewed)).toBeGreaterThan(hhi(even));
  });
});

describe('normalizedHhi', () => {
  it('is 0 for N equal holders regardless of N', () => {
    expect(normalizedHhi([0.5, 0.5])).toBeCloseTo(0);
    expect(normalizedHhi(Array(20).fill(0.05))).toBeCloseTo(0);
  });

  it('is 1 for a single holder', () => {
    // N=1 is the undefined case per the function's own contract (nothing
    // to normalize against), so this checks N=2 with one holding ~everything.
    expect(normalizedHhi([0.999, 0.001])).toBeGreaterThan(0.99);
  });

  it('returns 0 for zero or one holder (normalization undefined)', () => {
    expect(normalizedHhi([])).toBe(0);
    expect(normalizedHhi([1])).toBe(0);
  });

  it('increases monotonically as one holder\'s share grows, for a fixed holder count', () => {
    // Four holders, progressively less equal: the first holder's share
    // rises from 0.25 (perfectly equal) toward dominance, the other three
    // always splitting the remainder evenly. N stays fixed at 4 throughout,
    // isolating "more concentrated" from "different N" — the two things
    // raw HHI alone can't tell apart, which is what normalization is for.
    const shares = [0.25, 0.4, 0.55, 0.7, 0.85].map((top) => {
      const rest = (1 - top) / 3;
      return [top, rest, rest, rest];
    });
    const scores = shares.map(normalizedHhi);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1]);
    }
  });
});

describe('gini', () => {
  it('is 0 for perfect equality', () => {
    expect(gini([0.2, 0.2, 0.2, 0.2, 0.2])).toBeCloseTo(0);
  });

  it('approaches 1 for extreme inequality with many holders', () => {
    const nearlyAllOneHolder = [0.99, ...Array(99).fill(0.0001)];
    expect(gini(nearlyAllOneHolder)).toBeGreaterThan(0.9);
  });

  it('is 0 for fewer than 2 holders', () => {
    expect(gini([])).toBe(0);
    expect(gini([1])).toBe(0);
  });

  it('increases as inequality increases, holding holder count fixed', () => {
    const low = [0.3, 0.3, 0.2, 0.2];
    const high = [0.7, 0.15, 0.1, 0.05];
    expect(gini(high)).toBeGreaterThan(gini(low));
  });
});

describe('topNShare', () => {
  it('sums the largest N shares regardless of input order', () => {
    expect(topNShare([0.05, 0.3, 0.1, 0.4, 0.15], 2)).toBeCloseTo(0.7);
  });

  it('sums all shares when N exceeds the holder count', () => {
    expect(topNShare([0.5, 0.3, 0.2], 10)).toBeCloseTo(1);
  });

  it('is 0 for an empty list', () => {
    expect(topNShare([], 10)).toBe(0);
  });
});

describe('nakamotoCoefficient', () => {
  it('is 1 when a single holder alone exceeds the threshold', () => {
    expect(nakamotoCoefficient([0.6, 0.1, 0.1, 0.1, 0.1], 0.51)).toBe(1);
  });

  it('counts up from the largest holder until the threshold is cleared', () => {
    // 0.3 + 0.25 = 0.55 > 0.51, so it takes 2 holders.
    expect(nakamotoCoefficient([0.3, 0.25, 0.2, 0.15, 0.1], 0.51)).toBe(2);
  });

  it('returns the full holder count if even summing everyone does not clear the threshold', () => {
    // Fractional shares that sum to less than 1 (a partial holder view).
    expect(nakamotoCoefficient([0.1, 0.1, 0.1], 0.51)).toBe(3);
  });

  it('returns 0 for an empty holder list', () => {
    expect(nakamotoCoefficient([], 0.51)).toBe(0);
  });
});

describe('lorenzCurve', () => {
  it('always starts at (0,0) and ends at (1,1)', () => {
    const points = lorenzCurve([0.4, 0.3, 0.2, 0.1]);
    expect(points[0]).toEqual({ populationShare: 0, supplyShare: 0 });
    expect(points[points.length - 1]).toEqual({ populationShare: 1, supplyShare: 1 });
  });

  it('is the 45-degree line for perfect equality', () => {
    const points = lorenzCurve([0.25, 0.25, 0.25, 0.25]);
    for (const p of points) {
      expect(p.supplyShare).toBeCloseTo(p.populationShare, 5);
    }
  });

  it('bows below the equality line for an unequal distribution', () => {
    const points = lorenzCurve([0.7, 0.1, 0.1, 0.1]);
    // At the halfway population mark, supply share should be well under 0.5.
    const midpoint = points.find((p) => Math.abs(p.populationShare - 0.5) < 0.01);
    expect(midpoint?.supplyShare).toBeLessThan(0.5);
  });

  it('handles an empty holder list without throwing', () => {
    const points = lorenzCurve([]);
    expect(points[0]).toEqual({ populationShare: 0, supplyShare: 0 });
    expect(points[points.length - 1]).toEqual({ populationShare: 1, supplyShare: 1 });
  });

  it('orders poorest-first even when input is given richest-first', () => {
    const points = lorenzCurve([0.6, 0.3, 0.1]);
    // First real segment after (0,0) should correspond to the SMALLEST
    // holder (0.1), so supplyShare at populationShare=1/3 should be 0.1.
    const firstThird = points.find((p) => Math.abs(p.populationShare - 1 / 3) < 0.01);
    expect(firstThird?.supplyShare).toBeCloseTo(0.1, 5);
  });
});

describe('normalizedHhi on a partial view of supply', () => {
  it('never goes negative when the observed shares sum to well under 1', () => {
    const shares = Array.from({ length: 100 }, () => 0.006); // top 100 hold 60%, evenly
    expect(normalizedHhi(shares)).toBe(0);
  });
});
