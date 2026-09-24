import { describe, it, expect } from 'vitest';
import { copyScore, type TraderWindow } from './copy-score';

const w = (x: Partial<TraderWindow>): TraderWindow => ({ totalPnl: null, realizedPnl: null, unrealizedPnl: null, roi: null, accountValue: null, topPositions: [], ...x });

describe('copy-trade candidate score', () => {
  it('rewards a banked, consistent, modest-leverage record', () => {
    const r = copyScore(
      w({ totalPnl: 1e6, realizedPnl: 9e5, roi: 0.4, accountValue: 3e6, topPositions: [{ coin: 'BTC', side: 'long', valueUsd: 4e6, unrealizedUsd: 1e5 }] }),
      w({ totalPnl: 2e5 }),
    );
    expect(r.score).toBeGreaterThan(80);
    expect(r.parts.map((p) => p.id)).toEqual(expect.arrayContaining(['roi', 'consistency', 'banked']));
    expect(r.parts.find((p) => p.id === 'leverage')).toBeUndefined();
  });

  it('marks down paper gains, heavy leverage, open losses and small books', () => {
    const r = copyScore(
      w({ totalPnl: 5e4, realizedPnl: 0, roi: 0.5, accountValue: 8e4, topPositions: [{ coin: 'X', side: 'long', valueUsd: 8e5, unrealizedUsd: -3e4 }] }),
      w({ totalPnl: -1e3 }),
    );
    const ids = r.parts.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['banked', 'leverage', 'open-loss', 'small', 'consistency']));
    expect(r.parts.find((p) => p.id === 'leverage')!.points).toBe(-15); // 10× gross
    expect(r.score).toBeLessThan(45);
  });

  it('marks down an account that holds nothing today', () => {
    const r = copyScore(w({ totalPnl: 1e6, realizedPnl: 1e6, roi: 0.3, accountValue: 0 }), w({ totalPnl: 1e5 }));
    expect(r.parts.find((p) => p.id === 'empty')!.points).toBe(-15);
  });

  it('stays inside 0–100 and needs no 7-day window', () => {
    expect(copyScore(w({ roi: 50, totalPnl: 1, realizedPnl: 1, accountValue: 1e7 }), null).score).toBeLessThanOrEqual(100);
    expect(copyScore(w({}), null)).toEqual({ score: 50, parts: [] });
  });
});
