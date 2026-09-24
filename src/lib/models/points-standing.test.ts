import { describe, it, expect } from 'vitest';
import { findStanding, type LeaderPage } from './points-standing';

// Synthetic leaderboard: 10,500 wallets, points falling with rank, ties at
// the tail (shared rank), eligible from 1,000 points. Page p = ranks p·1000+1….
const TOTAL = 10_500, SIZE = 1000;
const pointsAt = (i: number) => (i < 9000 ? 20_000 - 2 * i : 100); // i = 0-based position
const rankAt = (i: number) => (i < 9000 ? i + 1 : 9001);
function board(): { read: (p: number) => Promise<LeaderPage>; reads: number[] } {
  const reads: number[] = [];
  return {
    reads,
    read: async (p) => {
      reads.push(p);
      const rows = [];
      for (let i = p * SIZE; i < Math.min(TOTAL, (p + 1) * SIZE); i++) rows.push({ points: pointsAt(i), rank: rankAt(i), eligible: pointsAt(i) >= 1000 });
      return { total: TOTAL, rows };
    },
  };
}

describe('points standing on the public leaderboard', () => {
  it('finds an exact rank by bisection, reading few pages', async () => {
    const b = board();
    const s = await findStanding(20_000 - 2 * 4321, SIZE, b.read);
    expect(s).toMatchObject({ rank: 4322, exact: true, inTopPage: false, total: TOTAL });
    expect(s.topPct).toBeCloseTo(41.16, 1);
    expect(s.pagesRead).toBeLessThanOrEqual(8);
  });
  it('places a score between rows at the rank it would take, marked inexact', async () => {
    const s = await findStanding(20_000 - 2 * 4321 - 1, SIZE, board().read);
    expect(s).toMatchObject({ rank: 4323, exact: false });
  });
  it('shares the tied rank at the tail and reports the bottom honestly', async () => {
    expect(await findStanding(100, SIZE, board().read)).toMatchObject({ rank: 9001, exact: true });
    expect(await findStanding(5, SIZE, board().read)).toMatchObject({ rank: TOTAL, exact: false });
  });
  it('never invents a rank inside the unreadable top page', async () => {
    const s = await findStanding(19_999, SIZE, board().read);
    expect(s).toMatchObject({ rank: null, inTopPage: true, topPct: null });
  });
  it('finds the eligibility floor', async () => {
    expect((await findStanding(5000, SIZE, board().read)).eligibleFrom).toBe(2002);
  });
});
