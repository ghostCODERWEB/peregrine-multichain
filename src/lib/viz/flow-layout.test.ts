import { describe, it, expect } from 'vitest';
import { flowLayout, particleCount } from './flow-layout';

// The live 24h rotations of 2026-09-25 (from the owner's trade tape), rounded.
const edges = [
  { from: 'base', to: 'robinhood', netUsd: 50148, walletCount: 16, confidence: 1 },
  { from: 'base', to: 'ethereum', netUsd: 25246, walletCount: 3, confidence: 0.63 },
  { from: 'robinhood', to: 'ethereum', netUsd: 6444, walletCount: 11, confidence: 0.97 },
];

describe('capital flow layout (P3)', () => {
  it('puts net sellers on the left and net buyers on the right, with net = in − out', () => {
    const { nodes } = flowLayout(edges, 900, 560);
    const by = Object.fromEntries(nodes.map((n) => [n.chain, n]));
    expect(by.base.side).toBe('left');
    expect(by.base.net).toBe(-75394);
    expect(by.ethereum.side).toBe('right');
    expect(by.ethereum.net).toBe(31690);
    expect(by.robinhood.net).toBe(43704); // 50,148 in − 6,444 out
    expect(by.base.x).toBeLessThan(450);
    expect(by.ethereum.x).toBeGreaterThan(450);
  });
  it('draws one arc per rotation, widest for the largest, starting at the source rim', () => {
    const { arcs, nodes } = flowLayout(edges, 900, 560);
    expect(arcs.map((a) => a.key)).toEqual(['base>robinhood', 'base>ethereum', 'robinhood>ethereum']);
    expect(arcs[0].width).toBeGreaterThan(arcs[1].width);
    const base = nodes.find((n) => n.chain === 'base')!;
    expect(Math.hypot(arcs[0].x1 - base.x, arcs[0].y1 - base.y)).toBeCloseTo(24, 5);
    expect(arcs[0].d).toMatch(/^M[\d.]+,[\d.]+ Q[\d.]+,[\d.]+ [\d.]+,[\d.]+$/);
  });
  it('handles no rotations and bounds the particle count', () => {
    expect(flowLayout([], 900, 560)).toMatchObject({ nodes: [], arcs: [] });
    expect(particleCount(2)).toBe(2);
    expect(particleCount(16)).toBe(8);
    expect(particleCount(100)).toBe(8);
  });
});
