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

type NetChain = { chain: string; source?: string | null; windows: Array<{ window: string; netFlowUsd: number }> };

function readNets(chains: NetChain[], window: string, skip: string[]): Array<ChainNet & { source: string | null }> {
  return chains.flatMap((c) => {
    if (skip.includes(c.chain)) return [];
    const w = c.windows.find((x) => x.window === window);
    return w && Number.isFinite(w.netFlowUsd) ? [{ chain: c.chain, net: w.netFlowUsd, source: c.source ?? null }] : [];
  });
}

/** A chain reading's measured net flow in one window. Perp venues are left
 *  out: their flow is positioning, not spot capital. Only like is ranked with
 *  like: when any chain carries a Smart Money reading, chains measured only
 *  from all-trader flow are left out (see `otherNets`), since a market-wide
 *  total dwarfs a Smart Money one and would read as the bigger move. */
export function chainNets(chains: NetChain[], window = '24h', skip = ['hyperliquid']): ChainNet[] {
  const all = readNets(chains, window, skip);
  const sm = all.some((n) => n.source === 'smart-money');
  return all.filter((n) => !sm || n.source === 'smart-money').map(({ chain, net }) => ({ chain, net }));
}

/** The chains `chainNets` leaves out: measured from all-trader flow only, while others have Smart Money readings. */
export function otherNets(chains: NetChain[], window = '24h', skip = ['hyperliquid']): ChainNet[] {
  const all = readNets(chains, window, skip);
  if (!all.some((n) => n.source === 'smart-money')) return [];
  return all.filter((n) => n.source !== 'smart-money').map(({ chain, net }) => ({ chain, net }));
}
