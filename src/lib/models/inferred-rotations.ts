import { ALL_SUPPORTED_CHAINS } from '@/types/nansen/chain-enums';
import { matchWalletRotations, type Trade } from './rotation-fronts';

export interface WalletRef {
  address: string;
  chain: string;
}
export interface FundingLink {
  child: WalletRef;
  funder: WalletRef;
  at: number;
  transactionHash: string;
  endpoint: 'profiler/address/first-funder' | 'profiler/address/related-wallets';
  request: Record<string, unknown>;
}
export interface InferredMatch {
  seller: WalletRef;
  buyer: WalletRef;
  sellAt: number;
  buyAt: number;
  soldUsd: number;
  boughtUsd: number;
  matchedUsd: number;
  group: string;
  evidence: FundingLink;
}
export interface InferredFront {
  from: string;
  to: string;
  netUsd: number;
  grossForward: number;
  grossBack: number;
  groups: number;
  matches: InferredMatch[];
}
export const evmChain = (chain: string) => (ALL_SUPPORTED_CHAINS.evm as readonly string[]).includes(chain);
/** Only EVM identities may be carried across chains. Never lowercase base58. */
export const identity = (w: WalletRef) =>
  evmChain(w.chain) && /^0x[0-9a-f]{40}$/i.test(w.address) ? `evm:${w.address.toLowerCase()}` : `${w.chain}:${w.address}`;
const ref = (t: Trade): WalletRef => ({ address: t.wallet, chain: t.chain });
const WINDOW = 12 * 3_600_000;

/** Direct funding links support a hypothesis, never ownership or a bridge transfer.
 * Connected components count independent evidence groups, not clustered wallets.
 * No transitive link can match trades. Observed same-wallet activity takes priority.
 */
export function inferRotations(trades: Trade[], links: FundingLink[], now: number): InferredFront[] {
  const since = now - 24 * 3_600_000;
  const clean = trades.filter((t) => Number.isFinite(t.usdValue) && t.usdValue > 0 && t.timestamp >= since - WINDOW && t.timestamp <= now);
  const eligible = links.filter(
    (e) => Number.isFinite(e.at) && e.at <= now && !!e.transactionHash && identity(e.child) !== identity(e.funder),
  );
  if (!eligible.length) return [];
  const linked = new Set(eligible.flatMap((e) => [identity(e.child), identity(e.funder)]));
  const parent = new Map<string, string>();
  const root = (x: string): string => {
    const p = parent.get(x);
    return p && p !== x ? root(p) : x;
  };
  for (const e of eligible) {
    const a = root(identity(e.child)),
      b = root(identity(e.funder));
    if (a !== b) parent.set(b, a);
  }
  const byIdentity = new Map<string, Trade[]>();
  for (const t of clean) {
    const k = identity(ref(t));
    if (!linked.has(k)) continue;
    const ts = byIdentity.get(k) ?? [];
    ts.push(t);
    byIdentity.set(k, ts);
  }
  // Conservatively exclude all recent activity by a wallet with an observed
  // same-wallet rotation, so observed and inferred fronts never reuse it.
  const observed = new Set([...byIdentity].filter(([, ts]) => matchWalletRotations(ts).some((m) => m.buyAt >= since)).map(([k]) => k));
  const available = clean.filter((t) => linked.has(identity(ref(t))) && !observed.has(identity(ref(t))));
  const used = new Set<Trade>();
  const matches: InferredMatch[] = [];
  for (const sell of available.filter((t) => t.side === 'sell').sort((a, b) => a.timestamp - b.timestamp)) {
    const a = identity(ref(sell));
    let best: { buy: Trade; evidence: FundingLink } | null = null;
    for (const buy of available) {
      const b = identity(ref(buy));
      if (
        buy.side !== 'buy' ||
        used.has(buy) ||
        buy.chain === sell.chain ||
        a === b ||
        buy.timestamp < Math.max(since, sell.timestamp) ||
        buy.timestamp - sell.timestamp > WINDOW
      )
        continue;
      const evidence = eligible.find(
        (e) =>
          e.at <= sell.timestamp &&
          ((identity(e.child) === a && identity(e.funder) === b) || (identity(e.child) === b && identity(e.funder) === a)),
      );
      if (evidence && (!best || buy.usdValue > best.buy.usdValue)) best = { buy, evidence };
    }
    if (!best) continue;
    used.add(best.buy);
    matches.push({
      seller: ref(sell),
      buyer: ref(best.buy),
      sellAt: sell.timestamp,
      buyAt: best.buy.timestamp,
      soldUsd: sell.usdValue,
      boughtUsd: best.buy.usdValue,
      matchedUsd: Math.min(sell.usdValue, best.buy.usdValue),
      group: root(a),
      evidence: best.evidence,
    });
  }
  const pairs = new Map<string, InferredMatch[]>();
  for (const m of matches) {
    const k = [m.seller.chain, m.buyer.chain].sort().join('|');
    pairs.set(k, [...(pairs.get(k) ?? []), m]);
  }
  return [...pairs]
    .flatMap(([key, ms]) => {
      const [a, b] = key.split('|');
      const forward = ms.filter((m) => m.seller.chain === a).reduce((s, m) => s + m.matchedUsd, 0);
      const back = ms.filter((m) => m.seller.chain === b).reduce((s, m) => s + m.matchedUsd, 0);
      if (forward === back) return [];
      const from = forward > back ? a : b,
        to = forward > back ? b : a;
      const groups = new Set(ms.filter((m) => m.seller.chain === from).map((m) => m.group)).size;
      if (groups < 2) return [];
      return [
        {
          from,
          to,
          netUsd: Math.abs(forward - back),
          grossForward: Math.max(forward, back),
          grossBack: Math.min(forward, back),
          groups,
          matches: ms,
        },
      ];
    })
    .sort((a, b) => b.netUsd - a.netUsd);
}
