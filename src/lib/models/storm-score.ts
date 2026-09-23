// Storm Score, section 5.3: token dump risk, 0-100. Five sub-scores — each
// independently 0-100 and independently inspectable via the UI's ⓘ
// popover — combined into one composite. The spec fixes the exact formula
// for Concentration (C) and Insider clusters (I); Wind shear (W), Exit
// liquidity (L) and Sell pressure (P) are specified by their INPUTS and
// intent but not exact combining weights, so those are implemented as
// clearly-labelled expert priors, replaceable by fitted weights once the
// backtest (5.5) clears AUC > 0.70 — same rule the composite itself follows.
import { normalizedHhi, gini, topNShare, nakamotoCoefficient } from './holder-stats';

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

// --------------------------------------------------------------------------
// Concentration (C)
// --------------------------------------------------------------------------

export interface ConcentrationInputs {
  /** Fractional shares (0-1) of real holders only — exchange, bridge and
   *  contract labels already excluded by the caller. */
  shares: number[];
}

export interface ConcentrationResult {
  score: number;
  hhiN: number;
  giniCoefficient: number;
  top10Share: number;
  nakamoto: number;
}

/** C = 100·(0.35·HHI_n + 0.25·Gini + 0.25·T10 + 0.15·(1 − min(K,20)/20)),
 *  fixed weights per spec. The Nakamoto term is inverted (1 - K/20) because
 *  a LOW Nakamoto coefficient (few holders needed to move the market) is
 *  the risky direction, capped at K=20 so a token needing 50 holders to
 *  reach majority doesn't read as materially safer than one needing 20 —
 *  past that point holder count stops being the binding constraint on risk. */
export function concentrationScore(input: ConcentrationInputs): ConcentrationResult {
  const { shares } = input;
  const hhiN = normalizedHhi(shares);
  const giniCoefficient = gini(shares);
  const top10Share = topNShare(shares, 10);
  const nakamoto = nakamotoCoefficient(shares, 0.51);
  const nakamotoTerm = 1 - Math.min(nakamoto, 20) / 20;
  const score = 100 * (0.35 * hhiN + 0.25 * giniCoefficient + 0.25 * top10Share + 0.15 * nakamotoTerm);
  return { score: clamp(score, 0, 100), hhiN, giniCoefficient, top10Share, nakamoto };
}

// --------------------------------------------------------------------------
// Insider clusters (I)
// --------------------------------------------------------------------------

export interface HolderCluster {
  /** Wallet addresses in this cluster (linked by shared first-funder or
   *  related-wallets), among the top 25 holders considered. */
  wallets: string[];
  /** Combined fractional share (0-1) of supply held across the cluster. */
  share: number;
  /** True if the token's own deployer address is a member. */
  includesDeployer: boolean;
}

export interface InsiderInputs {
  /** Pre-computed clusters over the top 25 holders (union-find over shared
   *  first-funder / related-wallets is graph work done by the caller —
   *  see src/lib/models/wallet-clustering.ts — this function only scores
   *  the resulting clusters). */
  clusters: HolderCluster[];
  /** How many of the top 25 holders ended up in a cluster of size >= 2
   *  (singletons don't count as "clustered"). */
  clusteredHolderCount: number;
}

export interface InsiderResult {
  score: number;
  maxClusterShare: number;
  deployerLinked: boolean;
}

/** I = 100·min(1, 1.6·max_cluster_share + 0.02·n_clustered + 0.15·deployer_linked). */
export function insiderScore(input: InsiderInputs): InsiderResult {
  const maxClusterShare = input.clusters.reduce((max, c) => Math.max(max, c.share), 0);
  const deployerLinked = input.clusters.some((c) => c.includesDeployer);
  const raw = 1.6 * maxClusterShare + 0.02 * input.clusteredHolderCount + 0.15 * (deployerLinked ? 1 : 0);
  return { score: 100 * Math.min(1, raw), maxClusterShare, deployerLinked };
}

// --------------------------------------------------------------------------
// Wind shear (W)
// --------------------------------------------------------------------------

export interface WindShearInputs {
  /** Fresh-wallet net flow USD, this window (positive = buying in). */
  freshWalletNetUsd: number;
  /** Smart-trader + top-PnL net flow USD, this window (negative when
   *  selling — this function reads "selling" from the sign, it does not
   *  assume the caller pre-flipped it). */
  smartMoneyNetUsd: number;
  marketCapUsd: number;
}

/** k controls how much (fresh_in - sm_out)/mcap has to move to swing the
 *  score — an expert prior (spec gives the shape, not the constant).
 *  k=8 makes a shift of 12.5% of market cap (a large, unambiguous
 *  divergence) move the sigmoid from center to its ~95% tail, while a 1-2%
 *  shift (noise-level on most tokens) stays near the middle. */
