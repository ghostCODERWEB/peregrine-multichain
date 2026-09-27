import { describe, it, expect } from 'vitest';
import { orbitalLayout, MAX_PER_SIDE } from './FlowOrbital';

const flow = (from: string, to: string, netUsd: number) => ({ from, to, netUsd, walletCount: 3 });

describe('orbitalLayout', () => {
  it('never places more than MAX_PER_SIDE chains a side, and draws at most five flows between shown chains', () => {
    const fronts = Array.from({ length: 8 }, (_, i) => flow(`s${i}`, `b${i}`, 100 - i));
    const { nodes, arcs } = orbitalLayout(fronts);
    expect(nodes.filter((n) => n.side === 'left')).toHaveLength(MAX_PER_SIDE);
    expect(nodes.filter((n) => n.side === 'right')).toHaveLength(MAX_PER_SIDE);
    expect(arcs.length).toBeLessThanOrEqual(5);
    expect(arcs.every((a) => nodes.some((n) => n.chain === a.from) && nodes.some((n) => n.chain === a.to))).toBe(true);
  });

  it('keeps nodes on a side far enough apart for a node and its two-line label, and inside the frame (460 × 330)', () => {
    for (let k = 1; k <= 6; k++) {
      const fronts = Array.from({ length: k * k }, (_, i) => flow(`s${i % k}`, `b${Math.floor(i / k)}`, 50 + (i % 7)));
      const { nodes } = orbitalLayout(fronts);
      for (const a of nodes) for (const b of nodes) {
        if (a === b || a.side !== b.side) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.chain}/${b.chain} k=${k}`).toBeGreaterThanOrEqual(60);
      }
      for (const n of nodes) { expect(n.x).toBeGreaterThanOrEqual(90); expect(n.x).toBeLessThanOrEqual(370); expect(n.y).toBeGreaterThanOrEqual(30); expect(n.y).toBeLessThanOrEqual(300); }
    }
  });

  it('connects every chain shown, even when its only flows are the smallest', () => {
    const fronts = [flow('tron', 'solana', 2215), flow('near', 'solana', 1239), flow('robinhood', 'solana', 494),
      flow('tron', 'ethereum', 425), flow('near', 'ethereum', 238), flow('tron', 'base', 219)];
    const { nodes, arcs } = orbitalLayout(fronts);
    expect(arcs).toHaveLength(5);
    for (const n of nodes) expect(arcs.some((a) => a.from === n.chain || a.to === n.chain), n.chain).toBe(true);
    expect(arcs[0]).toMatchObject({ from: 'tron', to: 'solana' }); // the lead arc is still the largest
  });

  it('starts and ends every arc at a node’s rim, never at its centre', () => {
    const { nodes, arcs } = orbitalLayout([flow('a', 'x', 10), flow('b', 'y', 8)]);
    for (const a of arcs) {
      const from = nodes.find((n) => n.chain === a.from)!, to = nodes.find((n) => n.chain === a.to)!;
      expect(Math.hypot(a.x1 - from.x, a.y1 - from.y)).toBeGreaterThanOrEqual(20);
      expect(Math.hypot(a.x2 - to.x, a.y2 - to.y)).toBeGreaterThanOrEqual(20);
    }
  });
});
