import { describe, it, expect } from 'vitest';
import {
  flowRatio, robustZScore, pressureFromZ, chainPressureWindow, blendChainPressure, pressureBand,
  type WindowInput, type CpiWindowResult,
} from './cpi';

describe('flowRatio', () => {
  it('divides net flow by volume', () => {
    expect(flowRatio({ netFlowUsd: 1_000_000, volumeUsd: 10_000_000 })).toBeCloseTo(0.1);
  });

  it('floors volume so a near-zero-volume chain does not produce an absurd ratio', () => {
    const thin = flowRatio({ netFlowUsd: 500, volumeUsd: 50 });
    const withFloor = flowRatio({ netFlowUsd: 500, volumeUsd: 10_000 });
    expect(thin).toBeCloseTo(withFloor); // both hit the floor
    expect(Math.abs(thin)).toBeLessThan(1);
  });

  it('handles zero volume without throwing or returning Infinity', () => {
    const r = flowRatio({ netFlowUsd: 1000, volumeUsd: 0 });
    expect(Number.isFinite(r)).toBe(true);
  });
});

describe('robustZScore', () => {
  it('returns 0 for an empty sample', () => {
    expect(robustZScore(0.5, [])).toBe(0);
  });

  it('returns 0 when the sample has no spread (all identical values)', () => {
    expect(robustZScore(0.5, [0.1, 0.1, 0.1, 0.1])).toBe(0);
  });

  it('is near 0 for a value at the sample median', () => {
    const sample = [0.1, 0.2, 0.3, 0.4, 0.5];
    expect(Math.abs(robustZScore(0.3, sample))).toBeLessThan(0.1);
  });

  it('is strongly positive for a clear outlier above the sample', () => {
    const sample = [0.08, 0.09, 0.1, 0.11, 0.12];
    expect(robustZScore(1.0, sample)).toBeGreaterThan(3);
  });

  it('is strongly negative for a clear outlier below the sample', () => {
    const sample = [0.08, 0.09, 0.1, 0.11, 0.12];
    expect(robustZScore(-1.0, sample)).toBeLessThan(-3);
  });

  it('is far less sensitive to a single extreme value than a mean/stdev z-score would be', () => {
    const sampleWithOutlier = [0.1, 0.1, 0.1, 0.1, 50]; // one wild whale trade
    // A naive mean/stdev z-score would be dominated by the outlier and make
    // 0.1 look extreme; the robust version should still see 0.1 as normal.
    const z = robustZScore(0.1, sampleWithOutlier);
    expect(Math.abs(z)).toBeLessThan(1);
  });
});

describe('pressureFromZ', () => {
  it('maps z=0 to CPI 50 (no signal)', () => {
    expect(pressureFromZ(0)).toBe(50);
  });

  it('saturates toward 100 for a large positive z rather than diverging', () => {
    expect(pressureFromZ(100)).toBeLessThanOrEqual(100);
    expect(pressureFromZ(100)).toBeGreaterThan(99);
  });

  it('saturates toward 0 for a large negative z rather than diverging', () => {
    expect(pressureFromZ(-100)).toBeGreaterThanOrEqual(0);
    expect(pressureFromZ(-100)).toBeLessThan(1);
  });

  it('is monotonically increasing in z', () => {
    expect(pressureFromZ(1)).toBeGreaterThan(pressureFromZ(0));
    expect(pressureFromZ(2)).toBeGreaterThan(pressureFromZ(1));
  });
});

describe('chainPressureWindow', () => {
  const input: WindowInput = { netFlowUsd: 2_000_000, volumeUsd: 10_000_000 };
  const history = [0.05, 0.06, 0.04, 0.05, 0.07, 0.05, 0.06]; // 7 days of trailing ratios

  it('uses trailing history when present and reports usedCrossSectional=false', () => {
    const r = chainPressureWindow(input, '24h', history);
    expect(r.usedCrossSectional).toBe(false);
    expect(r.ratio).toBeCloseTo(0.2);
    expect(r.cpi).toBeGreaterThan(50); // 0.2 is well above this chain's own 0.05-ish history
  });

  it('falls back to cross-sectional comparison when history is empty, and flags it', () => {
    const peers = [0.01, 0.02, 0.015, 0.18, 0.03]; // other chains' current ratios
    const r = chainPressureWindow(input, '24h', [], peers);
    expect(r.usedCrossSectional).toBe(true);
    expect(r.z).not.toBe(0); // real signal from the peer comparison
  });

  it('returns z=0 / cpi=50 when both history and crossSectional are empty (day-1, no peers yet)', () => {
    const r = chainPressureWindow(input, '24h', [], []);
    expect(r.z).toBe(0);
    expect(r.cpi).toBe(50);
    expect(r.usedCrossSectional).toBe(true);
  });
});

describe('blendChainPressure', () => {
  const make = (cpi: number, usedCrossSectional = false): CpiWindowResult => ({
    window: '1h', ratio: 0, z: 0, cpi, usedCrossSectional,
  });

  it('blends all three windows with the documented weights (0.2/0.5/0.3)', () => {
    const result = blendChainPressure({
      '1h': make(80), '24h': make(60), '7d': make(40),
    });
    expect(result.cpi).toBeCloseTo(0.2 * 80 + 0.5 * 60 + 0.3 * 40);
    expect(result.anyCrossSectional).toBe(false);
  });

  it('renormalizes weights when one window is missing rather than treating it as 0', () => {
    // Only 24h and 7d present (weights 0.5 + 0.3 = 0.8), renormalized to
    // 0.625/0.375 rather than silently averaging in a phantom 0 for 1h.
    const result = blendChainPressure({ '24h': make(60), '7d': make(40) });
    const expected = (0.5 * 60 + 0.3 * 40) / 0.8;
    expect(result.cpi).toBeCloseTo(expected);
  });

  it('works with only a single window present', () => {
    const result = blendChainPressure({ '24h': make(70) });
    expect(result.cpi).toBeCloseTo(70);
  });

  it('throws with a clear message when given zero windows rather than returning NaN silently', () => {
    expect(() => blendChainPressure({})).toThrow(/no windows present/);
  });

  it('surfaces anyCrossSectional=true if any contributing window used it', () => {
    const result = blendChainPressure({
      '1h': make(80, true), '24h': make(60, false), '7d': make(40, false),
    });
    expect(result.anyCrossSectional).toBe(true);
  });
});

describe('pressureBand', () => {
  it('classifies above 65 as high', () => {
    expect(pressureBand(66)).toBe('high');
    expect(pressureBand(100)).toBe('high');
  });

  it('classifies below 35 as low', () => {
    expect(pressureBand(34)).toBe('low');
    expect(pressureBand(0)).toBe('low');
  });

  it('classifies 35-65 inclusive as neutral', () => {
    expect(pressureBand(35)).toBe('neutral');
    expect(pressureBand(50)).toBe('neutral');
    expect(pressureBand(65)).toBe('neutral');
  });
});
