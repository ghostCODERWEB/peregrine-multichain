import { describe, it, expect } from 'vitest';
import {
  matchWalletRotations, frontConfidence, buildDirectedFronts, netFronts,
  type Trade, type RotationMatch, type DirectedFront,
} from './rotation-fronts';

const t = (wallet: string, chain: string, side: 'buy' | 'sell', usdValue: number, timestamp: number): Trade =>
  ({ wallet, chain, side, usdValue, timestamp });

describe('matchWalletRotations', () => {
  it('returns nothing for an empty trade list', () => {
    expect(matchWalletRotations([])).toEqual([]);
  });

  it('matches a sell on one chain to a buy on another within the window', () => {
    const trades = [
      t('w1', 'arbitrum', 'sell', 10_000, 0),
      t('w1', 'base', 'buy', 9_500, 3 * 60 * 60_000), // 3h later
    ];
    const matches = matchWalletRotations(trades);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ wallet: 'w1', fromChain: 'arbitrum', toChain: 'base', usd: 9_500 });
  });

  it('does not match a buy outside the 12h window', () => {
    const trades = [
      t('w1', 'arbitrum', 'sell', 10_000, 0),
      t('w1', 'base', 'buy', 9_500, 13 * 60 * 60_000), // 13h later — too late
    ];
    expect(matchWalletRotations(trades)).toEqual([]);
  });

  it('does not match a buy BEFORE the sell', () => {
    const trades = [
      t('w1', 'arbitrum', 'sell', 10_000, 10 * 60 * 60_000),
      t('w1', 'base', 'buy', 9_500, 0), // earlier — cannot be funded by a later sell
    ];
    expect(matchWalletRotations(trades)).toEqual([]);
  });

  it('does not match a buy and sell on the SAME chain (not a rotation)', () => {
    const trades = [
      t('w1', 'arbitrum', 'sell', 10_000, 0),
      t('w1', 'arbitrum', 'buy', 9_500, 60_000),
    ];
    expect(matchWalletRotations(trades)).toEqual([]);
  });

  it('uses min(sold, bought) as the matched USD, not the larger side', () => {
    const trades = [
      t('w1', 'arbitrum', 'sell', 10_000, 0),
      t('w1', 'base', 'buy', 3_000, 60_000), // only redeployed part of it
    ];
    const matches = matchWalletRotations(trades);
    expect(matches[0].usd).toBe(3_000);
  });

  it('does not let one buy satisfy two different sells (consumed-once)', () => {
    const trades = [
      t('w1', 'arbitrum', 'sell', 10_000, 0),
      t('w1', 'optimism', 'sell', 8_000, 60_000),
      t('w1', 'base', 'buy', 50_000, 2 * 60_000), // one big buy near both sells
    ];
    const matches = matchWalletRotations(trades);
    // Only the earlier sell should claim the buy; the second sell finds no
    // remaining candidate.
    expect(matches).toHaveLength(1);
    expect(matches[0].fromChain).toBe('arbitrum');
  });

  it('keeps different wallets fully independent', () => {
    const trades = [
      t('w1', 'arbitrum', 'sell', 10_000, 0),
      t('w1', 'base', 'buy', 10_000, 60_000),
      t('w2', 'arbitrum', 'sell', 5_000, 0),
      t('w2', 'base', 'buy', 5_000, 60_000),
    ];
    const matches = matchWalletRotations(trades);
    expect(matches).toHaveLength(2);
    expect(new Set(matches.map((m) => m.wallet))).toEqual(new Set(['w1', 'w2']));
  });
});

describe('frontConfidence', () => {
  it('is 0 at zero wallets', () => {
    expect(frontConfidence(0)).toBe(0);
  });

  it('increases monotonically with wallet count', () => {
    expect(frontConfidence(2)).toBeGreaterThan(frontConfidence(1));
    expect(frontConfidence(5)).toBeGreaterThan(frontConfidence(2));
  });

  it('saturates toward but never reaches 1 (mathematically — float64 underflows to exactly 1 well before n=1000)', () => {
    const c = frontConfidence(30);
    expect(c).toBeLessThan(1);
    expect(c).toBeGreaterThan(0.99995);
  });

  it('matches the documented values at small n', () => {
    expect(frontConfidence(2)).toBeCloseTo(1 - Math.exp(-2 / 3), 5);
    expect(frontConfidence(3)).toBeCloseTo(1 - Math.exp(-1), 5);
  });
});

