// Forecast scoring for the Forecast Lab: how well does a probability rank
// (AUC), how close is it to what happened (Brier), and does "30%" mean 30%
// (calibration by decile). Pure functions over (probability, outcome).

/**
 * ROC AUC via the Mann-Whitney U statistic: the chance a random positive
 * is scored above a random negative, ties counting half. null when one
 * class is absent — AUC is undefined, not 0.5.
 */
export function auc(p: number[], y: number[]): number | null {
  const pos = y.filter((v) => v === 1).length;
  const neg = y.length - pos;
  if (!pos || !neg) return null;
  const idx = p.map((v, i) => i).sort((a, b) => p[a] - p[b]);
  // Average ranks over ties.
  const rank = new Array(p.length).fill(0);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && p[idx[j + 1]] === p[idx[i]]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) rank[idx[k]] = r;
    i = j + 1;
  }
  const sumPos = rank.reduce((s, r, i) => s + (y[i] === 1 ? r : 0), 0);
  return (sumPos - (pos * (pos + 1)) / 2) / (pos * neg);
}

/** Mean squared error of the probability against the 0/1 outcome. */
export function brier(p: number[], y: number[]): number | null {
  if (!p.length) return null;
  return p.reduce((s, v, i) => s + (v - y[i]) ** 2, 0) / p.length;
}

export interface CalibrationBin { lo: number; hi: number; n: number; meanPredicted: number; observedRate: number }

/** Equal-count bins (deciles by default) of predicted probability, each
 *  with its mean prediction and the rate actually observed. */
export function calibration(p: number[], y: number[], bins = 10): CalibrationBin[] {
  const idx = p.map((_, i) => i).sort((a, b) => p[a] - p[b]);
  const out: CalibrationBin[] = [];
  const size = Math.max(1, Math.ceil(idx.length / bins));
  for (let s = 0; s < idx.length; s += size) {
    const part = idx.slice(s, s + size);
    out.push({
      lo: p[part[0]], hi: p[part.at(-1)!], n: part.length,
      meanPredicted: part.reduce((a, i) => a + p[i], 0) / part.length,
      observedRate: part.reduce((a, i) => a + y[i], 0) / part.length,
    });
  }
  return out;
}

export interface RocPoint { fpr: number; tpr: number }

export function rocCurve(p: number[], y: number[]): RocPoint[] {
  const pos = y.filter((v) => v === 1).length, neg = y.length - pos;
  if (!pos || !neg) return [];
  const thresholds = [...new Set(p)].sort((a, b) => b - a);
  const pts: RocPoint[] = [{ fpr: 0, tpr: 0 }];
  for (const t of thresholds) {
    let tp = 0, fp = 0;
    p.forEach((v, i) => { if (v >= t) { if (y[i] === 1) tp++; else fp++; } });
    pts.push({ fpr: fp / neg, tpr: tp / pos });
  }
  return pts;
}

/** Share of cases where a hard call at `threshold` matched the outcome. */
export function hitRate(p: number[], y: number[], threshold = 0.5): number | null {
  if (!p.length) return null;
  return p.reduce((s, v, i) => s + ((v >= threshold ? 1 : 0) === y[i] ? 1 : 0), 0) / p.length;
}

/**
 * 95% interval for an AUC (Hanley & McNeil 1982). With a handful of
 * positive cases the interval is wide, and the lab shows it so a 0.85 on
 * eight events isn't read as a settled fact.
 */
export function aucInterval(a: number | null, positives: number, negatives: number): [number, number] | null {
  if (a == null || !positives || !negatives) return null;
  const q1 = a / (2 - a), q2 = (2 * a * a) / (1 + a);
  const se = Math.sqrt((a * (1 - a) + (positives - 1) * (q1 - a * a) + (negatives - 1) * (q2 - a * a)) / (positives * negatives));
  return [Math.max(0, a - 1.96 * se), Math.min(1, a + 1.96 * se)];
}