const WIND_SHEAR_K = 8;

/** W = 100·sigmoid(k·(fresh_in − sm_out)/mcap). Risky when informed money
 *  (smart traders, top PnL) is net selling WHILE uninformed fresh wallets
 *  are net buying — the classic distribution-into-retail pattern. */
export function windShearScore(input: WindShearInputs): number {
  const { freshWalletNetUsd, smartMoneyNetUsd, marketCapUsd } = input;
  const smOut = Math.max(0, -smartMoneyNetUsd); // only the selling side counts as shear
  const freshIn = Math.max(0, freshWalletNetUsd); // only the buying side counts
  const mcap = Math.max(marketCapUsd, 1); // guard against div-by-zero on a token with no mcap data
  return 100 * sigmoid(WIND_SHEAR_K * (freshIn - smOut) / mcap);
}

// --------------------------------------------------------------------------
// Exit liquidity (L)
// --------------------------------------------------------------------------

export interface ExitLiquidityInputs {
  liquidityUsd: number;
  marketCapUsd: number;
  /** Nansen's own liquidity-risk indicator, as a percentile 0-100 (higher =
   *  riskier per Nansen's own scoring) from tgm/indicators. Optional —
   *  dropped with weight renormalization when Nansen hasn't scored this
   *  token, per the capability registry's graceful-degradation rule. */
  nansenLiquidityRiskPercentile?: number;
  /** The largest insider cluster's fractional share of supply (0-1), from
   *  the insider sub-model — reused here rather than recomputed. */
  maxClusterShare: number;
}

export interface ExitLiquidityResult {
  score: number;
  liquidityToMcap: number;
  /** How many multiples of available liquidity the largest insider cluster
   *  alone represents — >1 means that cluster literally cannot exit at
   *  anything near current price. */
  clusterToLiquidityRatio: number;
}

/**
 * Three components, each independently informative about how exit-able the
 * token is, weighted and combined into 0-100:
 *  - thin liquidity relative to market cap (low liquidity/mcap = risky)
 *  - Nansen's own liquidity-risk read, when available
 *  - the largest insider cluster's position sized against real liquidity
 * Weights (0.4 / 0.3 / 0.3, renormalized if Nansen's indicator is absent)
 * are an expert prior — the spec specifies the three inputs, not the split.
 */
export function exitLiquidityScore(input: ExitLiquidityInputs): ExitLiquidityResult {
  const liquidityToMcap = input.liquidityUsd > 0 ? input.liquidityUsd / Math.max(input.marketCapUsd, 1) : 0;
  // Inverted and squashed: liquidity/mcap of 0.3+ is healthy (score -> 0),
  // under 0.02 is thin (score -> close to 100).
  const liquidityRisk = 100 * clamp(1 - liquidityToMcap / 0.3, 0, 1);

  const clusterToLiquidityRatio = input.liquidityUsd > 0
    ? (input.maxClusterShare * input.marketCapUsd) / input.liquidityUsd
    : input.maxClusterShare > 0 ? Infinity : 0;
  const clusterRisk = 100 * clamp(clusterToLiquidityRatio, 0, 1);

  const parts: Array<{ weight: number; value: number }> = [
    { weight: 0.4, value: liquidityRisk },
    { weight: 0.3, value: clusterRisk },
  ];
  if (input.nansenLiquidityRiskPercentile != null) {
    parts.push({ weight: 0.3, value: clamp(input.nansenLiquidityRiskPercentile, 0, 100) });
  }
  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const score = parts.reduce((s, p) => s + p.weight * p.value, 0) / totalWeight;

  return { score: clamp(score, 0, 100), liquidityToMcap, clusterToLiquidityRatio };
}

// --------------------------------------------------------------------------
// Sell pressure (P)
// --------------------------------------------------------------------------

export interface SellPressureInputs {
  /** Top 20 trades by size from who-bought-sold, this window. */
  top20BuyUsd: number;
  top20SellUsd: number;
  /** Of the top 20 sell volume, how much came from wallets in an insider
   *  cluster (from the insider sub-model). */
  insiderSellUsd: number;
}

export interface SellPressureResult {
  score: number;
  sellSkew: number;
  insiderShareOfSells: number;
}

/** P blends two components equally: raw sell-side skew among the biggest
 *  trades, and how much of that selling specifically traces to a clustered
 *  insider (the same $ of selling means something different coming from a
 *  labelled insider cluster than from 20 independent traders). */
