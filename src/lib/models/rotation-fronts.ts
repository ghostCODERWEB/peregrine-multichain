// Rotation fronts, section 5.2 — the signature idea: capital rotating
// between chains, measured from actual wallets rather than asserted from
// aggregate volume. EVM smart-money addresses are the same address across
// every EVM chain, so a sell on chain A followed by a buy on chain B by the
// SAME wallet within a short window is direct, first-party evidence of
// rotation — not a correlation between two chains' independent volumes.
//
// Input is a flat trade list (from smart-money/dex-trades across every Tier
// A chain); everything past that is pure.

export interface Trade {
  wallet: string;
  chain: string;
  side: 'buy' | 'sell';
  usdValue: number;
  /** Unix ms. */
  timestamp: number;
}

/** A sell may be "funded by" at most one buy and vice versa — see
 *  matchWalletRotations below for why greedy one-to-one matching, not
 *  every qualifying pair, is the right read of "a sell followed by a buy". */
export interface RotationMatch {
  wallet: string;
  fromChain: string;
  toChain: string;
  /** min(sold_usd, bought_usd) — the amount that could actually have moved,
   *  not the larger of the two (the wallet might have sold more than it
   *  redeployed, or topped up the buy from elsewhere). */
  usd: number;
  sellAt: number;
  buyAt: number;
}

const DEFAULT_WINDOW_MS = 12 * 60 * 60_000; // 12h, per spec

/**
 * One wallet's trades in, its rotation matches out. Greedy and
 * one-buy-consumes-once: sells are processed earliest-first, each pairs
 * with at most one not-yet-consumed buy on a different chain within the
 * window (picking the largest-USD qualifying buy — the best-evidenced
 * match), and that buy can't pair with a second sell. Without the
 * consumed-once rule, one $50k buy sitting near three earlier sells would
 * count as three separate rotations of up to $50k each, overstating the
 * flow by as much as 3x for a single real trade.
 */
export function matchWalletRotations(trades: Trade[], windowMs = DEFAULT_WINDOW_MS): RotationMatch[] {
  const sells = trades.filter((t) => t.side === 'sell').sort((a, b) => a.timestamp - b.timestamp);
  const buys = trades.filter((t) => t.side === 'buy');
  const consumed = new Set<Trade>();
  const matches: RotationMatch[] = [];

  for (const sell of sells) {
    let best: Trade | null = null;
    for (const buy of buys) {
      if (consumed.has(buy)) continue;
      if (buy.chain === sell.chain) continue;
      const dt = buy.timestamp - sell.timestamp;
      if (dt < 0 || dt > windowMs) continue;
      if (!best || buy.usdValue > best.usdValue) best = buy;
    }
    if (!best) continue;
    consumed.add(best);
    matches.push({
      wallet: sell.wallet,
      fromChain: sell.chain,
      toChain: best.chain,
      usd: Math.min(sell.usdValue, best.usdValue),
      sellAt: sell.timestamp,
      buyAt: best.timestamp,
    });
  }
  return matches;
}

export interface DirectedFront {
  from: string;
  to: string;
  usd: number;
  wallets: string[];
  confidence: number;
  /** True when this pair's wallets were linked only by first-funder /
   *  related-wallets clustering (non-EVM sides), not by the same address
   *  trading on both chains. Shown to the reader as "inferred". */
  inferred: boolean;
}

/** 1 - exp(-n/3): 1 wallet -> 0.28, 2 -> 0.49, 3 -> 0.63, 5 -> 0.81,
 *  saturating toward 1 as more independent wallets corroborate the same
 *  directed flow. Never reaches exactly 1 — no amount of evidence is
 *  proof, and a chart that can hit 100% confidence invites over-trust. */
export function frontConfidence(walletCount: number): number {
  return 1 - Math.exp(-walletCount / 3);
}

const MIN_WALLETS_TO_SHOW = 2;

/**
 * Matches grouped into directed chain-pair fronts. Filters out any pair
 * with fewer than MIN_WALLETS_TO_SHOW distinct wallets — a rotation
 * "front" backed by one wallet's one trade is an anecdote, not a pattern,
 * and the spec is explicit that fronts must be measured, not guessed at.
 */
export function buildDirectedFronts(matches: RotationMatch[], inferredWallets: Set<string> = new Set()): DirectedFront[] {
  const byPair = new Map<string, { from: string; to: string; usd: number; wallets: Set<string> }>();
  for (const m of matches) {
    const key = `${m.fromChain}>${m.toChain}`;
    const entry = byPair.get(key) ?? { from: m.fromChain, to: m.toChain, usd: 0, wallets: new Set<string>() };
    entry.usd += m.usd;
    entry.wallets.add(m.wallet);
    byPair.set(key, entry);
  }

  const fronts: DirectedFront[] = [];
  for (const entry of byPair.values()) {
    if (entry.wallets.size < MIN_WALLETS_TO_SHOW) continue;
    const wallets = [...entry.wallets];
    fronts.push({
      from: entry.from,
      to: entry.to,
      usd: entry.usd,
      wallets,
      confidence: frontConfidence(wallets.length),
      inferred: wallets.every((w) => inferredWallets.has(w)),
    });
  }
  return fronts;
}

export interface NetFront {
  chainA: string;
  chainB: string;
  /** Positive: net flow is A -> B. Negative: net flow is B -> A. */
  netUsd: number;
  direction: { from: string; to: string };
  grossAtoB: number;
  grossBtoA: number;
  confidence: number;
  inferred: boolean;
}

/**
 * Collapses the two directed fronts between a pair of chains (A->B and
 * B->A) into one net arc, per spec: "Net front R(A->B) - R(B->A) sets the
 * arc direction." Two-way traffic that mostly cancels out (both directions
 * near-equal) still nets to a small arc rather than two contradictory large
 * ones on screen — which is the correct reading: heavy churn with no net
 * rotation is a different fact from a one-way front, and collapsing to a
 * single small net arc is what actually shows that.
 */
export function netFronts(directed: DirectedFront[]): NetFront[] {
  const byUnorderedPair = new Map<string, DirectedFront[]>();
  for (const f of directed) {
    const key = [f.from, f.to].sort().join('|');
    const list = byUnorderedPair.get(key) ?? [];
    list.push(f);
    byUnorderedPair.set(key, list);
  }

  const results: NetFront[] = [];
  for (const [key, pair] of byUnorderedPair) {
    const [chainA, chainB] = key.split('|');
    const aToB = pair.find((f) => f.from === chainA && f.to === chainB);
    const bToA = pair.find((f) => f.from === chainB && f.to === chainA);
    const grossAtoB = aToB?.usd ?? 0;
    const grossBtoA = bToA?.usd ?? 0;
    const netUsd = grossAtoB - grossBtoA;
    const winner = netUsd >= 0 ? aToB : bToA;
    if (!winner) continue; // shouldn't happen, at least one side produced this pair
    results.push({
      chainA, chainB, netUsd,
      direction: netUsd >= 0 ? { from: chainA, to: chainB } : { from: chainB, to: chainA },
      grossAtoB, grossBtoA,
      confidence: winner.confidence,
      inferred: winner.inferred,
    });
  }
  return results;
}
