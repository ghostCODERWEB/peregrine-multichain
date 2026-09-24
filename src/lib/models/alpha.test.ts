import { describe, it, expect } from 'vitest';
import { alphaScore, type AlphaInput } from './alpha';

const base: AlphaInput = { flowShare: null, hourly: [], smartShare: null, liquidityUsd: null, priceChange24h: null, stormScore: null, ageDays: null };

describe('alpha score', () => {
  it('is 50 with nothing to go on', () => {
    expect(alphaScore(base)).toEqual({ score: 50, parts: [] });
  });

  it('rewards steady, accelerating net buying and names each reason', () => {
    const r = alphaScore({ ...base, flowShare: 0.15, hourly: [0.02, 0.05, 0.04, 0.06, 0.12], liquidityUsd: 2e6 });
    expect(r.score).toBeGreaterThan(70);
    expect(r.parts.map((p) => p.id)).toEqual(expect.arrayContaining(['flow', 'persistence', 'acceleration']));
    expect(r.parts.every((p) => p.detail.length > 0)).toBe(true);
  });

  it('pulls a thin, extended, storm-flagged token down even on buying', () => {
    const r = alphaScore({ ...base, flowShare: 0.2, liquidityUsd: 30_000, priceChange24h: 1.5, stormScore: 72, ageDays: 0.5 });
    expect(r.score).toBeLessThan(40);
    expect(r.parts[0].id).toBe('liquidity'); // largest magnitude first: −20 beats +17
    expect(r.parts.map((p) => p.id)).toEqual(expect.arrayContaining(['liquidity', 'extended', 'storm', 'new']));
  });

  it('caps every component and the total, and still ranks 40% above 20%', () => {
    const r = alphaScore({ ...base, flowShare: 5, smartShare: 5, hourly: [1, 1, 1, 1, 9] });
    expect(r.parts.find((p) => p.id === 'flow')!.points).toBe(25);
    expect(r.parts.find((p) => p.id === 'smart')!.points).toBe(20);
    expect(alphaScore({ ...base, flowShare: 0.4 }).score).toBeGreaterThan(alphaScore({ ...base, flowShare: 0.2 }).score);
    expect(alphaScore({ ...base, flowShare: 0.1, flowWindow: '1h' }).parts[0].detail).toContain('1h');
    expect(r.score).toBeLessThanOrEqual(100);
    expect(alphaScore({ ...base, flowShare: -5, smartShare: -5, liquidityUsd: 1, stormScore: 99 }).score).toBeGreaterThanOrEqual(0);
  });

  it('needs four scans before judging persistence', () => {
    expect(alphaScore({ ...base, hourly: [0.1, 0.1, 0.1] }).parts).toEqual([]);
  });
});
