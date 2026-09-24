import { describe, it, expect } from 'vitest';
import { conviction, topTraderBacking, tokenKey, crowdedExit, holderQuantile, perpTilt, type HoldingLike } from './conviction';

describe('top-trader backing', () => {
  it('counts each leader once per token, keeps the best rank and sums USD', () => {
    const b = topTraderBacking([
      { rank: 3, top5: [{ chain: 'base', tokenAddress: '0xABC', usd: 100 }, { chain: 'base', tokenAddress: '0xabc', usd: 50 }] },
      { rank: 1, top5: [{ chain: 'base', tokenAddress: '0xabc', usd: 10 }, { chain: 'solana', tokenAddress: 'Mint1', usd: 5 }] },
    ]);
    expect(b.get(tokenKey('base', '0xAbC'))).toEqual({ backers: 2, bestRank: 1, usd: 110 });
    expect(b.get(tokenKey('solana', 'Mint1'))!.backers).toBe(1);
    // base58 is case-sensitive
    expect(b.get(tokenKey('solana', 'mint1'))).toBeUndefined();
  });
});

describe('conviction', () => {
  it('is signed by the direction of the balance change', () => {
    expect(conviction(0.05, 0)).toBeGreaterThan(0);
    expect(conviction(-0.05, 0)).toBeLessThan(0);
    expect(conviction(0, 3)).toBe(0);
    expect(conviction(null, 5)).toBeNull();
  });

  it('tops out at ±35 without top-trader backers, and reaches ±100 with five', () => {
    expect(conviction(5, 0)).toBe(35);
    expect(conviction(5, 5)).toBe(100);
    expect(conviction(-5, 9)).toBe(-100);
    expect(conviction(0.05, 5)!).toBeGreaterThan(conviction(0.05, 1)!);
  });
});

describe('crowding', () => {
  const h = (holders: number, change24h: number | null): HoldingLike => ({ chain: 'base', tokenAddress: '0x1', symbol: 'X', valueUsd: 1, change24h, holders });
  it('flags a crowded token the cohort is cutting', () => {
    const list = [h(2, 0), h(4, 0), h(10, 0), h(40, 0), h(152, 0)];
    const at = holderQuantile(list, 0.8);
    expect(at).toBe(152);
    expect(crowdedExit(h(152, -0.03), at)).toBe(true);
    expect(crowdedExit(h(152, -0.01), at)).toBe(false);
    expect(crowdedExit(h(40, -0.5), at)).toBe(false);
    expect(crowdedExit(h(3, -0.5), 2)).toBe(false); // too few holders to call it crowded
  });
});

describe('perp tilt', () => {
  it('nets opens and adds by side, ignores reductions and closes', () => {
    const t = perpTilt([
      { symbol: 'BTC', action: 'Open', side: 'Long', valueUsd: 100 },
      { symbol: 'BTC', action: 'Add', side: 'Short', valueUsd: 30 },
      { symbol: 'BTC', action: 'Close', side: 'Long', valueUsd: 999 },
      { symbol: 'ETH', action: 'Open', side: 'Short', valueUsd: 500 },
      { symbol: 'ETH', action: 'Reduce', side: 'Short', valueUsd: 400 },
    ]);
    expect(t[0]).toEqual({ symbol: 'ETH', longUsd: 0, shortUsd: 500, netUsd: -500, trades: 1 });
    expect(t[1]).toEqual({ symbol: 'BTC', longUsd: 100, shortUsd: 30, netUsd: 70, trades: 2 });
  });

  it('reads the filter enum form too', () => {
    expect(perpTilt([{ symbol: 'SOL', action: 'Buy - Open Long', side: null, valueUsd: 10 }, { symbol: 'SOL', action: 'Sell - Reduce Long', side: null, valueUsd: 99 }])[0].netUsd).toBe(10);
  });
});
