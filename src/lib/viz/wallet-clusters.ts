// Groups a wallet ↔ market graph into clusters of wallets that hold the same
// pattern (e.g. long BTC perp and short ETH perp), and places them: markets on
// a ring, each cluster between the markets it touches, pushed apart so no two
// overlap, its wallets packed inside it. Pure, so the layout is the same on
// every render and testable.
import type { GraphLink, GraphNode } from '@/server/graph/series';

export const bullish = (side: string) => side === 'long' || side === 'bought';

export interface Cluster {
  id: string; key: string; label: string; wallets: GraphNode[]; value: number; sm: number;
  ties: Array<{ market: string; side: 'up' | 'down'; value: number }>;
  x: number; y: number; r: number;
}
export interface ClusterLayout {
  markets: Array<GraphNode & { x: number; y: number }>;
  clusters: Cluster[];
  wallets: Array<GraphNode & { x: number; y: number; cluster: string }>;
}

export function clusterGraph(nodes: GraphNode[], links: GraphLink[]): ClusterLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const markets = nodes.filter((n) => n.kind !== 'wallet').sort((a, b) => b.value - a.value);
  // One direction per wallet per market: the larger side wins when both appear.
  const pos = new Map<string, Map<string, number>>();
  for (const l of links) {
    const m = pos.get(l.source) ?? new Map<string, number>();
    m.set(l.target, (m.get(l.target) ?? 0) + (bullish(l.side) ? l.value : -l.value));
    pos.set(l.source, m);
  }
  const groups = new Map<string, { wallets: GraphNode[]; ties: Map<string, { side: 'up' | 'down'; value: number }> }>();
  for (const [w, m] of pos) {
    const node = byId.get(w);
    if (!node) continue;
    const sig = [...m.entries()].map(([k, v]) => [k, v >= 0 ? 'up' : 'down'] as const).sort((a, b) => a[0].localeCompare(b[0]));
    const key = sig.map(([k, s]) => `${k}:${s}`).join('|');
    const g = groups.get(key) ?? { wallets: [] as GraphNode[], ties: new Map<string, { side: 'up' | 'down'; value: number }>() };
    g.wallets.push(node);
    for (const [k, v] of m) {
      const t = g.ties.get(k) ?? { side: v >= 0 ? 'up' as const : 'down' as const, value: 0 };
      t.value += Math.abs(v);
      g.ties.set(k, t);
    }
    groups.set(key, g);
  }

  // Markets on a ring (two markets: left and right).
  const R = 100;
  const mPos = new Map<string, { x: number; y: number }>();
  markets.forEach((m, i) => {
    const a = markets.length === 2 ? Math.PI * i : -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, markets.length);
    mPos.set(m.id, { x: (markets.length === 1 ? 0 : R * Math.cos(a)), y: markets.length === 1 ? 0 : R * Math.sin(a) });
  });
  const name = (id: string) => byId.get(id)?.name ?? id;
  const maxN = Math.max(1, ...[...groups.values()].map((g) => g.wallets.length));

  const clusters: Cluster[] = [...groups.entries()].map(([key, g], i) => {
    const ties = [...g.ties.entries()].map(([market, t]) => ({ market, ...t })).sort((a, b) => b.value - a.value);
    const ups = ties.filter((t) => t.side === 'up').map((t) => name(t.market)), downs = ties.filter((t) => t.side === 'down').map((t) => name(t.market));
    const label = [ups.length ? `Long ${ups.join(' + ')}` : '', downs.length ? `Short ${downs.join(' + ')}` : ''].filter(Boolean).join(' · ');
    // Centroid of its markets, weighted by money; then nudged by direction so
    // bullish and bearish groups on the same markets sit apart.
    let x = 0, y = 0, wsum = 0;
    for (const t of ties) { const p = mPos.get(t.market); if (p) { x += p.x * t.value; y += p.y * t.value; wsum += t.value; } }
    x /= wsum || 1; y /= wsum || 1;
    return {
      id: `c:${i}`, key, label, wallets: g.wallets.sort((a, b) => b.value - a.value), ties,
      value: g.wallets.reduce((s, w) => s + w.value, 0), sm: g.wallets.filter((w) => w.sm).length,
      x, y, r: 12 + 20 * Math.sqrt(g.wallets.length / maxN),
    };
  }).sort((a, b) => b.value - a.value);

  // Clusters on an outer ring, each at the angle of its markets (bullish
  // groups lean up, bearish down), then spread so neighbours never overlap.
  const RING = R * 2.1;
  const ang = clusters.map((c) => {
    const lean = (c.ties.filter((t) => t.side === 'up').length - c.ties.filter((t) => t.side === 'down').length) / Math.max(1, c.ties.length);
    const bx = c.x, by = c.y - lean * 40;
    return { c, a: Math.hypot(bx, by) < 5 ? (lean >= 0 ? -Math.PI / 2 : Math.PI / 2) : Math.atan2(by, bx) };
  }).sort((p, q) => p.a - q.a);
  // Even spacing in that order, rotated to sit as close as it can to where each cluster wants to be.
  const n = ang.length, step = (2 * Math.PI) / Math.max(1, n);
  const off = Math.atan2(ang.reduce((t, x, i) => t + Math.sin(x.a - i * step), 0), ang.reduce((t, x, i) => t + Math.cos(x.a - i * step), 0));
  ang.forEach((x, i) => { x.a = off + i * step; });
  // The ring grows until neighbours clear each other.
  const ringR = Math.max(RING, ...ang.map((x, i) => (x.c.r + ang[(i + 1) % n].c.r + 34) / (2 * Math.sin(Math.min(Math.PI / 2, step / 2)))));
  for (const { c, a } of ang) { c.x = ringR * Math.cos(a); c.y = ringR * Math.sin(a); }

  // Wallets packed inside their cluster on a sunflower spiral.
  const wallets = clusters.flatMap((c) => c.wallets.map((w, j) => {
    if (c.wallets.length === 1) return { ...w, x: c.x, y: c.y, cluster: c.id };
    const rr = (c.r - 4) * Math.sqrt((j + 0.5) / c.wallets.length), a = j * 2.39996;
    return { ...w, x: c.x + rr * Math.cos(a), y: c.y + rr * Math.sin(a), cluster: c.id };
  }));
  return { markets: markets.map((m) => ({ ...m, ...mPos.get(m.id)! })), clusters, wallets };
}
