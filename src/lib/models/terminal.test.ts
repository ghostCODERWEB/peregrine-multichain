import { describe, it, expect } from 'vitest';
import { classifyCohort, judgeTransfers, socialHeat, dcaOverhang, positionGauge, ANOMALY_Z, MIN_COHORT, type TransferLike } from './terminal';

describe('cohorts from Nansen labels (real label strings)', () => {
  it.each([
    ['🏦 Gate: Wallet [0x0d0707]', 'exchange'],
    ['​​🤖 🏦 Aerodrome: AERO - CBBTC Liquidity Pool [0xcdbe19]', 'contract'],
    ['🤖 Top 100 on ABASWETH Leaderboard [0x3df8d6]', 'contract'],
    ['🔧 Former Smart Trader [0xf20431]', 'smart'],
    ['Token Millionaire [0xb46ddd]', 'whale'],
    ['High Activity [0xf726c6]', 'labelled'],
    ['🤖 🏦 Binance: Hot Wallet [0x28c6c0]', 'exchange'], // exchange hot wallets carry both marks
    ['🤖 Concentrated Liquidity Vault [0x2192bc]', 'contract'],
    [null, 'unlabelled'],
  ])('%s → %s', (label, cohort) => expect(classifyCohort(label)).toBe(cohort));
});

describe('transfer anomalies (candidates judged against an unbiased baseline)', () => {
  const routine = (cohort: TransferLike['cohort'], base: number, n = 12): TransferLike[] =>
    Array.from({ length: n }, (_, i) => ({ valueUsd: base * (1 + (i % 4) * 0.3), cohort }));
  const baseline = [...routine('exchange', 1_000_000), ...routine('unlabelled', 5_000)];

  it('flags a move far above its own cohort, not a routine big exchange shuffle', () => {
    const candidates: TransferLike[] = [
      { valueUsd: 1_500_000, cohort: 'exchange' }, // routine for an exchange
      { valueUsd: 900_000, cohort: 'unlabelled' }, // not routine for an ordinary wallet
    ];
    const { z } = judgeTransfers(baseline, candidates, true);
    expect(z[0]).toBeLessThan(ANOMALY_Z);
    expect(z[1]).toBeGreaterThanOrEqual(ANOMALY_Z);
  });

  it('public view (no cohorts): one baseline for everything', () => {
    const { z, cohortSizes } = judgeTransfers(routine('unlabelled', 5_000), [{ valueUsd: 2_000_000, cohort: 'unlabelled' }], false);
    expect(cohortSizes).toEqual({ all: 12 });
    expect(z[0]).toBeGreaterThanOrEqual(ANOMALY_Z);
  });

  it('says nothing when the sender\u2019s cohort has too few baseline transfers', () => {
    const { z } = judgeTransfers(routine('smart', 100, MIN_COHORT - 1), [{ valueUsd: 1e9, cohort: 'smart' }, { valueUsd: null, cohort: 'smart' }], true);
    expect(z).toEqual([null, null]);
  });
});

describe('social heat', () => {
  const now = Date.parse('2026-09-24T00:00:00Z');
  const h = (hoursAgo: number, views: number) => ({ at: now - hoursAgo * 3_600_000, views, likes: 0 });

  it('rises with an accelerating conversation and sits near the middle when steady', () => {
    const steady = socialHeat(Array.from({ length: 14 }, (_, i) => h(i * 12, 1_000)), now);
    const spiking = socialHeat([...Array.from({ length: 10 }, (_, i) => h(60 + i * 10, 200)), ...Array.from({ length: 10 }, (_, i) => h(i * 4, 20_000))], now);
    expect(spiking.acceleration).toBeGreaterThan(10);
    expect(spiking.score).toBeGreaterThan(steady.score);
    expect(steady.acceleration).toBeGreaterThan(0.5);
    expect(steady.acceleration).toBeLessThan(2);
  });

  it('does not read a handful of posts as a hot conversation', () => {
    // Real AERO case: 5 posts, one of them 7k views, 6.6× "acceleration".
    const few = socialHeat([h(10, 6966), h(20, 0), h(90, 30), h(100, 10), h(120, 5)], now);
    expect(few.acceleration).toBeGreaterThan(5);
    expect(few.score).toBeLessThan(65);
  });

  it('is 0 with no posts, and groups posts by day', () => {
    expect(socialHeat([], now).score).toBe(0);
    expect(socialHeat([h(1, 10), h(2, 10), h(30, 5)], now).byDay).toEqual([{ day: '2026-09-22', posts: 1, views: 5 }, { day: '2026-09-23', posts: 2, views: 20 }]);
  });
});

describe('DCA overhang', () => {
  it('weighs the unspent part of active sell ladders against buy ladders and daily volume', () => {
    const o = dcaOverhang([
      { active: true, side: 'sell', depositUsd: 10_000, depositAmount: 100, depositSpent: 50 }, // $5K left to sell
      { active: true, side: 'buy', depositUsd: 2_000, depositAmount: 10, depositSpent: 0 }, // $2K left to buy
      { active: false, side: 'sell', depositUsd: 99_999, depositAmount: 1, depositSpent: 0 }, // closed: ignored
    ], 100_000)!;
    expect(o.sellRemainingUsd).toBe(5_000);
    expect(o.buyRemainingUsd).toBe(2_000);
    expect(o.ratio).toBeCloseTo(0.03);
    expect(o.score).toBeGreaterThan(50);
    expect(dcaOverhang([], 100_000)!.score).toBe(50);
    expect(dcaOverhang([], null)).toBeNull();
  });
});

describe('position tide gauge', () => {
  it('long share per cohort from a real position-intelligence row', () => {
    const g = positionGauge({ smart_trader_longs_usd: 3947434.9, smart_trader_shorts_usd: 1955708.7, whale_longs_usd: 7556102.6, whale_shorts_usd: 9970876.6, public_figure_longs_usd: 0, public_figure_shorts_usd: 0 });
    expect(g[0].longShare).toBeCloseTo(0.669, 3);
    expect(g[1].longShare).toBeCloseTo(0.431, 3);
    expect(g[2].longShare).toBeNull();
  });
});
