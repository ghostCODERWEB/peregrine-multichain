// Smart-money desk: conviction, crowding and perp tilt, from numbers Nansen
// already returns. Every score here is a named, printed formula; nothing is
// weighted by a coefficient the page doesn't show.

export interface HoldingLike {
  chain: string;
  tokenAddress: string;
  symbol: string;
  valueUsd: number;
  /** 24h change in smart money's aggregate balance, as a fraction (0.05 = +5%). */
  change24h: number | null;
  /** Smart-money wallets holding it. */
  holders: number;
}

export interface LeaderLike {
  /** 1-based place on the smart-money PnL leaderboard. */
  rank: number;
  /** The wallet's five largest balances. */
  top5: Array<{ chain: string; tokenAddress: string; usd: number }>;
}

export interface Backing { backers: number; bestRank: number | null; usd: number }

/** EVM addresses compare case-insensitively; base58 and others do not. */
export const tokenKey = (chain: string, address: string) => `${chain}:${/^0x[0-9a-fA-F]+$/.test(address) ? address.toLowerCase() : address}`;

/**
 * Which tokens the best smart-money traders hold among their five largest
 * balances: how many of them, the best-placed one, and how much they hold.
 */
export function topTraderBacking(leaders: LeaderLike[]): Map<string, Backing> {
  const out = new Map<string, Backing>();
  for (const l of leaders) {
    const seen = new Set<string>();
    for (const t of l.top5) {
      const k = tokenKey(t.chain, t.tokenAddress);
      if (seen.has(k)) continue;
      seen.add(k);
      const b = out.get(k) ?? { backers: 0, bestRank: null, usd: 0 };
      b.backers++;
      b.bestRank = b.bestRank == null ? l.rank : Math.min(b.bestRank, l.rank);
      b.usd += Number.isFinite(t.usd) ? t.usd : 0;
      out.set(k, b);
    }
  }
  return out;
}

/** Five backers from the top of the leaderboard is full weight. */
export const FULL_BACKING = 5;
/** A 5% move in smart money's balance in a day is a strong one (p90 ≈ 6%). */
export const ADDING_SCALE = 0.05;

/**
 * Conviction, −100…+100: the direction and strength of smart money's 24h
 * balance change, scaled up by how many top-PnL wallets hold the token.
 *   adding  = tanh(change ÷ 0.05)
 *   backing = min(1, backers ÷ 5)
 *   score   = 100 × adding × (0.35 + 0.65 × backing)
 * Without backers the score tops out at ±35: the cohort moved, but none of
 * its best traders is in it.
 */
export function conviction(change24h: number | null, backers: number): number | null {
  if (change24h == null || !Number.isFinite(change24h)) return null;
  const adding = Math.tanh(change24h / ADDING_SCALE);
  const backing = Math.min(1, Math.max(0, backers) / FULL_BACKING);
  const s = Math.round(100 * adding * (0.35 + 0.65 * backing));
  return s === 0 ? 0 : s; // no −0
}

/** Holder count at the given quantile of a list (for "crowded"). */
export function holderQuantile(holdings: HoldingLike[], q: number): number {
  const xs = holdings.map((h) => h.holders).sort((a, b) => a - b);
  if (!xs.length) return 0;
  return xs[Math.min(xs.length - 1, Math.floor(q * xs.length))];
}

/**
 * Crowded exit: many smart-money wallets hold it (top fifth by holder count)
 * and the cohort cut its balance by 2% or more in a day. When a crowded
 * position unwinds, the holders are all on the same side of the door.
 */
export function crowdedExit(h: HoldingLike, crowdedAt: number): boolean {
  return h.holders >= crowdedAt && h.holders >= 5 && h.change24h != null && h.change24h <= -0.02;
}

export interface PerpTradeLike { symbol: string; action: string; side: string | null; valueUsd: number | null }

/**
 * Perp tilt per coin from smart-money perp trades: USD opening or adding
 * to longs minus USD opening or adding to shorts. Reductions and closes
 * are left out — they unwind a view rather than state a new one.
 * Live responses carry the verb in `action` ("Open", "Add", "Reduce",
 * "Close") and the direction in `side`; the filter enum's combined form
 * ("Buy - Open Long") is read too.
 */
export function perpTilt(trades: PerpTradeLike[]): Array<{ symbol: string; longUsd: number; shortUsd: number; netUsd: number; trades: number }> {
  const by = new Map<string, { symbol: string; longUsd: number; shortUsd: number; netUsd: number; trades: number }>();
  for (const t of trades) {
    const v = t.valueUsd ?? 0;
    if (!(v > 0)) continue;
    if (!/\b(open|add)\b/i.test(t.action)) continue;
    const dir = /long/i.test(t.action) ? 'long' : /short/i.test(t.action) ? 'short' : /^long/i.test(t.side ?? '') ? 'long' : /^short/i.test(t.side ?? '') ? 'short' : null;
    if (!dir) continue;
    const r = by.get(t.symbol) ?? { symbol: t.symbol, longUsd: 0, shortUsd: 0, netUsd: 0, trades: 0 };
    if (dir === 'long') r.longUsd += v; else r.shortUsd += v;
    r.netUsd = r.longUsd - r.shortUsd;
    r.trades++;
    by.set(t.symbol, r);
  }
  return [...by.values()].sort((a, b) => Math.abs(b.netUsd) - Math.abs(a.netUsd));
}

/** Nansen's smart-money holdings cohort dropped Fund wallets on this day. */
export const FUND_COHORT_CHANGE = '2026-09-09';
