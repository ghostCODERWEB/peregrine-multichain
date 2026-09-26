// Prediction markets: weather per category, repricing per market, and where
// the holders with a winning record sit against the price. All from Nansen's
// prediction-market endpoints; each formula is printed on the page.

export interface CategoryLike { volume24h: number | null; volume1w: number | null; openInterest: number | null }

/**
 * Heat: today's volume against the category's own daily pace over the last
 * week (1 = a normal day). The weather reading squashes its log onto 0–100:
 *   heat = volume₂₄ₕ ÷ (volume₁w ÷ 7)
 *   weather = 50 + 50·tanh(ln heat)
 * 2× the pace reads about 80, half the pace about 20.
 */
export function categoryHeat(c: CategoryLike): { heat: number | null; weather: number | null } {
  if (c.volume24h == null || !c.volume1w || c.volume1w <= 0) return { heat: null, weather: null };
  const heat = c.volume24h / (c.volume1w / 7);
  if (!(heat > 0)) return { heat: 0, weather: 0 };
  return { heat, weather: 50 + 50 * Math.tanh(Math.log(heat)) };
}

export const heatLabel = (w: number) => (w >= 70 ? 'Hot' : w <= 30 ? 'Quiet' : 'Normal pace');

export interface HolderLike { side: string; outcomeIndex: number | null; size: number; currentPrice: number | null; avgEntry: number | null; unrealizedUsd: number | null; address: string }

/** Value on each side of a binary market (size × current price), and how much of it is in profit. */
export function holderBalance(holders: HolderLike[]) {
  let yes = 0, no = 0, yesUp = 0, noUp = 0;
  for (const h of holders) {
    const v = h.size * (h.currentPrice ?? 0);
    if (!(v > 0)) continue;
    const isYes = /^yes$/i.test(h.side) || h.outcomeIndex === 1;
    if (isYes) { yes += v; if ((h.unrealizedUsd ?? 0) > 0) yesUp += v; } else { no += v; if ((h.unrealizedUsd ?? 0) > 0) noUp += v; }
  }
  const total = yes + no;
  return { yesUsd: yes, noUsd: no, yesShare: total > 0 ? yes / total : null, yesInProfit: yes > 0 ? yesUp / yes : null, noInProfit: no > 0 ? noUp / no : null };
}

export interface RecordLike { marketsTraded: number | null; winRate: number | null; totalPnlUsd: number | null }

/** A holder with a winning prediction-market record: 10+ markets, positive PnL, 55%+ won. */
export const isSkilled = (r: RecordLike | null | undefined) => !!r && (r.marketsTraded ?? 0) >= 10 && (r.totalPnlUsd ?? 0) > 0 && (r.winRate ?? 0) >= 0.55;

/**
 * Where skilled money sits against the price. Among the largest holders
 * with a winning record, the share of their value on YES, minus the YES
 * price (the market's implied probability). +0.2 reads "skilled holders
 * lean YES 20 points more than the price does". Needs two or more skilled
 * holders, or it says nothing.
 */
export function skilledDivergence(holders: HolderLike[], records: Map<string, RecordLike>, yesPrice: number | null): { skilled: number; skilledYesShare: number | null; divergence: number | null } {
  const skilledHolders = holders.filter((h) => isSkilled(records.get(h.address.toLowerCase())));
  const b = holderBalance(skilledHolders);
  const distinct = new Set(skilledHolders.map((h) => h.address.toLowerCase())).size;
  if (distinct < 2 || b.yesShare == null || yesPrice == null) return { skilled: distinct, skilledYesShare: b.yesShare, divergence: null };
  return { skilled: distinct, skilledYesShare: b.yesShare, divergence: b.yesShare - yesPrice };
}

/** An implied probability as people read it: 0.004 → "<1%", 0.35 → "35%". */
export function impliedPct(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return 'n/a';
  if (p > 0 && p < 0.01) return '<1%';
  if (p < 1 && p > 0.99) return '>99%';
  return `${Math.round(p * 100)}%`;
}

export interface MarketLike { volume24h: number | null; change1d: number | null; endDate: string | null; price?: number | null }

/**
 * A repricing worth showing: $50K+ traded today, a real move, a price still
 * between 3% and 97%, and at least two days left. A market that is settling
 * jumps to 0 or 100 because the outcome is known (a match ended), not
 * because anyone changed their mind; sports markets often carry far-off end
 * dates, so the price test catches what the date test misses.
 */
export function isMover(m: MarketLike, now: number): boolean {
  if ((m.volume24h ?? 0) < 50_000 || m.change1d == null || m.change1d === 0) return false;
  if (m.price != null && (m.price < 0.03 || m.price > 0.97)) return false;
  if (!m.endDate) return true;
  const end = Date.parse(m.endDate.endsWith('Z') ? m.endDate : `${m.endDate}Z`);
  return !Number.isFinite(end) || end - now > 2 * 86_400_000;
}
