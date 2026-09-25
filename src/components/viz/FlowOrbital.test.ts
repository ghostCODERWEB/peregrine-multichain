import { describe, it, expect } from 'vitest';
import { orbitalLayout, MAX_PER_SIDE } from './FlowOrbital';

const flow = (from: string, to: string, netUsd: number) => ({ from, to, netUsd, walletCount: 3 });

describe('orbitalLayout', () => {
  it('never places more than MAX_PER_SIDE chains a side, keeping the largest', () => {
    const fronts = Array.from({ length: 8 }, (_, i) => flow(`s${i}`, `b${i}`, 100 - i));
    const { nodes, flows } = orbitalLayout(fronts);
    expect(nodes).toHaveLength(2 * MAX_PER_SIDE);
    expect(nodes.map((n) => n.chain)).toEqual(expect.arrayContaining(['s0', 's1', 's2', 'b0', 'b1', 'b2']));
    expect(flows.every((f) => nodes.some((n) => n.chain === f.from) && nodes.some((n) => n.chain === f.to))).toBe(true);
  });

  it('keeps every pair of nodes far enough apart for a node and its label, for 1 to 6 chains a side', () => {
    for (let k = 1; k <= 6; k++) {
      const fronts = Array.from({ length: k * k }, (_, i) => flow(`s${i % k}`, `b${Math.floor(i / k)}`, 50 + (i % 7)));
      const { nodes } = orbitalLayout(fronts);
      for (const a of nodes) for (const b of nodes) {
        if (a === b) continue;
        // Node radius 20 + a 15px label below: 70 vertical clearance within a side, or far apart across.
        const sameSide = Math.sign(a.x - 220) === Math.sign(b.x - 220);
        if (sameSide) expect(Math.abs(a.y - b.y), `${a.chain}/${b.chain} k=${k}`).toBeGreaterThanOrEqual(70);
        else expect(Math.abs(a.x - b.x)).toBeGreaterThan(150);
      }
      // Everything stays inside the viewBox (440 × 340) with room for labels.
      for (const n of nodes) { expect(n.x).toBeGreaterThanOrEqual(40); expect(n.x).toBeLessThanOrEqual(400); expect(n.y + 40).toBeLessThanOrEqual(320); }
    }
  });
});
