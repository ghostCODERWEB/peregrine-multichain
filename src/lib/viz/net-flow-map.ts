// The public Capital Flows map. Wallet-level rotations (the same wallets
// selling on one chain and buying on another) come from smart-money trades,
// which Nansen keeps out of public views. What a public view may show is each
// chain's measured market-wide net flow. This draws those numbers as a map:
// chains losing net flow on the left, chains gaining it on the right, and
// each arc a MODELED share. The arc from A to B is A's measured outflow times
// B's share of the measured inflow, so every seller's arcs sum to what it lost.
// The nodes are measured; the arcs are an allocation, never tracked wallets,
// and the UI says so.
import type { FlowEdge } from './flow-layout';

export interface ChainNet { chain: string; net: number }
export interface NetFlowMap {
  edges: FlowEdge[];
  sellers: ChainNet[];
  buyers: ChainNet[];
  /** Measured net outflow of the sellers shown, and inflow of the buyers shown. */
  totalOut: number;
  totalIn: number;
}

/** Chains' measured net flow → modeled arcs between the top `sellers` and top
 *  `buyers`: each chain's largest arc, then the largest others up to `pairs`
 *  in all (more only when every chain needs its own). `min` drops noise. */
export function netFlowMap(nets: ChainNet[], opts: { sellers?: number; buyers?: number; pairs?: number; min?: number } = {}): NetFlowMap {
  const { sellers: ns = 4, buyers: nb = 4, pairs = 7, min = 1 } = opts;
  const clean = nets.filter((n) => Number.isFinite(n.net) && Math.abs(n.net) >= min);
  const sellers = clean.filter((n) => n.net < 0).sort((a, b) => a.net - b.net).slice(0, ns);
  const buyers = clean.filter((n) => n.net > 0).sort((a, b) => b.net - a.net).slice(0, nb);
  const totalOut = sellers.reduce((s, n) => s - n.net, 0);
  const totalIn = buyers.reduce((s, n) => s + n.net, 0);
  if (!sellers.length || !buyers.length) return { edges: [], sellers, buyers, totalOut, totalIn };
  const all: FlowEdge[] = sellers.flatMap((s) => buyers.map((b) => ({
    from: s.chain, to: b.chain, netUsd: (-s.net * b.net) / totalIn, walletCount: 0, confidence: 1,
  })));
  all.sort((a, b) => b.netUsd - a.netUsd);
  // Every chain shown keeps its largest arc, so a small buyer or seller is
  // never left floating; the rest of the `pairs` budget goes by size.
  const keep = new Set<FlowEdge>();
  for (const n of [...sellers, ...buyers]) {
    const top = all.find((e) => e.from === n.chain || e.to === n.chain);
    if (top) keep.add(top);
  }
  for (const e of all) { if (keep.size >= pairs) break; keep.add(e); }
  const edges = all.filter((e) => keep.has(e));
  return { edges, sellers, buyers, totalOut, totalIn };
}

type NetInput = { chain: string; source?: string | null; windows: Array<{ window: string; netFlowUsd: number; tokenCount?: number }> };

/** A chain reading's measured net flow in one window (the public view's is
 *  all-trader market flow). Perp venues are left out: their flow is
 *  positioning, not spot capital. A reading built from no tokens is left out
 *  too: it means nothing was measured, not that the chain was flat.
 *  Chains are read from different sources (Smart Money where Nansen covers the
 *  chain, all traders elsewhere), and all-trader dollars dwarf Smart Money's.
 *  So when Smart Money readings exist, only they are compared. */
export function chainNets(chains: NetInput[], window = '24h', skip = ['hyperliquid']): ChainNet[] {
  const rows = measured(chains, window, skip);
  const sm = rows.filter((r) => r.source === 'smart-money');
  return (sm.length >= 2 ? sm : rows).map(({ chain, net }) => ({ chain, net }));
}

/** Chains measured only from all traders while others have Smart Money, so chainNets leaves them out of the comparison. */
export function allTraderOnly(chains: NetInput[], window = '24h', skip = ['hyperliquid']): ChainNet[] {
  const rows = measured(chains, window, skip);
  return rows.filter((r) => r.source === 'smart-money').length >= 2 ? rows.filter((r) => r.source !== 'smart-money').map(({ chain, net }) => ({ chain, net })) : [];
}

function measured(chains: NetInput[], window: string, skip: string[]) {
  return chains.flatMap((c) => {
    if (skip.includes(c.chain)) return [];
    const w = c.windows?.find((x) => x.window === window);
    return w && Number.isFinite(w.netFlowUsd) && w.tokenCount !== 0 ? [{ chain: c.chain, net: w.netFlowUsd, source: c.source ?? null }] : [];
  });
}
