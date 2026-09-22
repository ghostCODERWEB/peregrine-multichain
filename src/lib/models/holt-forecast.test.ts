import { describe, it, expect } from 'vitest';
import { fitHolt, holtForecast, mape } from './holt-forecast';

describe('fitHolt', () => {
  it('throws on an empty series', () => {
    expect(() => fitHolt([])).toThrow(/empty series/);
  });

  it('handles a series with fewer than 3 points without throwing', () => {
    const fit = fitHolt([50, 55]);
    expect(Number.isFinite(fit.finalLevel)).toBe(true);
    expect(Number.isFinite(fit.finalTrend)).toBe(true);
  });

  it('fits a perfectly linear trend with ~zero residual error at every candidate alpha/beta', () => {
    // A noiseless straight line initialized exactly (level=y0, trend=y1-y0)
    // has zero one-step-ahead error for EVERY (alpha, beta) pair, not just
    // large ones — there is no "preferred" smoothing when there's no noise
    // to smooth. The only meaningful assertion here is that the grid search
    // actually finds that zero-error fit rather than settling for a worse one.
    const perfectLine = Array.from({ length: 20 }, (_, i) => 50 + 2 * i);
    const fit = fitHolt(perfectLine);
    expect(fit.residualStd).toBeCloseTo(0, 5);
  });

  it('prefers a smaller alpha (more smoothing) for a noisy series than a noiseless one would need', () => {
    const noiseless = Array.from({ length: 25 }, (_, i) => 50 + 2 * i);
    const noisy = noiseless.map((v, i) => v + (i % 2 === 0 ? 4 : -4));
    const noisyFit = fitHolt(noisy);
    // The noisy series can't achieve zero residual error at any alpha, so
    // its residualStd should be clearly above the noiseless case's ~0.
    expect(noisyFit.residualStd).toBeGreaterThan(1);
  });

  it('produces near-zero residual std for a constant series', () => {
    const flat = Array(15).fill(60);
    const fit = fitHolt(flat);
    expect(fit.residualStd).toBeCloseTo(0, 5);
    expect(fit.finalLevel).toBeCloseTo(60, 1);
  });

  it('tracks a clear upward trend in its finalTrend estimate', () => {
    const rising = Array.from({ length: 20 }, (_, i) => 40 + 1.5 * i);
    const fit = fitHolt(rising);
    expect(fit.finalTrend).toBeGreaterThan(0.5);
  });

  it('fitted series has the same length as the input', () => {
    const series = [50, 52, 51, 53, 55, 54, 56];
    const fit = fitHolt(series);
    expect(fit.fitted).toHaveLength(series.length);
  });
});

describe('holtForecast', () => {
  const risingSeries = Array.from({ length: 30 }, (_, i) => 50 + 0.5 * i);

  it('continues the trend forward for the requested horizon', () => {
    const { points } = holtForecast(risingSeries, 4);
    expect(points).toHaveLength(4);
    // Forecasts should keep rising, matching the upward trend.
    for (let i = 1; i < points.length; i++) {
      expect(points[i].forecast).toBeGreaterThan(points[i - 1].forecast);
    }
  });

  it('widens the fan band at later steps (more compounded uncertainty)', () => {
    const noisy = risingSeries.map((v, i) => v + (i % 3 === 0 ? 3 : -2));
    const { points } = holtForecast(noisy, 5);
    const width = (p: typeof points[number]) => p.high80 - p.low80;
    expect(width(points[4])).toBeGreaterThan(width(points[0]));
  });

  it('keeps the forecast centered inside its own 80% band at every step', () => {
    const { points } = holtForecast(risingSeries, 6);
    for (const p of points) {
      expect(p.forecast).toBeGreaterThanOrEqual(p.low80);
      expect(p.forecast).toBeLessThanOrEqual(p.high80);
    }
  });

  it('returns a degenerate but finite forecast for a flat two-point series', () => {
    const { points } = holtForecast([50, 50], 3);
    expect(points).toHaveLength(3);
    for (const p of points) expect(Number.isFinite(p.forecast)).toBe(true);
  });
});

describe('mape', () => {
  it('is near 0 for a perfect fit', () => {
    const series = [10, 20, 30, 40];
    expect(mape(series, series)).toBeCloseTo(0, 5);
  });

  it('computes the expected percentage error for a simple known case', () => {
    // Actual 100, fitted 90 -> 10% error on that point (index 1 onward is scored).
    const series = [50, 100];
    const fitted = [50, 90];
    expect(mape(series, fitted)).toBeCloseTo(10, 5);
  });

  it('skips points where the actual value is 0 rather than producing NaN/Infinity', () => {
    const series = [10, 0, 30];
    const fitted = [10, 5, 28];
    const result = mape(series, fitted);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result!)).toBe(true);
  });

  it('returns null if every scoreable point has actual value 0', () => {
    expect(mape([5, 0, 0], [5, 1, 1])).toBeNull();
  });
});
