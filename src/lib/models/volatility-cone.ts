// Volatility cone, section 5.4: EWMA volatility from OHLCV log returns,
// projected forward as a price cone. λ=0.94 (RiskMetrics' standard daily
// decay factor) weights recent returns more heavily than old ones without
// a hard lookback window cutting off at an arbitrary day.

/** Natural log returns from a close-price series: r_t = ln(P_t / P_{t-1}). */
export function logReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] <= 0 || closes[i] <= 0) continue; // a non-positive price is bad data, not a real return
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  return returns;
}

const LAMBDA = 0.94;

/**
 * EWMA variance: σ²_t = λ·σ²_{t-1} + (1-λ)·r_t², seeded with the simple
 * variance of the first `seedWindow` returns (an EWMA needs a starting
 * variance from somewhere; a plain sample variance over an early window is
 * the standard seed rather than assuming 0, which would understate risk
 * for the first many observations). Returns the FINAL sigma (per-period,
 * not annualized — callers decide what period their return series is in).
 */
export function ewmaVolatility(returns: number[], lambda = LAMBDA, seedWindow = 10): number {
  if (returns.length === 0) return 0;
  const seedCount = Math.min(seedWindow, returns.length);
  const seedMean = returns.slice(0, seedCount).reduce((a, b) => a + b, 0) / seedCount;
  let variance = returns.slice(0, seedCount).reduce((s, r) => s + (r - seedMean) ** 2, 0) / Math.max(seedCount, 1);

  for (let i = seedCount; i < returns.length; i++) {
    variance = lambda * variance + (1 - lambda) * returns[i] ** 2;
  }
  return Math.sqrt(Math.max(variance, 0));
}

export interface ConeBand {
  /** Trading periods ahead (matching the input return series' own
   *  frequency — if returns are daily, h=1 means "1 day"). */
  horizon: number;
  low: number;
  mid: number;
  high: number;
}

/** z for an 80% two-sided band — same convention as the Holt forecast fan,
 *  so a reader sees one consistent confidence level across the app rather
 *  than two forecasts quietly using different intervals. */
const Z_80 = 1.28;

/**
 * Projects the current price forward under a random walk assumption:
 * P·exp(±z·σ·sqrt(h)). Horizons are given in the same period unit as the
 * input `sigma` (typically daily); the caller picks which horizons to ask
 * for (spec calls for 1d, 3d, 7d against a daily σ).
 */
export function volatilityCone(currentPrice: number, sigma: number, horizons: number[]): ConeBand[] {
  return horizons.map((h) => {
    const spread = Z_80 * sigma * Math.sqrt(h);
    return {
      horizon: h,
      low: currentPrice * Math.exp(-spread),
      mid: currentPrice,
      high: currentPrice * Math.exp(spread),
    };
  });
}
