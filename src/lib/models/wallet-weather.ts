import { addressKey } from '@/lib/address-family';
import { isStablecoin } from './trade-side';

export interface WalletWeatherPosition {
  chain: string;
  tokenAddress: string;
  symbol: string;
  valueUsd: number;
}

export interface WalletWeatherStorm {
  chain: string;
  tokenAddress: string;
  score: number;
  at: number;
}

export interface WalletWeatherActivity {
  /** Realized exits reported by Nansen's 30-day PnL summary. */
  exits: number;
  tradedTokens: number;
}

export type StyleLevel = 'high' | 'moderate' | 'light';
export type WalletStyle = 'trader' | 'holder' | 'mixed';

export type WalletWeatherEnrichment =
  | { kind: 'farmer'; protocols: number; valueUsd: number }
  | { kind: 'perp'; openPositions: number | null; fills30d: number | null; closedTrades30d: number | null };

export function farmerStyle(e: Extract<WalletWeatherEnrichment, { kind: 'farmer' }>, spotUsd: number): StyleLevel {
  if (e.protocols >= 3 || (spotUsd > 0 && e.valueUsd / spotUsd >= .25)) return 'high';
  if (e.protocols > 0 || e.valueUsd > 0) return 'moderate';
  return 'light';
}

export function perpStyle(e: Extract<WalletWeatherEnrichment, { kind: 'perp' }>): StyleLevel | null {
  if ((e.openPositions ?? 0) >= 3 || (e.fills30d ?? 0) >= 20 || (e.closedTrades30d ?? 0) >= 20) return 'high';
  if ((e.openPositions ?? 0) > 0 || (e.fills30d ?? 0) >= 5 || (e.closedTrades30d ?? 0) >= 5) return 'moderate';
  // A partial failure is unknown, not evidence of light perp activity.
  if (e.openPositions == null || e.fills30d == null || e.closedTrades30d == null) return null;
  return 'light';
}

export interface WalletWeatherProfile {
  totalUsd: number;
  positionCount: number;
  effectivePositions: number;
  largestPosition: { symbol: string; chain: string; valueUsd: number; share: number } | null;
  largestChain: { chain: string; valueUsd: number; share: number } | null;
  stableUsd: number;
  stableShare: number | null;
  riskUsd: number;
  storm: {
    score: number | null;
    coveredUsd: number;
    coverage: number | null;
    positions: number;
    freshestAt: number | null;
  };
  style: {
    primary: WalletStyle;
    trader: StyleLevel;
    holder: StyleLevel;
    activity: WalletWeatherActivity;
  };
  headline: string;
  riskState: 'storm' | 'stable' | 'concentrated' | 'distributed' | 'partial' | 'mixed';
}

const finitePositive = (n: number) => Number.isFinite(n) && n > 0;
const positionKey = (p: Pick<WalletWeatherPosition, 'chain' | 'tokenAddress'>) => `${p.chain}:${addressKey(p.tokenAddress)}`;

function levelForTrader(a: WalletWeatherActivity): StyleLevel {
  if (a.exits >= 20 || a.tradedTokens >= 10) return 'high';
  if (a.exits >= 5 || a.tradedTokens >= 3) return 'moderate';
  return 'light';
}

function levelForHolder(a: WalletWeatherActivity, positionCount: number): StyleLevel {
  if (a.exits < 5 && positionCount >= 3) return 'high';
  if ((a.exits < 20 && positionCount >= 2) || a.exits < 5) return 'moderate';
  return 'light';
}

/**
 * A transparent wallet snapshot, not a predictive score. Position and chain
 * concentration are kept separate from Storm severity; missing Storm scores
 * reduce coverage and are never treated as zero risk.
 */
