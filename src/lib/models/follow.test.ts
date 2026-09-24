import { describe, it, expect } from 'vitest';
import { clusterEvents, windowStats, verdictOf, outcome24h, summarize, WINDOW_MS, type TapeTrade } from './follow';

const M = 60_000, T = 1_800_000_000_000, H = 3_600_000;
const buy = (min: number, wallet: string, usd = 100): TapeTrade => ({ t: T + min * M, wallet, side: 'buy', usd });

describe('smart-money follow-through', () => {
  it('clusters nearby smart-money buys into one event and keeps the largest', () => {
    const ev = clusterEvents([{ t: T, wallet: '0xAA', usd: 500 }, { t: T + 5 * M, wallet: '0xbb', usd: 300 }, { t: T + 60 * M, wallet: '0xcc', usd: 50 }, { t: T + 120 * M, wallet: '0xaa', usd: 900 }], 2 * WINDOW_MS, 2);
    expect(ev).toEqual([{ t: T + 120 * M, wallets: ['0xaa'], usd: 900, buys: 1 }, { t: T, wallets: ['0xaa', '0xbb'], usd: 800, buys: 2 }]);
  });
  it('counts distinct non-leader buyers per covered minute', () => {
    const tape = [buy(-8, 'x'), buy(-2, 'y'), buy(1, 'a'), buy(2, 'b'), buy(3, 'c'), buy(4, 'c'), buy(5, '0xAA'), { t: T + 6 * M, wallet: 'd', side: 'sell' as const, usd: 40 }];
    const leaders = new Set(['0xaa']);
    const before = windowStats(tape, T - WINDOW_MS, T, leaders, null);
    const after = windowStats(tape, T, T + WINDOW_MS, leaders, null);
    expect(before).toMatchObject({ buyers: 2, coveredMin: 10, perMin: 0.2, truncated: false });
    expect(after).toMatchObject({ buyers: 3, buyUsd: 400, sellUsd: 40 });
    expect(verdictOf(before, after)).toEqual({ ratio: expect.closeTo(0.4 / 0.3, 6), verdict: 'no change' });
  });
  it('measures a truncated window on the tape Nansen returned, and refuses under a minute', () => {
    const tape = [buy(0.1, 'a'), buy(0.2, 'b'), buy(0.3, 'c'), buy(2, 'd'), buy(3, 'e')];
    const cut = windowStats(tape, T, T + WINDOW_MS, new Set(), T + 2.5 * M);
    expect(cut).toMatchObject({ truncated: true, coveredMin: 2.5, buyers: 4 });
    const before = windowStats([buy(-5, 'z')], T - WINDOW_MS, T, new Set(), null);
    expect(verdictOf(before, cut).verdict).toBe('followed'); // 1.6/min vs 0.1/min, 4 buyers
    expect(verdictOf(before, windowStats(tape, T, T + WINDOW_MS, new Set(), T + 0.5 * M)).verdict).toBe('too little tape');
  });
  it('24h outcome uses closes known at each end; pending until 24h have closed', () => {
    const candles = Array.from({ length: 30 }, (_, i) => ({ t: T - 2 * H + i * H, c: 100 + i }));
    expect(outcome24h(candles, T, H)).toEqual({ from: 101, to: 125, ret: 125 / 101 - 1 });
    expect(outcome24h(candles.slice(0, 10), T, H)).toBeNull(); // only 7h of later closes: pending, not the last known price
  });
  it('summarizes outcomes for followed events against the rest', () => {
    const r = (verdict: 'followed' | 'ignored', ret: number) => ({ event: { t: 0, wallets: [], usd: 1, buys: 1 }, before: {} as never, after: {} as never, ratio: 1, verdict, outcome: { from: 1, to: 1 + ret, ret }, outcomePending: false });
    expect(summarize([r('followed', 0.1), r('followed', 0.3), r('ignored', -0.05)])).toEqual({ events: 3, judged: 3, followed: 2, ignored: 1, medianAfterFollowed: 0.2, medianAfterOthers: -0.05 });
  });
});
