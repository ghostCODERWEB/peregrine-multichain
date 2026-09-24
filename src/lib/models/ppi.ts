// Perp Pressure Index (PPI), 0–100 per Hyperliquid coin, built like the
// Chain Pressure Index: each input is a robust z-score against the coin's
// own hourly history (cross-sectional against the other coins until twelve
// snapshots exist), the z-scores are blended with printed weights, and the
// blend is squashed with the same 50 ± 50·tanh(z/2).
//
//   taker   = (buy − sell volume) ÷ max(volume, $50K)       all traders, 24h
//   funding = hourly funding rate                          longs paying = +
//   sm skew = (SM longs − SM shorts) ÷ (SM longs + SM shorts)   key owner only
//
// Above 65: long pressure (buyers lifting, longs paying up, smart money net
// long). Below 35: short pressure. A reading, not a forecast.
import { robustZScore, pressureFromZ } from './cpi';

export interface PerpInput {
  volume: number | null;
  buyVolume: number | null;
  sellVolume: number | null;
  funding: number | null;
  /** Smart money's open longs and shorts, USD (shorts as a positive size). */
  smLongsUsd?: number | null;
  smShortsUsd?: number | null;
}

export const TAKER_VOLUME_FLOOR = 50_000;
export const SM_BOOK_FLOOR = 100_000;
export const MIN_HISTORY = 12;

export function takerRatio(x: PerpInput): number | null {
  if (x.buyVolume == null || x.sellVolume == null) return null;
  const v = Math.max(x.volume ?? x.buyVolume + x.sellVolume, TAKER_VOLUME_FLOOR);
  return (x.buyVolume - x.sellVolume) / v;
}

/** −1 (all short) … +1 (all long); null when smart money's book is too small to mean anything. */
export function smSkew(x: PerpInput): number | null {
  const l = Math.abs(x.smLongsUsd ?? 0), s = Math.abs(x.smShortsUsd ?? 0);
  if (x.smLongsUsd == null && x.smShortsUsd == null) return null;
  if (l + s < SM_BOOK_FLOOR) return null;
  return (l - s) / (l + s);
}

export const PUBLIC_WEIGHTS = { taker: 0.65, funding: 0.35, sm: 0 } as const;
export const PRIVATE_WEIGHTS = { taker: 0.4, funding: 0.2, sm: 0.4 } as const;
export type PpiPart = 'taker' | 'funding' | 'sm';

export interface PpiResult {
  ppi: number;
  z: number;
  parts: Partial<Record<PpiPart, { raw: number; z: number; weight: number }>>;
  usedCrossSectional: boolean;
}

/**
 * One coin, one snapshot. `history` holds this coin's own earlier raw values
 * per part; when any part has fewer than 12, every part is scored against
 * `peers` (the other coins' current values) instead, so the blend never
 * mixes two different claims.
 */
export function perpPressure(
  now: Partial<Record<PpiPart, number | null>>,
  history: Partial<Record<PpiPart, number[]>>,
  peers: Partial<Record<PpiPart, number[]>>,
  weights: Record<PpiPart, number>,
): PpiResult | null {
  const present = (Object.keys(weights) as PpiPart[]).filter((k) => weights[k] > 0 && now[k] != null && Number.isFinite(now[k]!));
  if (!present.length) return null;
  const usedCrossSectional = present.some((k) => (history[k]?.length ?? 0) < MIN_HISTORY);
  const parts: PpiResult['parts'] = {};
  let zSum = 0, wSum = 0;
  for (const k of present) {
    const sample = usedCrossSectional ? (peers[k] ?? []) : history[k]!;
    const z = Math.max(-6, Math.min(6, robustZScore(now[k]!, sample)));
    parts[k] = { raw: now[k]!, z, weight: weights[k] };
    zSum += weights[k] * z;
    wSum += weights[k];
  }
  const z = zSum / wSum;
  return { ppi: pressureFromZ(z), z, parts, usedCrossSectional };
}

/** The venue's reading: open-interest-weighted mean of its coins' PPI. */
export function venuePressure(coins: Array<{ ppi: number; openInterest: number | null }>): number | null {
  let w = 0, s = 0;
  for (const c of coins) {
    const oi = c.openInterest ?? 0;
    if (!(oi > 0) || !Number.isFinite(c.ppi)) continue;
    w += oi; s += oi * c.ppi;
  }
  return w > 0 ? s / w : null;
}

/** Hourly funding → annualized, as Nansen's app and Hyperliquid show it. */
export const annualFunding = (hourly: number) => hourly * 24 * 365;

/**
 * Crowding against smart money: the crowd pays up to be long (funding in
 * the top of its range) while smart money is net short, or the reverse.
 */
export function crowdingDivergence(fundingZ: number | undefined, skew: number | null): 'crowded-long' | 'crowded-short' | null {
  if (fundingZ == null || skew == null) return null;
  if (fundingZ >= 1.5 && skew <= -0.2) return 'crowded-long';
  if (fundingZ <= -1.5 && skew >= 0.2) return 'crowded-short';
  return null;
}
