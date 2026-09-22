import { describe, it, expect } from 'vitest';
import { logReturns, ewmaVolatility, volatilityCone } from './volatility-cone';

describe('logReturns', () => {
  it('computes ln(P_t/P_t-1) for a simple series', () => {
    const returns = logReturns([100, 110]);
    expect(returns[0]).toBeCloseTo(Math.log(1.1), 6);
  });

  it('returns one fewer value than the input closes', () => {
    const closes = [100, 105, 103, 108, 110];
    expect(logReturns(closes)).toHaveLength(closes.length - 1);
  });

  it('returns an empty array for a single price (nothing to compare)', () => {
    expect(logReturns([100])).toEqual([]);
  });

  it('returns an empty array for an empty input', () => {
    expect(logReturns([])).toEqual([]);
  });

  it('skips a transition through a non-positive price instead of producing NaN/-Infinity', () => {
    const returns = logReturns([100, 0, 105]);
    for (const r of returns) expect(Number.isFinite(r)).toBe(true);
  });

  it('is 0 for a flat price series', () => {
    const returns = logReturns([100, 100, 100]);
    expect(returns.every((r) => r === 0)).toBe(true);
  });
});

describe('ewmaVolatility', () => {
  it('is 0 for an empty return series', () => {
    expect(ewmaVolatility([])).toBe(0);
  });

  it('is 0 for a series of all-zero returns', () => {
    expect(ewmaVolatility(Array(20).fill(0))).toBe(0);
  });

  it('is higher for a more volatile return series', () => {
    const calm = Array(30).fill(0).map((_, i) => (i % 2 === 0 ? 0.001 : -0.001));
    const wild = Array(30).fill(0).map((_, i) => (i % 2 === 0 ? 0.08 : -0.08));
    expect(ewmaVolatility(wild)).toBeGreaterThan(ewmaVolatility(calm));
  });

  it('weights recent returns more heavily than old ones', () => {
    // Calm history, then one recent volatility spike — EWMA should pick up
    // the spike more than a simple full-sample stdev would understate it as.
    const calmThenSpike = [...Array(20).fill(0.001), 0.15, 0.15, 0.15];
    const allCalm = Array(23).fill(0.001);
    expect(ewmaVolatility(calmThenSpike)).toBeGreaterThan(ewmaVolatility(allCalm));
  });

  it('handles a return series shorter than the seed window without throwing', () => {
    const short = [0.01, -0.02, 0.015];
    expect(Number.isFinite(ewmaVolatility(short, 0.94, 10))).toBe(true);
  });

  it('never returns a negative volatility', () => {
    const returns = [0.05, -0.1, 0.02, -0.03, 0.15, -0.08];
    expect(ewmaVolatility(returns)).toBeGreaterThanOrEqual(0);
  });
});

describe('volatilityCone', () => {
  it('mid always equals the current price at every horizon', () => {
    const bands = volatilityCone(100, 0.03, [1, 3, 7]);
    for (const b of bands) expect(b.mid).toBe(100);
  });

  it('widens the band at longer horizons (sqrt(h) scaling)', () => {
    const bands = volatilityCone(100, 0.03, [1, 7]);
    const width = (b: typeof bands[number]) => b.high - b.low;
    expect(width(bands[1])).toBeGreaterThan(width(bands[0]));
  });

  it('produces a symmetric band in log space around the current price', () => {
    const [band] = volatilityCone(100, 0.03, [5]);
    // log(high/mid) should be approximately -log(low/mid)
    expect(Math.log(band.high / 100)).toBeCloseTo(-Math.log(band.low / 100), 10);
  });

  it('collapses to the current price at zero volatility', () => {
    const [band] = volatilityCone(100, 0, [5]);
    expect(band.low).toBeCloseTo(100, 5);
    expect(band.high).toBeCloseTo(100, 5);
  });

  it('returns one entry per requested horizon, in the order given', () => {
    const bands = volatilityCone(50, 0.02, [1, 3, 7]);
    expect(bands.map((b) => b.horizon)).toEqual([1, 3, 7]);
  });
});
