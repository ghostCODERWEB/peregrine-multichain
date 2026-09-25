// Capital Flows (P3): lay out chain-to-chain rotations as a ring. Net
// sellers sit on the left arc, net buyers on the right, so every flow reads
// left → right the way money moves, and arcs bow through the middle.
// Pure geometry: the component only draws what this returns.

// Server and browser trig can differ in the last digit; rounding keeps the
// server-rendered SVG identical to the hydrated one.
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface FlowEdge { from: string; to: string; netUsd: number; walletCount: number; confidence: number }
export interface FlowNode { chain: string; x: number; y: number; angle: number; inUsd: number; outUsd: number; net: number; side: 'left' | 'right' }
export interface FlowArc { key: string; from: string; to: string; d: string; x1: number; y1: number; x2: number; y2: number; width: number; length: number; edge: FlowEdge }

const deg = (d: number) => (d * Math.PI) / 180;

/** Angles spread evenly over [a, b] (degrees, SVG convention: 0 = right, 90 = down). */
function spread(n: number, a: number, b: number): number[] {
  if (n === 1) return [(a + b) / 2];
  return Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
}

/** `ring`: the orbit radius as a share of the smaller side (narrow screens use a tighter ring). */
export function flowLayout(edges: FlowEdge[], w: number, h: number, ring = 0.4): { nodes: FlowNode[]; arcs: FlowArc[]; maxUsd: number } {
  const totals = new Map<string, { inUsd: number; outUsd: number }>();
  for (const e of edges) {
    const f = totals.get(e.from) ?? { inUsd: 0, outUsd: 0 };
    const t = totals.get(e.to) ?? { inUsd: 0, outUsd: 0 };
    f.outUsd += e.netUsd; t.inUsd += e.netUsd;
    totals.set(e.from, f); totals.set(e.to, t);
  }
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) * ring;
  const all = [...totals.entries()].map(([chain, v]) => ({ chain, ...v, net: v.inUsd - v.outUsd }));
  // Biggest sellers top-left down; biggest buyers top-right down. Ties keep a stable order.
  const left = all.filter((n) => n.net < 0).sort((a, b) => a.net - b.net || a.chain.localeCompare(b.chain));
  const right = all.filter((n) => n.net >= 0).sort((a, b) => b.net - a.net || a.chain.localeCompare(b.chain));
  const place = (list: typeof all, angles: number[], side: 'left' | 'right'): FlowNode[] =>
    list.map((n, i) => ({ ...n, side, angle: angles[i], x: r1(cx + R * Math.cos(deg(angles[i]))), y: r1(cy + R * Math.sin(deg(angles[i]))) }));
  const nodes = [
    ...place(left, spread(left.length, 235, 125), 'left'),
    ...place(right, spread(right.length, -55, 55), 'right'),
  ];
  const pos = new Map(nodes.map((n) => [n.chain, n]));
  const maxUsd = Math.max(1, ...edges.map((e) => e.netUsd));
  const nodeR = 24;
  const arcs = edges.flatMap((e): FlowArc[] => {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) return [];
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    // Leave from and arrive at the node's rim, not its centre.
    const x1 = a.x + ux * nodeR, y1 = a.y + uy * nodeR, x2 = b.x - ux * (nodeR + 4), y2 = b.y - uy * (nodeR + 4);
    // Bow toward the centre, more for chords that pass near it.
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const qx = mx + (cx - mx) * 0.45, qy = my + (cy - my) * 0.45;
    const length = Math.hypot(qx - x1, qy - y1) + Math.hypot(x2 - qx, y2 - qy);
    return [{
      key: `${e.from}>${e.to}`, from: e.from, to: e.to, edge: e, x1, y1, x2, y2, length,
      d: `M${x1.toFixed(1)},${y1.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`,
      width: 2 + 12 * Math.sqrt(e.netUsd / maxUsd),
    }];
  });
  return { nodes, arcs, maxUsd };
}

/** Particles per arc: more wallets, more traffic; bounded so the map stays legible. */
export const particleCount = (walletCount: number) => Math.max(2, Math.min(8, Math.round(walletCount / 2) + 1));
