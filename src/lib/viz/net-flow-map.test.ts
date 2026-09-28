import { describe, it, expect } from 'vitest';
import { netFlowMap, chainNets, allTraderOnly } from './net-flow-map';

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
    expect(netFlowMap(nets, { pairs: 3 }).edges).toHaveLength(3);
    expect(netFlowMap([{ chain: 'a', net: 5 }, { chain: 'b', net: 3 }]).edges).toEqual([]);
  });
});

describe('netFlowMap connections', () => {
  it('connects every chain shown, even the smallest', () => {
    // 3×3 = 9 arcs trimmed to 6: base's arcs are the three smallest.
    const m = netFlowMap([
      { chain: 'tron', net: -2860 }, { chain: 'near', net: -1600 }, { chain: 'robinhood', net: -638 },
      { chain: 'solana', net: 685.6 }, { chain: 'ethereum', net: 131.7 }, { chain: 'base', net: 67.8 },
    ], { sellers: 3, buyers: 3, pairs: 6 });
    expect(m.edges).toHaveLength(6);
    for (const n of [...m.sellers, ...m.buyers]) {
      expect(m.edges.some((e) => e.from === n.chain || e.to === n.chain)).toBe(true);
    }
    expect(m.edges.find((e) => e.to === 'base')).toMatchObject({ from: 'tron' });
  });
  it('goes past pairs only when every chain needs its own arc', () => {
    expect(netFlowMap(nets4(), { pairs: 1 }).edges).toHaveLength(3);
  });
});

function nets4() {
  return [{ chain: 'a', net: -70 }, { chain: 'b', net: -30 }, { chain: 'x', net: 60 }, { chain: 'y', net: 20 }];
}

describe('chainNets', () => {
  it('reads one window and skips perp venues', () => {
    const chains = [
      { chain: 'base', windows: [{ window: '1h', netFlowUsd: 1 }, { window: '24h', netFlowUsd: -5 }] },
      { chain: 'hyperliquid', windows: [{ window: '24h', netFlowUsd: 9 }] },
      { chain: 'sui', windows: [] },
    ];
    expect(chainNets(chains)).toEqual([{ chain: 'base', net: -5 }]);
  });
  it('compares Smart Money readings only with each other, and skips readings built from no tokens', () => {
    const w = (net: number, tokenCount = 5) => [{ window: '24h', netFlowUsd: net, tokenCount }];
    const chains = [
      { chain: 'solana', source: 'smart-money', windows: w(187_000) },
      { chain: 'base', source: 'smart-money', windows: w(128_000) },
      { chain: 'avalanche', source: 'smart-money', windows: w(0, 0) },
      { chain: 'near', source: 'market-flow', windows: w(-32_000_000) },
    ];
    expect(chainNets(chains)).toEqual([{ chain: 'solana', net: 187_000 }, { chain: 'base', net: 128_000 }]);
    expect(allTraderOnly(chains)).toEqual([{ chain: 'near', net: -32_000_000 }]);
  });
  it('uses every reading when all come from one source', () => {
    const w = (net: number) => [{ window: '24h', netFlowUsd: net, tokenCount: 3 }];
    const chains = [{ chain: 'near', source: 'market-flow', windows: w(-10) }, { chain: 'ton', source: 'market-flow', windows: w(4) }];
    expect(chainNets(chains)).toEqual([{ chain: 'near', net: -10 }, { chain: 'ton', net: 4 }]);
    expect(allTraderOnly(chains)).toEqual([]);
  });
  it('skips a chain that arrives without its readings instead of failing the page', () => {
    const chains = [{ chain: 'base', windows: [{ window: '24h', netFlowUsd: 4 }] }, { chain: 'ton' } as unknown as { chain: string; windows: [] }];
    expect(chainNets(chains)).toEqual([{ chain: 'base', net: 4 }]);
    expect(allTraderOnly(chains)).toEqual([]);
  });
});
