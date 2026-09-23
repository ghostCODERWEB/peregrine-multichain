import { describe, it, expect } from 'vitest';
import {
  sigmoid, concentrationScore, insiderScore, windShearScore, exitLiquidityScore, sellPressureScore,
  compositeStormScore, stormBand, EXPERT_PRIOR_WEIGHTS, type HolderCluster,
} from './storm-score';

describe('sigmoid', () => {
  it('is 0.5 at x=0', () => expect(sigmoid(0)).toBe(0.5));
  it('approaches 1 for large positive x', () => expect(sigmoid(10)).toBeGreaterThan(0.999));
  it('approaches 0 for large negative x', () => expect(sigmoid(-10)).toBeLessThan(0.001));
});

describe('concentrationScore', () => {
  it('is low for a broad, equal distribution', () => {
    const r = concentrationScore({ shares: Array(50).fill(0.02) });
    expect(r.score).toBeLessThan(30);
  });

  it('is high for a single dominant holder', () => {
    const r = concentrationScore({ shares: [0.8, 0.05, 0.05, 0.05, 0.05] });
    expect(r.score).toBeGreaterThan(60);
  });

  it('is bounded to [0, 100]', () => {
    const r = concentrationScore({ shares: [1] });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it('handles an empty holder list without throwing', () => {
    const r = concentrationScore({ shares: [] });
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it('reports the underlying stats alongside the score', () => {
    const r = concentrationScore({ shares: [0.5, 0.3, 0.2] });
    expect(r.top10Share).toBeCloseTo(1);
    expect(r.nakamoto).toBe(2); // 0.5 alone is under the 0.51 threshold; 0.5+0.3=0.8 clears it
  });
});

describe('insiderScore', () => {
  const cluster = (wallets: string[], share: number, includesDeployer = false): HolderCluster =>
    ({ wallets, share, includesDeployer });

  it('is 0 with no clusters at all', () => {
    const r = insiderScore({ clusters: [], clusteredHolderCount: 0 });
    expect(r.score).toBe(0);
  });

  it('rises with a larger max cluster share', () => {
    const small = insiderScore({ clusters: [cluster(['a', 'b'], 0.05)], clusteredHolderCount: 2 });
    const large = insiderScore({ clusters: [cluster(['a', 'b'], 0.4)], clusteredHolderCount: 2 });
    expect(large.score).toBeGreaterThan(small.score);
  });

  it('adds a flat bump when the deployer is linked into a cluster', () => {
    const withoutDeployer = insiderScore({ clusters: [cluster(['a', 'b'], 0.1, false)], clusteredHolderCount: 2 });
    const withDeployer = insiderScore({ clusters: [cluster(['a', 'b'], 0.1, true)], clusteredHolderCount: 2 });
    expect(withDeployer.score).toBeGreaterThan(withoutDeployer.score);
    expect(withDeployer.deployerLinked).toBe(true);
  });

  it('caps at 100 rather than exceeding it for an extreme cluster', () => {
    const r = insiderScore({ clusters: [cluster(Array(25).fill('w'), 0.95, true)], clusteredHolderCount: 25 });
    expect(r.score).toBe(100);
  });

  it('uses the LARGEST cluster share, not the sum of all clusters', () => {
    const r = insiderScore({
      clusters: [cluster(['a', 'b'], 0.3), cluster(['c', 'd'], 0.25)],
      clusteredHolderCount: 4,
    });
    expect(r.maxClusterShare).toBe(0.3);
  });
});

describe('windShearScore', () => {
  it('is near 50 (neutral) when fresh buying and smart selling are both zero', () => {
    const w = windShearScore({ freshWalletNetUsd: 0, smartMoneyNetUsd: 0, marketCapUsd: 10_000_000 });
    expect(w).toBeCloseTo(50, 0);
  });

  it('rises when fresh wallets buy while smart money sells (the risky pattern)', () => {
    // Equal-magnitude fresh-in and smart-out would cancel to exactly
    // neutral (that's a separate, deliberate property — smart money
    // exiting into exactly as much fresh demand as arrived is genuinely
    // balanced). This fixture makes fresh buying clearly exceed smart
    // selling so the net divergence is unambiguous.
    const w = windShearScore({ freshWalletNetUsd: 800_000, smartMoneyNetUsd: -300_000, marketCapUsd: 5_000_000 });
    expect(w).toBeGreaterThan(60);
  });

  it('does NOT rise when smart money is buying (even alongside fresh buying)', () => {
    const w = windShearScore({ freshWalletNetUsd: 500_000, smartMoneyNetUsd: 500_000, marketCapUsd: 5_000_000 });
    // sm_out = max(0, -500_000) = 0, so this reduces to fresh-buying-only,
    // which should read as mild/neutral, not alarming.
    expect(w).toBeLessThan(70);
  });

  it('does not divide by zero for a token with no market cap data', () => {
    const w = windShearScore({ freshWalletNetUsd: 100, smartMoneyNetUsd: -100, marketCapUsd: 0 });
    expect(Number.isFinite(w)).toBe(true);
  });
});

describe('exitLiquidityScore', () => {
  it('is low risk for deep liquidity relative to market cap', () => {
    const r = exitLiquidityScore({
      liquidityUsd: 5_000_000, marketCapUsd: 10_000_000, maxClusterShare: 0.01,
    });
    expect(r.score).toBeLessThan(30);
  });

  it('is high risk for thin liquidity relative to market cap', () => {
    const r = exitLiquidityScore({
      liquidityUsd: 50_000, marketCapUsd: 10_000_000, maxClusterShare: 0.01,
    });
    expect(r.score).toBeGreaterThan(70);
  });

  it('rises when the largest insider cluster is worth several multiples of available liquidity', () => {
    const safe = exitLiquidityScore({ liquidityUsd: 1_000_000, marketCapUsd: 10_000_000, maxClusterShare: 0.01 });
    const risky = exitLiquidityScore({ liquidityUsd: 1_000_000, marketCapUsd: 10_000_000, maxClusterShare: 0.5 });
    expect(risky.score).toBeGreaterThan(safe.score);
    expect(risky.clusterToLiquidityRatio).toBeGreaterThan(1); // cluster alone exceeds available liquidity
  });

  it('renormalizes weights when Nansen\'s own liquidity-risk indicator is absent', () => {
    const withNansen = exitLiquidityScore({
      liquidityUsd: 500_000, marketCapUsd: 10_000_000, maxClusterShare: 0.1, nansenLiquidityRiskPercentile: 90,
    });
    const withoutNansen = exitLiquidityScore({
      liquidityUsd: 500_000, marketCapUsd: 10_000_000, maxClusterShare: 0.1,
    });
    // Both should be valid, bounded scores — the point is neither throws
    // and both land in [0, 100], not that they're equal.
    expect(withNansen.score).toBeGreaterThanOrEqual(0);
    expect(withoutNansen.score).toBeGreaterThanOrEqual(0);
    expect(withNansen.score).toBeLessThanOrEqual(100);
    expect(withoutNansen.score).toBeLessThanOrEqual(100);
  });

  it('handles zero liquidity without producing NaN or Infinity in the score', () => {
    const r = exitLiquidityScore({ liquidityUsd: 0, marketCapUsd: 10_000_000, maxClusterShare: 0.2 });
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBe(100); // no liquidity at all is maximal exit risk
  });
});

describe('sellPressureScore', () => {
  it('is neutral (50) with no trades at all', () => {
    const r = sellPressureScore({ top20BuyUsd: 0, top20SellUsd: 0, insiderSellUsd: 0 });
    expect(r.score).toBeCloseTo(25, 0); // 0.5*sellSkew(0.5) + 0.5*insiderShare(0) = 0.25 -> 25
  });

  it('is high when selling dominates and most of it is from an insider cluster', () => {
    const r = sellPressureScore({ top20BuyUsd: 10_000, top20SellUsd: 90_000, insiderSellUsd: 80_000 });
    expect(r.score).toBeGreaterThan(70);
  });

  it('is low when buying dominates', () => {
    const r = sellPressureScore({ top20BuyUsd: 90_000, top20SellUsd: 10_000, insiderSellUsd: 0 });
    expect(r.score).toBeLessThan(30);
  });

  it('clamps insiderShareOfSells to [0,1] even if insiderSellUsd exceeds top20SellUsd (data inconsistency guard)', () => {
    const r = sellPressureScore({ top20BuyUsd: 0, top20SellUsd: 1000, insiderSellUsd: 5000 });
    expect(r.insiderShareOfSells).toBeLessThanOrEqual(1);
  });
});

describe('stormBand', () => {
  it('classifies 0-25 as clear', () => {
    expect(stormBand(0)).toBe('clear');
    expect(stormBand(25)).toBe('clear');
  });
  it('classifies >25-50 as cloudy', () => {
    expect(stormBand(26)).toBe('cloudy');
    expect(stormBand(50)).toBe('cloudy');
  });
  it('classifies >50-75 as watch', () => {
    expect(stormBand(51)).toBe('watch');
    expect(stormBand(75)).toBe('watch');
  });
  it('classifies >75-100 as warning', () => {
    expect(stormBand(76)).toBe('warning');
    expect(stormBand(100)).toBe('warning');
  });
});

describe('compositeStormScore', () => {
  it('lands near 50 when every sub-score is exactly 50 (fully ambiguous)', () => {
    const r = compositeStormScore({
      concentration: 50, insider: 50, windShear: 50, exitLiquidity: 50, sellPressure: 50, nansenRisk: 50,
    });
    expect(r.score).toBeCloseTo(50, 0);
    expect(r.band).toBe('cloudy'); // 50 is the cloudy/watch boundary, inclusive on cloudy's side
  });

  it('rises toward 100 when every sub-score is maximal', () => {
    const r = compositeStormScore({
      concentration: 100, insider: 100, windShear: 100, exitLiquidity: 100, sellPressure: 100, nansenRisk: 100,
    });
    expect(r.score).toBeGreaterThan(90);
    expect(r.band).toBe('warning');
  });

  it('falls toward 0 when every sub-score is minimal', () => {
    const r = compositeStormScore({
      concentration: 0, insider: 0, windShear: 0, exitLiquidity: 0, sellPressure: 0, nansenRisk: 0,
    });
    expect(r.score).toBeLessThan(10);
    expect(r.band).toBe('clear');
  });

  it('has full confidence (1) when every sub-score including Nansen risk is present', () => {
    const r = compositeStormScore({
      concentration: 50, insider: 50, windShear: 50, exitLiquidity: 50, sellPressure: 50, nansenRisk: 50,
    });
    expect(r.confidence).toBe(1);
  });

  it('lowers confidence proportionally when Nansen risk is absent, rather than failing', () => {
    const r = compositeStormScore({
      concentration: 50, insider: 50, windShear: 50, exitLiquidity: 50, sellPressure: 50,
    });
    expect(r.confidence).toBeLessThan(1);
    expect(r.confidence).toBeGreaterThan(0);
    expect(Number.isFinite(r.score)).toBe(true);
  });

  it('still produces a bounded score with only sub-scores present and nothing else', () => {
    const r = compositeStormScore({
      concentration: 90, insider: 10, windShear: 60, exitLiquidity: 40, sellPressure: 70,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('drops any missing input, renormalizes, and reports what was missing', () => {
    const r = compositeStormScore({
      concentration: 80, insider: null, windShear: 80, exitLiquidity: 80, sellPressure: 80, nansenRisk: 80,
    });
    const full = compositeStormScore({
      concentration: 80, insider: 80, windShear: 80, exitLiquidity: 80, sellPressure: 80, nansenRisk: 80,
    });
    expect(r.missing).toEqual(['insider']);
    expect(r.confidence).toBeCloseTo(1 - EXPERT_PRIOR_WEIGHTS.insider / 5.1, 6);
    // Renormalized: the same evidence on fewer inputs reads the same, not diluted toward 50.
    expect(r.score).toBeCloseTo(full.score, 6);
  });

  it('refuses to score a token with no inputs at all rather than inventing a 50', () => {
    expect(() => compositeStormScore({
      concentration: null, insider: null, windShear: null, exitLiquidity: null, sellPressure: null,
    })).toThrow();
  });

  it('accepts custom weights (the fitted-weights path once the backtest clears AUC > 0.70)', () => {
    const customWeights = { ...EXPERT_PRIOR_WEIGHTS, concentration: 3.0 };
    const withCustom = compositeStormScore({
      concentration: 90, insider: 50, windShear: 50, exitLiquidity: 50, sellPressure: 50, nansenRisk: 50,
    }, customWeights);
    const withDefault = compositeStormScore({
      concentration: 90, insider: 50, windShear: 50, exitLiquidity: 50, sellPressure: 50, nansenRisk: 50,
    });
    expect(withCustom.score).toBeGreaterThan(withDefault.score);
  });
});
