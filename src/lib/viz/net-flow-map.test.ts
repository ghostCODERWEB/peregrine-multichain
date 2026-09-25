import { describe, it, expect } from 'vitest';
import { netFlowMap, chainNets } from './net-flow-map';

describe('netFlowMap', () => {
  const nets = [
    { chain: 'base', net: -70 }, { chain: 'arbitrum', net: -30 }, { chain: 'dust', net: -0.5 },
    { chain: 'robinhood', net: 60 }, { chain: 'ethereum', net: 20 }, { chain: 'solana', net: 0 },
  ];
  it('splits each seller’s measured outflow over buyers by their share of inflow', () => {
    const m = netFlowMap(nets, { pairs: 10 });
    expect(m.sellers.map((s) => s.chain)).toEqual(['base', 'arbitrum']); // dust below min, zero ignored
    expect(m.buyers.map((b) => b.chain)).toEqual(['robinhood', 'ethereum']);
    expect(m.totalOut).toBe(100);
    expect(m.totalIn).toBe(80);
    const baseOut = m.edges.filter((e) => e.from === 'base').reduce((s, e) => s + e.netUsd, 0);
    expect(baseOut).toBeCloseTo(70); // a seller's arcs sum to what it lost
    expect(m.edges[0]).toMatchObject({ from: 'base', to: 'robinhood' });
    expect(m.edges[0].netUsd).toBeCloseTo(52.5); // 70 × 60/80
  });
  it('keeps the largest pairs only, and draws nothing without both sides', () => {
    expect(netFlowMap(nets, { pairs: 2 }).edges).toHaveLength(2);
    expect(netFlowMap([{ chain: 'a', net: 5 }, { chain: 'b', net: 3 }]).edges).toEqual([]);
  });
});

describe('chainNets', () => {
  it('reads one window and skips perp venues', () => {
    const chains = [
      { chain: 'base', windows: [{ window: '1h', netFlowUsd: 1 }, { window: '24h', netFlowUsd: -5 }] },
      { chain: 'hyperliquid', windows: [{ window: '24h', netFlowUsd: 9 }] },
      { chain: 'sui', windows: [] },
    ];
    expect(chainNets(chains)).toEqual([{ chain: 'base', net: -5 }]);
  });
});