describe('buildDirectedFronts', () => {
  it('filters out a pair with fewer than 2 distinct wallets', () => {
    const matches: RotationMatch[] = [
      { wallet: 'w1', fromChain: 'arbitrum', toChain: 'base', usd: 10_000, sellAt: 0, buyAt: 1000 },
    ];
    expect(buildDirectedFronts(matches)).toEqual([]);
  });

  it('keeps a pair with exactly 2 distinct wallets', () => {
    const matches: RotationMatch[] = [
      { wallet: 'w1', fromChain: 'arbitrum', toChain: 'base', usd: 10_000, sellAt: 0, buyAt: 1000 },
      { wallet: 'w2', fromChain: 'arbitrum', toChain: 'base', usd: 5_000, sellAt: 0, buyAt: 1000 },
    ];
    const fronts = buildDirectedFronts(matches);
    expect(fronts).toHaveLength(1);
    expect(fronts[0].usd).toBe(15_000);
    expect(fronts[0].wallets).toHaveLength(2);
  });

  it('sums repeated matches from the same wallet into one front but counts the wallet once', () => {
    const matches: RotationMatch[] = [
      { wallet: 'w1', fromChain: 'arbitrum', toChain: 'base', usd: 10_000, sellAt: 0, buyAt: 1000 },
      { wallet: 'w1', fromChain: 'arbitrum', toChain: 'base', usd: 2_000, sellAt: 2000, buyAt: 3000 },
      { wallet: 'w2', fromChain: 'arbitrum', toChain: 'base', usd: 5_000, sellAt: 0, buyAt: 1000 },
    ];
    const fronts = buildDirectedFronts(matches);
    expect(fronts[0].usd).toBe(17_000);
    expect(fronts[0].wallets).toHaveLength(2); // w1 once, not twice
  });

  it('marks a front inferred only when every contributing wallet is in the inferred set', () => {
    const matches: RotationMatch[] = [
      { wallet: 'w1', fromChain: 'solana', toChain: 'ethereum', usd: 10_000, sellAt: 0, buyAt: 1000 },
      { wallet: 'w2', fromChain: 'solana', toChain: 'ethereum', usd: 5_000, sellAt: 0, buyAt: 1000 },
    ];
    const allInferred = buildDirectedFronts(matches, new Set(['w1', 'w2']));
    expect(allInferred[0].inferred).toBe(true);

    const mixed = buildDirectedFronts(matches, new Set(['w1'])); // w2 not inferred
    expect(mixed[0].inferred).toBe(false);
  });

  it('keeps opposite-direction fronts separate (A->B and B->A are different pairs)', () => {
    const matches: RotationMatch[] = [
      { wallet: 'w1', fromChain: 'arbitrum', toChain: 'base', usd: 10_000, sellAt: 0, buyAt: 1000 },
      { wallet: 'w2', fromChain: 'arbitrum', toChain: 'base', usd: 5_000, sellAt: 0, buyAt: 1000 },
      { wallet: 'w3', fromChain: 'base', toChain: 'arbitrum', usd: 3_000, sellAt: 0, buyAt: 1000 },
      { wallet: 'w4', fromChain: 'base', toChain: 'arbitrum', usd: 2_000, sellAt: 0, buyAt: 1000 },
    ];
    const fronts = buildDirectedFronts(matches);
    expect(fronts).toHaveLength(2);
  });
});

describe('netFronts', () => {
  const front = (from: string, to: string, usd: number, wallets: string[]): DirectedFront => ({
    from, to, usd, wallets, confidence: frontConfidence(wallets.length), inferred: false,
  });

  it('nets two opposite directed fronts into one arc pointing the heavier way', () => {
    const directed = [
      front('arbitrum', 'base', 100_000, ['w1', 'w2']),
      front('base', 'arbitrum', 30_000, ['w3', 'w4']),
    ];
    const nets = netFronts(directed);
    expect(nets).toHaveLength(1);
    expect(nets[0].netUsd).toBe(70_000);
    expect(nets[0].direction).toEqual({ from: 'arbitrum', to: 'base' });
    expect(nets[0].grossAtoB).toBe(100_000);
    expect(nets[0].grossBtoA).toBe(30_000);
  });

  it('flips direction when B->A is the heavier side', () => {
    const directed = [
      front('arbitrum', 'base', 10_000, ['w1', 'w2']),
      front('base', 'arbitrum', 40_000, ['w3', 'w4']),
    ];
    const nets = netFronts(directed);
    expect(nets[0].netUsd).toBe(-30_000);
    expect(nets[0].direction).toEqual({ from: 'base', to: 'arbitrum' });
  });

  it('still nets correctly with only one direction present (no return flow observed)', () => {
    const directed = [front('arbitrum', 'base', 50_000, ['w1', 'w2'])];
    const nets = netFronts(directed);
    expect(nets).toHaveLength(1);
    expect(nets[0].netUsd).toBe(50_000);
    expect(nets[0].grossBtoA).toBe(0);
  });

  it('returns an empty array for no input', () => {
    expect(netFronts([])).toEqual([]);
  });

  it('handles heavy two-way churn that nearly cancels out as a small net arc', () => {
    const directed = [
      front('arbitrum', 'base', 100_000, ['w1', 'w2']),
      front('base', 'arbitrum', 98_000, ['w3', 'w4']),
    ];
    const nets = netFronts(directed);
    expect(nets[0].netUsd).toBe(2_000);
  });
});
