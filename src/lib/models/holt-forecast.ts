// Holt linear exponential smoothing, section 5.4: the 24h chain-pressure
// forecast. Two smoothed components — a level and a trend — updated at
// each step from the previous forecast's error, so the model tracks both
// "where the series is" and "which way it's moving" rather than just the
// last value.
//
// α, β are fitted by grid search minimizing one-step-ahead squared error on
// TIDE's own snapshot history (15-minute CPI snapshots) — there is no
// closed-form solution for Holt's parameters, this is the standard
// approach. The fan band is ±1.28σ of the in-sample residuals (80% CI,
// under a normal-residuals assumption — a real approximation, not exact
// coverage, and the lab's calibration plot is where that approximation
// gets checked against reality rather than just asserted).

export interface HoltFit {
  alpha: number;
  beta: number;
  /** In-sample one-step-ahead fitted values, same length as the input
   *  series (first value is not predicted — there's nothing before it). */
  fitted: number[];
  /** Standard deviation of (actual - fitted) over the fitted region. */
  residualStd: number;
  finalLevel: number;
  finalTrend: number;
}

/** Runs Holt's method for one fixed (alpha, beta) pair and returns the
 *  one-step-ahead fitted series plus the final level/trend state, from
 *  which any horizon can be forecast. */
function runHolt(series: number[], alpha: number, beta: number): { fitted: number[]; level: number; trend: number } {
  const n = series.length;
  const fitted: number[] = [series[0]]; // nothing to predict the first point from
  let level = series[0];
  let trend = n > 1 ? series[1] - series[0] : 0;

  for (let t = 1; t < n; t++) {
    const forecastForT = level + trend; // one-step-ahead prediction made at t-1
    fitted.push(forecastForT);
    const prevLevel = level;
    level = alpha * series[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { fitted, level, trend };
}

function sse(series: number[], fitted: number[]): number {
  let sum = 0;
  for (let i = 1; i < series.length; i++) {
    const err = series[i] - fitted[i];
    sum += err * err;
  }
  return sum;
}

const GRID_STEPS = 19; // 0.05 .. 0.95 in steps of 0.05

/**
 * Fits α and β by grid search over (0,1)^2, minimizing sum of squared
 * one-step-ahead errors — a full closed-form optimizer is overkill for a
 * parameter space this small and this needs to run fast enough for a
 * request handler, not just a batch job.
 *
 * A series shorter than 3 points can't estimate a trend at all; the caller
 * should treat CPI history that thin as "not enough for Holt yet" (this
 * still returns a degenerate but well-defined fit rather than throwing).
 */
export function fitHolt(series: number[]): HoltFit {
  if (series.length === 0) {
    throw new Error('fitHolt: empty series');
  }
  if (series.length < 3) {
    const flat = runHolt(series, 0.5, 0.5);
    return {
      alpha: 0.5, beta: 0.5, fitted: flat.fitted,
      residualStd: 0, finalLevel: flat.level, finalTrend: flat.trend,
    };
  }

  let best: { alpha: number; beta: number; fitted: number[]; level: number; trend: number; error: number } | null = null;
  for (let i = 1; i < GRID_STEPS; i++) {
    const alpha = i / GRID_STEPS;
    for (let j = 1; j < GRID_STEPS; j++) {
      const beta = j / GRID_STEPS;
      const { fitted, level, trend } = runHolt(series, alpha, beta);
      const error = sse(series, fitted);
      if (!best || error < best.error) best = { alpha, beta, fitted, level, trend, error };
    }
  }
  const chosen = best!;
  const residuals = series.slice(1).map((y, i) => y - chosen.fitted[i + 1]);
  const residualStd = stdDev(residuals);

  return {
    alpha: chosen.alpha, beta: chosen.beta, fitted: chosen.fitted,
    residualStd, finalLevel: chosen.level, finalTrend: chosen.trend,
  };
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export interface HoltForecastPoint {
  /** Steps ahead of the last observed point (1, 2, 3, ...). */
  step: number;
  forecast: number;
  low80: number;
  high80: number;
}

/** z for an 80% two-sided interval under a normal-residuals assumption,
 *  matching the spec's ±1.28σ. */
const Z_80 = 1.28;

/**
 * Forecasts `horizonSteps` ahead from a fitted Holt model. The fan widens
 * with sqrt(step) — later steps compound more uncertainty, the standard
 * random-walk-with-drift scaling for a variance that accumulates linearly
 * per step.
 */
export function holtForecast(series: number[], horizonSteps: number): { fit: HoltFit; points: HoltForecastPoint[] } {
  const fit = fitHolt(series);
  const points: HoltForecastPoint[] = [];
  for (let h = 1; h <= horizonSteps; h++) {
    const forecast = fit.finalLevel + h * fit.finalTrend;
    const band = Z_80 * fit.residualStd * Math.sqrt(h);
    points.push({ step: h, forecast, low80: forecast - band, high80: forecast + band });
  }
  return { fit, points };
}

/** Mean Absolute Percentage Error of the in-sample one-step-ahead fit —
 *  what the lab shows as this forecast's own track record. Points where
 *  the actual value is 0 are skipped (percentage error is undefined
 *  there), and this returns null rather than NaN if every point had to be
 *  skipped. */
export function mape(series: number[], fitted: number[]): number | null {
  let sum = 0;
  let n = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i] === 0) continue;
    sum += Math.abs((series[i] - fitted[i]) / series[i]);
    n++;
  }
  return n > 0 ? (sum / n) * 100 : null;
}
