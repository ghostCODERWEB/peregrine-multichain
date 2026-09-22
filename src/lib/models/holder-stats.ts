// Generic holder-distribution statistics: HHI, Gini, Nakamoto coefficient,
// Lorenz curve points. Shared by the Storm Score's concentration sub-model
// (5.3) and the token page's Holder Lorenz curve (2.3) — one implementation
// of "how concentrated is this distribution", not two that could disagree.
//
// Every function here takes plain fractional shares (0-1, summing to <= 1),
// already filtered to real holders — excluding exchange, bridge and
// contract labels is the caller's job (that filter needs label data this
// module doesn't have), matching the spec's `s_i = holder share after
// excluding exchange, bridge and contract labels`.

/** Sorted descending, since several of these statistics assume it. */
function sortDesc(shares: number[]): number[] {
  return [...shares].sort((a, b) => b - a);
}

/** Σ s_i^2. 1/N for N equal holders (least concentrated), 1 for a single
 *  holder owning everything. */
export function hhi(shares: number[]): number {
  return shares.reduce((sum, s) => sum + s * s, 0);
}

/**
 * HHI normalized for holder count: (HHI - 1/N) / (1 - 1/N), so N equally
 * sized holders always read as 0 regardless of N, and a single holder
 * always reads as 1. Raw HHI conflates "few holders" with "concentrated
 * holders" — 4 equal holders (HHI 0.25) and 1 whale among many (HHI can
 * also land near 0.25) look identical un-normalized; this separates them.
 * Returns 0 for N <= 1 (normalization is undefined — nothing to spread
 * concentration across).
 */
export function normalizedHhi(shares: number[]): number {
  const n = shares.length;
  if (n <= 1) return 0;
  const raw = hhi(shares);
  const floor = 1 / n;
  return (raw - floor) / (1 - floor);
}

/**
 * Standard Gini coefficient via the mean-absolute-difference form:
 * G = Σᵢⱼ|xᵢ - xⱼ| / (2n² * mean). 0 = perfectly equal, 1 = maximally
 * unequal (all supply in view held by one wallet). Returns 0 for fewer
 * than 2 holders (nothing to compare).
 */
export function gini(shares: number[]): number {
  const n = shares.length;
  if (n < 2) return 0;
  const mean = shares.reduce((a, b) => a + b, 0) / n;
  if (mean === 0) return 0;
  let sumAbsDiff = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumAbsDiff += Math.abs(shares[i] - shares[j]);
    }
  }
  return sumAbsDiff / (2 * n * n * mean);
}

/** Sum of the largest 10 shares (or fewer, if there aren't 10 holders). */
export function topNShare(shares: number[], n: number): number {
  return sortDesc(shares).slice(0, n).reduce((a, b) => a + b, 0);
}

/**
 * Nakamoto coefficient: the smallest number of holders whose combined
 * share exceeds `threshold` (default 0.51 — the conventional "51% attack"
 * framing, applied here to sell/dump risk rather than consensus). Returns
 * the full holder count if even summing everyone doesn't clear the
 * threshold (the view is too incomplete to say fewer would suffice).
 */
export function nakamotoCoefficient(shares: number[], threshold = 0.51): number {
  const sorted = sortDesc(shares);
  let cumulative = 0;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i];
    if (cumulative > threshold) return i + 1;
  }
  return sorted.length;
}

export interface LorenzPoint {
  /** Cumulative share of holders, 0-1, poorest-first. */
  populationShare: number;
  /** Cumulative share of supply held by that population, 0-1. */
  supplyShare: number;
}

/** Lorenz curve points, poorest holder first, for plotting against the
 *  45-degree line of perfect equality. Always starts at (0,0) and ends at
 *  (1,1) so the curve is well-formed even for a single holder. */
export function lorenzCurve(shares: number[]): LorenzPoint[] {
  const n = shares.length;
  if (n === 0) return [{ populationShare: 0, supplyShare: 0 }, { populationShare: 1, supplyShare: 1 }];
  const sortedAsc = [...shares].sort((a, b) => a - b);
  const total = sortedAsc.reduce((a, b) => a + b, 0);
  const points: LorenzPoint[] = [{ populationShare: 0, supplyShare: 0 }];
  let cumulative = 0;
  for (let i = 0; i < n; i++) {
    cumulative += sortedAsc[i];
    points.push({
      populationShare: (i + 1) / n,
      supplyShare: total > 0 ? cumulative / total : (i + 1) / n,
    });
  }
  return points;
}
