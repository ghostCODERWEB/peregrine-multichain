// Chain Pressure Index (CPI), 0-100. Section 5.1.
//
// The core idea: a chain's smart-money net flow only means something
// relative to how much volume that chain normally moves and how unusual
// today's ratio is against the chain's own recent history. $10M net inflow
// is huge on a $50M-volume chain and noise on a $2B-volume one, so the raw
// ratio r = netFlow / volume is z-scored against trailing history before
// being squashed into a 0-100 pressure reading.
//
// Every input here is a plain number, not a Nansen response — see
// src/server/nansen/models/cpi-inputs.ts (later) for the code that turns a
// smart-money/netflows + token-screener response pair into these numbers.
// Keeping the formula itself free of any Nansen-shaped type means it can be
// unit tested against plain fixtures with no network, no schema, no mocks.

export type Window = '1h' | '24h' | '7d';

export interface WindowInput {
  /** Σ smart money net flow USD across tokens on this chain, this window. */
  netFlowUsd: number;
  /** Σ volume USD on this chain, this window (from the screener). */
  volumeUsd: number;
}

/** Below this, volume is too thin for netFlow/volume to mean anything —
 *  a $500 net flow on $50 of volume is a 10x ratio that says nothing. */
const VOLUME_FLOOR_USD = 10_000;

export function flowRatio(input: WindowInput): number {
  return input.netFlowUsd / Math.max(input.volumeUsd, VOLUME_FLOOR_USD);
}

/**
 * Robust z-score: (x - median) / (1.4826 * MAD), the constant scaling MAD
 * to be comparable to a standard deviation under normality. Robust to the
 * occasional huge whale trade that would blow out a mean/stdev z-score.
 * Returns 0 when the sample has no spread (MAD = 0) rather than dividing by
 * zero into +/-Infinity — a chain whose ratio never moves has no pressure
 * signal to report, not an extreme one.
 */
export function robustZScore(x: number, sample: number[]): number {
  if (sample.length === 0) return 0;
  const sorted = [...sample].sort((a, b) => a - b);
  const median = percentile(sorted, 0.5);
  const deviations = sorted.map((v) => Math.abs(v - median));
  const mad = percentile([...deviations].sort((a, b) => a - b), 0.5);
  if (mad === 0) return 0;
  return (x - median) / (1.4826 * mad);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** 50 +/- 50*tanh(z/2): centred at 50 (no signal), saturates toward 0/100
 *  rather than diverging, so one extreme outlier chain can't blow the scale
 *  for every other chain sharing it. */
export function pressureFromZ(z: number): number {
  return 50 + 50 * Math.tanh(z / 2);
}

export interface CpiWindowResult {
  window: Window;
  ratio: number;
  z: number;
  cpi: number;
  /** True when z came from cross-sectional comparison (peer chains, same
   *  moment) rather than this chain's own trailing history, because the
   *  scanner hasn't accumulated 7 days of snapshots for it yet. A CPI
   *  computed this way is still a real number but a materially different
   *  claim — "unusual versus peers right now" instead of "unusual for this
   *  chain" — and callers should say so rather than presenting them
   *  identically. */
  usedCrossSectional: boolean;
}

/**
 * CPI for one chain, one window. `history` is this chain's own trailing
 * ratio values (e.g. the last 7 days of 15-minute snapshots); when empty
 * (a new chain, or day 1 before the scanner has built history), pass the
 * peer chains' CURRENT ratios instead via `crossSectional` and this falls
 * back to comparing this chain against its peers at this moment rather than
 * against itself over time.
 */
export function chainPressureWindow(
  input: WindowInput,
  window: Window,
  history: number[],
  crossSectional: number[] = [],
): CpiWindowResult {
  const ratio = flowRatio(input);
  const usedCrossSectional = history.length === 0;
  const sample = usedCrossSectional ? crossSectional : history;
  const z = robustZScore(ratio, sample);
  return { window, ratio, z, cpi: pressureFromZ(z), usedCrossSectional };
}

const WINDOW_WEIGHTS: Record<Window, number> = { '1h': 0.2, '24h': 0.5, '7d': 0.3 };

export interface CpiBlendResult {
  cpi: number;
  byWindow: Record<Window, CpiWindowResult>;
  /** True if ANY window fell back to cross-sectional scoring — the blended
   *  number is still meaningful but should be shown with lower confidence. */
  anyCrossSectional: boolean;
}

/** Blends the three windows: CPI = 0.2*CPI_1h + 0.5*CPI_24h + 0.3*CPI_7d.
 *  A window missing its input entirely (Tier B/C chains sometimes lack one)
 *  is dropped and the remaining weights renormalized, per the capability
 *  registry's graceful-degradation rule (section 3). */
export function blendChainPressure(
  byWindow: Partial<Record<Window, CpiWindowResult>>,
): CpiBlendResult {
  const present = (Object.keys(WINDOW_WEIGHTS) as Window[]).filter((w) => byWindow[w] !== undefined);
  if (present.length === 0) {
    throw new Error('blendChainPressure: no windows present — cannot compute a CPI with zero inputs');
  }
  const totalWeight = present.reduce((sum, w) => sum + WINDOW_WEIGHTS[w], 0);
  const cpi = present.reduce((sum, w) => sum + WINDOW_WEIGHTS[w] * byWindow[w]!.cpi, 0) / totalWeight;
  const full = Object.fromEntries(present.map((w) => [w, byWindow[w]!])) as Record<Window, CpiWindowResult>;
  return {
    cpi,
    byWindow: full,
    anyCrossSectional: present.some((w) => byWindow[w]!.usedCrossSectional),
  };
}

export type PressureBand = 'high' | 'neutral' | 'low';

/** Above 65 is high pressure (inflow), below 35 low pressure (outflow). */
export function pressureBand(cpi: number): PressureBand {
  if (cpi > 65) return 'high';
  if (cpi < 35) return 'low';
  return 'neutral';
}
