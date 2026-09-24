// Liquidation ladder: where open perp positions are forced out, as
// notional per price band around the mark. A long is liquidated below the
// mark (a forced sell), a short above it (a forced buy). Bands are distances
// from the mark, so tokens at any price read the same way.

export interface PerpPositionLike { side: 'long' | 'short'; valueUsd: number; liquidationPrice: number | null; leverage: number | null }

export interface LadderBand {
  /** Distance from the mark, as a fraction: -0.1 = 10% below. Band covers (inner, outer]. */
  inner: number;
  outer: number;
  /** Price at the band's outer edge. */
  price: number;
  usd: number;
  positions: number;
  side: 'long' | 'short';
}

export interface Ladder {
  mark: number;
  bands: LadderBand[];
  longUsd: number;
  shortUsd: number;
  /** Notional liquidated within 10% of the mark, each way. */
  near: { longUsd: number; shortUsd: number };
  densest: LadderBand | null;
  avgLeverage: number | null;
  /** Positions with no liquidation price (e.g. fully collateralized). */
  unpriced: number;
}

export const EDGES = [0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1];

/** "5X" → 5; anything unreadable → null. */
export const parseLeverage = (s: string | null | undefined) => {
  const m = /([\d.]+)/.exec(s ?? '');
  const v = m ? Number(m[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
};

export function liquidationLadder(positions: PerpPositionLike[], mark: number): Ladder | null {
  if (!(mark > 0)) return null;
  const bands: LadderBand[] = [];
  for (const side of ['long', 'short'] as const) {
    let inner = 0;
    for (const e of EDGES) {
      const outer = side === 'long' ? -e : e;
      bands.push({ inner, outer, price: mark * (1 + outer), usd: 0, positions: 0, side });
      inner = outer;
    }
  }
  let longUsd = 0, shortUsd = 0, unpriced = 0, levW = 0, levSum = 0;
  const near = { longUsd: 0, shortUsd: 0 };
  for (const p of positions) {
    if (!(p.valueUsd > 0)) continue;
    if (p.side === 'long') longUsd += p.valueUsd; else shortUsd += p.valueUsd;
    if (p.leverage != null) { levW += p.valueUsd; levSum += p.valueUsd * p.leverage; }
    if (p.liquidationPrice == null || !(p.liquidationPrice > 0)) { unpriced++; continue; }
    const d = p.liquidationPrice / mark - 1;
    // A long liquidates below the mark and a short above; a price on the
    // wrong side means the position is already past it (being unwound).
    if ((p.side === 'long' && d >= 0) || (p.side === 'short' && d <= 0)) { unpriced++; continue; }
    const dist = Math.abs(d);
    const band = bands.find((b) => b.side === p.side && dist > Math.abs(b.inner) && dist <= Math.abs(b.outer));
    if (!band) continue; // beyond ±100%
    band.usd += p.valueUsd;
    band.positions++;
    if (dist <= 0.1) { if (p.side === 'long') near.longUsd += p.valueUsd; else near.shortUsd += p.valueUsd; }
  }
  const densest = bands.reduce<LadderBand | null>((m, b) => (b.usd > (m?.usd ?? 0) ? b : m), null);
  return { mark, bands, longUsd, shortUsd, near, densest, avgLeverage: levW > 0 ? levSum / levW : null, unpriced };
}
