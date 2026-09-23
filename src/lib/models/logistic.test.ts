import { describe, it, expect } from 'vitest';
import { fitLogistic, predictLogistic } from './logistic';
import { auc, brier, calibration, rocCurve, hitRate } from './metrics';

// Deterministic pseudo-random so the tests never flake.
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

describe('fitLogistic', () => {
  it('recovers the sign and rough size of a true effect', () => {
    const r = rng(7);
    const X: number[][] = [], y: number[] = [];
    for (let i = 0; i < 800; i++) {
      const a = r() * 4 - 2, b = r() * 4 - 2;
      X.push([a, b]);
      y.push(r() < 1 / (1 + Math.exp(-(1.5 * a - 0.2))) ? 1 : 0);
    }
    const m = fitLogistic(X, y, ['a', 'b'], 0.1);
    expect(m.weights[0]).toBeGreaterThan(1);
    expect(Math.abs(m.weights[1])).toBeLessThan(0.3);
  });

  it('shrinks coefficients toward zero as lambda grows', () => {
    const X = [[0], [1], [2], [3], [4], [5]], y = [0, 0, 1, 0, 1, 1];
    const loose = fitLogistic(X, y, ['x'], 0.01), tight = fitLogistic(X, y, ['x'], 100);
    expect(Math.abs(tight.weights[0])).toBeLessThan(Math.abs(loose.weights[0]));
  });

  it('stays finite on a rare, nearly separable event with an outlier', () => {
    const X = Array.from({ length: 200 }, (_, i) => [i === 3 ? 1e6 : i % 7, (i * 13) % 11]);
    const y = X.map((_, i) => (i === 3 || i === 150 ? 1 : 0));
    const m = fitLogistic(X, y, ['a', 'b'], 1);
    expect(Number.isFinite(m.intercept)).toBe(true);
    expect(Math.abs(m.intercept)).toBeLessThan(20);
    const p = predictLogistic(m, [3, 5]);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });

  it('survives a constant column and predicts the base rate for it', () => {
    const X = [[1], [1], [1], [1]], y = [0, 1, 0, 0];
    const m = fitLogistic(X, y, ['const'], 1);
    expect(predictLogistic(m, [1])).toBeCloseTo(0.25, 2);
  });
});

describe('metrics', () => {
  it('AUC is 1 for a perfect ranking, 0.5 for all ties, null with one class', () => {
    expect(auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1])).toBe(1);
    expect(auc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1])).toBe(0.5);
    expect(auc([0.1, 0.9], [1, 1])).toBeNull();
  });

  it('Brier is 0 for certain correct calls and 1 for certain wrong ones', () => {
    expect(brier([1, 0], [1, 0])).toBe(0);
    expect(brier([0, 1], [1, 0])).toBe(1);
  });

  it('calibration bins cover every row once', () => {
    const p = Array.from({ length: 23 }, (_, i) => i / 23), y = p.map((v) => (v > 0.5 ? 1 : 0));
    const bins = calibration(p, y, 10);
    expect(bins.reduce((s, b) => s + b.n, 0)).toBe(23);
    expect(bins.at(-1)!.observedRate).toBe(1);
  });

  it('ROC runs from (0,0) to (1,1) and hit rate counts matches', () => {
    const pts = rocCurve([0.2, 0.4, 0.6, 0.8], [0, 1, 0, 1]);
    expect(pts[0]).toEqual({ fpr: 0, tpr: 0 });
    expect(pts.at(-1)).toEqual({ fpr: 1, tpr: 1 });
    expect(hitRate([0.9, 0.1, 0.8], [1, 0, 0])).toBeCloseTo(2 / 3);
  });
});

describe('aucInterval', () => {
  it('is wide with few positives and narrows as they grow', async () => {
    const { aucInterval } = await import('./metrics');
    const few = aucInterval(0.85, 8, 173)!, many = aucInterval(0.85, 200, 2000)!;
    expect(few[1] - few[0]).toBeGreaterThan(many[1] - many[0]);
    expect(few[0]).toBeLessThan(0.85);
    expect(aucInterval(null, 1, 1)).toBeNull();
  });
});
