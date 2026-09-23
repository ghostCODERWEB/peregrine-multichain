// L2-regularized logistic regression (spec 5.5), fitted by Newton's method
// (IRLS) on standardized features. Small enough to run in-process on a
// few thousand rows; no ML dependency to explain in the README.

export interface LogisticModel {
  /** Feature names, in column order. */
  features: string[];
  /** Standardization fitted on the training set only. */
  mean: number[];
  std: number[];
  intercept: number;
  /** Coefficients on the standardized scale (comparable across features). */
  weights: number[];
  lambda: number;
  iterations: number;
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Standardized values are clipped to ±5: a token with a 50× price change
 *  should count as "very high", not dominate the whole fit. */
const CLIP = 5;
const clip = (v: number) => Math.max(-CLIP, Math.min(CLIP, v));

/** Penalized negative log-likelihood (the quantity Newton minimizes). */
function loss(Z: number[][], y: number[], beta: number[], lambda: number): number {
  let l = 0;
  for (let i = 0; i < Z.length; i++) {
    const z = Z[i].reduce((s, v, k) => s + v * beta[k], 0);
    // log(1 + e^z) computed stably
    l += (z > 0 ? z + Math.log1p(Math.exp(-z)) : Math.log1p(Math.exp(z))) - y[i] * z;
  }
  return l + (lambda / 2) * beta.slice(1).reduce((s, b) => s + b * b, 0);
}

function standardizer(X: number[][]): { mean: number[]; std: number[] } {
  const d = X[0]?.length ?? 0;
  const mean = Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[j], 0) / X.length);
  const std = Array.from({ length: d }, (_, j) => {
    const v = X.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / Math.max(1, X.length - 1);
    return Math.sqrt(v) || 1; // a constant column stays at 0 instead of dividing by 0
  });
  return { mean, std };
}

/** Solves A·x = b by Gaussian elimination with partial pivoting. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / piv;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / (M[r][r] || 1e-12);
  }
  return x;
}

/**
 * Fits P(y=1|x) = sigmoid(b0 + w·z), z = standardized x, minimizing
 * log-loss + (λ/2)·|w|² (the intercept is not penalized).
 */
export function fitLogistic(X: number[][], y: number[], features: string[], lambda = 1, maxIter = 50): LogisticModel {
  if (!X.length) throw new Error('fitLogistic: no rows');
  const { mean, std } = standardizer(X);
  const Z = X.map((r) => [1, ...r.map((v, j) => clip((v - mean[j]) / std[j]))]);
  const d = Z[0].length;
  let beta = new Array(d).fill(0);
  // Start the intercept at the base rate's log-odds: converges faster and
  // keeps an all-zero-feature model calibrated to the prevalence.
  const rate = Math.min(1 - 1e-6, Math.max(1e-6, y.reduce((a, b) => a + b, 0) / y.length));
  beta[0] = Math.log(rate / (1 - rate));
  let it = 0;
  for (; it < maxIter; it++) {
    const g = new Array(d).fill(0);
    const H = Array.from({ length: d }, () => new Array(d).fill(0));
    for (let i = 0; i < Z.length; i++) {
      const p = sigmoid(Z[i].reduce((s, v, k) => s + v * beta[k], 0));
      const w = Math.max(p * (1 - p), 1e-9);
      for (let a = 0; a < d; a++) {
        g[a] += (p - y[i]) * Z[i][a];
        for (let b = a; b < d; b++) H[a][b] += w * Z[i][a] * Z[i][b];
      }
    }
    for (let a = 0; a < d; a++) {
      for (let b = 0; b < a; b++) H[a][b] = H[b][a];
      if (a > 0) { g[a] += lambda * beta[a]; H[a][a] += lambda; }
    }
    const step = solve(H, g);
    // Step-halving: a full Newton step can overshoot badly when a rare
    // event is nearly separable; only accept steps that lower the loss.
    const before = loss(Z, y, beta, lambda);
    let t = 1;
    let next = beta.map((v, k) => v - step[k]);
    while (t > 1e-6 && !(loss(Z, y, next, lambda) <= before)) {
      t /= 2;
      next = beta.map((v, k) => v - t * step[k]);
    }
    const moved = Math.max(...next.map((v, k) => Math.abs(v - beta[k])));
    beta = next;
    if (moved < 1e-8) break;
  }
  return { features, mean, std, intercept: beta[0], weights: beta.slice(1), lambda, iterations: it + 1 };
}

export function predictLogistic(m: LogisticModel, x: number[]): number {
  return sigmoid(m.intercept + x.reduce((s, v, j) => s + m.weights[j] * clip((v - m.mean[j]) / m.std[j]), 0));
}