export function sellPressureScore(input: SellPressureInputs): SellPressureResult {
  const total = input.top20BuyUsd + input.top20SellUsd;
  const sellSkew = total > 0 ? input.top20SellUsd / total : 0.5; // no trades = no skew either way
  const insiderShareOfSells = input.top20SellUsd > 0 ? clamp(input.insiderSellUsd / input.top20SellUsd, 0, 1) : 0;
  const score = 100 * (0.5 * sellSkew + 0.5 * insiderShareOfSells);
  return { score: clamp(score, 0, 100), sellSkew, insiderShareOfSells };
}

// --------------------------------------------------------------------------
// Composite
// --------------------------------------------------------------------------

/** Every sub-score is 0-100, or null when Nansen had nothing to compute it
 *  from on this token (insider clusters need EVM first-funder data, Nansen's
 *  risk indicators don't cover every token, and so on). */
export interface StormSubScores {
  concentration: number | null;
  insider: number | null;
  windShear: number | null;
  exitLiquidity: number | null;
  sellPressure: number | null;
  /** Nansen's own risk indicators (tgm/indicators), 0-100, when available. */
  nansenRisk?: number | null;
}

export type StormInput = keyof StormSubScores;
export const STORM_INPUTS: StormInput[] = ['concentration', 'insider', 'windShear', 'exitLiquidity', 'sellPressure', 'nansenRisk'];

/**
 * Expert-prior weights on the composite logistic, β = [C, I, W, L, P, risk].
 * Each sub-score is already 0-100, so `(score - 50) / 25` maps it onto a
 * roughly [-2, 2] "z-like" scale before the weighted sum — an ad hoc
 * standardization, not a fitted z-score against real history, because that
 * history doesn't exist yet; the backtest (5.5) replaces both these weights
 * and this standardization with fitted ones once it clears AUC > 0.70.
 * Intercept 0 centers a token with every sub-score at exactly 50 (perfectly
 * ambiguous) at Storm = 50.
 */
export interface StormWeights {
  intercept: number;
  concentration: number;
  insider: number;
  windShear: number;
  exitLiquidity: number;
  sellPressure: number;
  nansenRisk: number;
}

export const EXPERT_PRIOR_WEIGHTS: StormWeights = {
  intercept: 0,
  concentration: 0.9,
  insider: 1.1,
  windShear: 0.7,
  exitLiquidity: 1.0,
  sellPressure: 0.8,
  nansenRisk: 0.6,
};

export interface StormScoreResult {
  score: number;
  band: 'clear' | 'cloudy' | 'watch' | 'warning';
  /** 0-1: the share of total prior weight whose inputs were present. A
   *  token scored without insider data leans on fewer independent signals
   *  for the same claim, and says so. */
  confidence: number;
  subScores: StormSubScores;
  /** Inputs dropped for lack of Nansen data. */
  missing: StormInput[];
}

const BAND_THRESHOLDS: Array<{ max: number; band: StormScoreResult['band'] }> = [
  { max: 25, band: 'clear' },
  { max: 50, band: 'cloudy' },
  { max: 75, band: 'watch' },
  { max: 100, band: 'warning' },
];

export function stormBand(score: number): StormScoreResult['band'] {
  return BAND_THRESHOLDS.find((b) => score <= b.max)?.band ?? 'warning';
}

/**
 * Storm = 100·sigmoid(β₀ + Σ β_j·z_j). Missing inputs are dropped and the
 * remaining weights scaled back up to the full total, so a token missing
 * one signal still spans the same 0-100 range instead of being pulled
 * toward 50; the confidence then drops by the missing weight's share.
 */
export function compositeStormScore(
  subScores: StormSubScores,
  weights: StormWeights = EXPERT_PRIOR_WEIGHTS,
): StormScoreResult {
  const standardize = (v: number) => (v - 50) / 25;
  const totalWeight = STORM_INPUTS.reduce((s, k) => s + weights[k], 0);
  const present = STORM_INPUTS.filter((k) => {
    const v = subScores[k];
    return v != null && Number.isFinite(v);
  });
  if (!present.length) throw new Error('compositeStormScore needs at least one sub-score');
  const presentWeight = present.reduce((s, k) => s + weights[k], 0);
  const scale = totalWeight / presentWeight;

  const linear = weights.intercept + present.reduce((s, k) => s + scale * weights[k] * standardize(subScores[k] as number), 0);
  const score = 100 * sigmoid(linear);
  return {
    score,
    band: stormBand(score),
    confidence: presentWeight / totalWeight,
    subScores,
    missing: STORM_INPUTS.filter((k) => !present.includes(k)),
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