export function walletWeather(
  input: WalletWeatherPosition[],
  activity: WalletWeatherActivity,
  storms: WalletWeatherStorm[],
): WalletWeatherProfile {
  const combined = new Map<string, WalletWeatherPosition>();
  for (const p of input) {
    if (!finitePositive(p.valueUsd)) continue;
    const key = positionKey(p);
    const prev = combined.get(key);
    if (prev) prev.valueUsd += p.valueUsd;
    else combined.set(key, { ...p });
  }
  const positions = [...combined.values()].sort((a, b) => b.valueUsd - a.valueUsd);
  const totalUsd = positions.reduce((sum, p) => sum + p.valueUsd, 0);
  const positionCount = positions.length;
  const effectivePositions = totalUsd
    ? 1 / positions.reduce((sum, p) => sum + (p.valueUsd / totalUsd) ** 2, 0)
    : 0;

  const largest = positions[0] ?? null;
  const largestPosition = largest && totalUsd
    ? { symbol: largest.symbol, chain: largest.chain, valueUsd: largest.valueUsd, share: largest.valueUsd / totalUsd }
    : null;

  const byChain = new Map<string, number>();
  for (const p of positions) byChain.set(p.chain, (byChain.get(p.chain) ?? 0) + p.valueUsd);
  const largestChainRow = [...byChain.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const largestChain = largestChainRow && totalUsd
    ? { chain: largestChainRow[0], valueUsd: largestChainRow[1], share: largestChainRow[1] / totalUsd }
    : null;

  const stableUsd = positions.filter((p) => isStablecoin(p.symbol)).reduce((sum, p) => sum + p.valueUsd, 0);
  const riskPositions = positions.filter((p) => !isStablecoin(p.symbol));
  const riskUsd = riskPositions.reduce((sum, p) => sum + p.valueUsd, 0);

  // If a caller supplied more than one observation, keep the newest. The
  // server normally pre-filters these to fresh, sufficiently confident rows.
  const stormByPosition = new Map<string, WalletWeatherStorm>();
  for (const s of storms) {
    if (!Number.isFinite(s.score) || s.score < 0 || s.score > 100 || !Number.isFinite(s.at)) continue;
    const key = `${s.chain}:${addressKey(s.tokenAddress)}`;
    if (!stormByPosition.has(key) || stormByPosition.get(key)!.at < s.at) stormByPosition.set(key, s);
  }
  const modeled = riskPositions.flatMap((p) => {
    const s = stormByPosition.get(positionKey(p));
    return s ? [{ position: p, storm: s }] : [];
  });
  const coveredUsd = modeled.reduce((sum, row) => sum + row.position.valueUsd, 0);
  const stormScore = coveredUsd
    ? modeled.reduce((sum, row) => sum + row.position.valueUsd * row.storm.score, 0) / coveredUsd
    : null;
  const stormCoverage = riskUsd ? coveredUsd / riskUsd : null;

  const safeActivity = {
    exits: Math.max(0, Math.round(Number.isFinite(activity.exits) ? activity.exits : 0)),
    tradedTokens: Math.max(0, Math.round(Number.isFinite(activity.tradedTokens) ? activity.tradedTokens : 0)),
  };
  const trader = levelForTrader(safeActivity);
  const holder = levelForHolder(safeActivity, positionCount);
  const primary: WalletStyle = trader === 'high' || (trader === 'moderate' && holder === 'light')
    ? 'trader'
    : holder === 'high' || (holder === 'moderate' && trader === 'light')
      ? 'holder'
      : 'mixed';

  const stableShare = totalUsd ? stableUsd / totalUsd : null;
  let headline = 'Mixed spot risk';
  let riskState: WalletWeatherProfile['riskState'] = 'mixed';
  if (stormScore != null && (stormCoverage ?? 0) >= .5 && stormScore >= 65) {
    headline = 'High Storm exposure across scored risk assets'; riskState = 'storm';
  } else if ((stableShare ?? 0) >= .6) {
    headline = 'Stable-heavy spot balance'; riskState = 'stable';
  } else if ((largestPosition?.share ?? 0) >= .65) {
    headline = `Concentrated in ${largestPosition!.symbol}`; riskState = 'concentrated';
  } else if (riskUsd > 0 && (stormCoverage ?? 0) < .5) {
    headline = 'Mixed balance with limited Storm coverage'; riskState = 'partial';
  } else if ((largestPosition?.share ?? 1) < .4 && effectivePositions >= 4) {
    headline = 'Broadly distributed spot balance'; riskState = 'distributed';
  }

  return {
    totalUsd, positionCount, effectivePositions, largestPosition, largestChain,
    stableUsd, stableShare, riskUsd,
    storm: {
      score: stormScore, coveredUsd, coverage: stormCoverage, positions: modeled.length,
      freshestAt: modeled.length ? Math.max(...modeled.map((row) => row.storm.at)) : null,
    },
    style: { primary, trader, holder, activity: safeActivity },
    headline, riskState,
  };
}
