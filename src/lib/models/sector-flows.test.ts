import { describe, it, expect } from 'vitest';
import { aggregateSectors, type ScreenerLikeRow } from './sector-flows';

const key = (chain: string, a: string) => `${chain}:${a.startsWith('0x') ? a.toLowerCase() : a}`;
const row = (chain: string, token_address: string, token_symbol: string, netflow: number, volume: number): ScreenerLikeRow => ({ chain, token_address, token_symbol, netflow, volume });

const membership = new Map<string, string[]>([
  [key('base', '0xA'), ['AI Agents']],
  [key('base', '0xb'), ['AI Agents', 'Memecoin']],
  [key('solana', 'Mem3'), ['Memecoin']],
  [key('base', '0xusdc'), ['Stablecoin']],
]);

describe('sector flows', () => {
  const market = [
    row('base', '0xa', 'AGNT', 500, 10_000),
    row('base', '0xb', 'BOTS', -200, 4_000),
    row('solana', 'Mem3', 'WIF', -1_000, 20_000),
    row('solana', 'unknown', 'XYZ', 50, 1_000),
    row('base', '0xusdc', 'USDC', 9_999, 99_999),
  ];

  it('sums net flow and volume over each sector’s own tokens; a multi-sector token counts toward each', () => {
    const a = aggregateSectors(market, market, membership, key);
    const by = Object.fromEntries(a.sectors.map((s) => [s.sector, s]));
    expect(by['AI Agents']).toMatchObject({ netFlowUsd: 300, volumeUsd: 14_000, tokens: 2 });
    expect(by.Memecoin).toMatchObject({ netFlowUsd: -1_200, volumeUsd: 24_000, tokens: 2 });
    expect(by.Stablecoin).toBeUndefined(); // stablecoins skipped, as in the CPI
    expect(a.classified).toBe(3);
    expect(a.unclassified).toBe(1);
  });

  it('keeps the top movers each way', () => {
    const a = aggregateSectors(market, market, membership, key);
    const mem = a.sectors.find((s) => s.sector === 'Memecoin')!;
    expect(mem.top.inflows).toEqual([]);
    expect(mem.top.outflows.map((m) => m.symbol)).toEqual(['WIF', 'BOTS']); // largest outflow first
  });

  it('smart-money numerator over all-trader volume on the same chains only', () => {
    const sm = [row('base', '0xA', 'AGNT', 80, 0)]; // base only
    const a = aggregateSectors(sm, market, membership, key);
    const ai = a.sectors.find((s) => s.sector === 'AI Agents')!;
    expect(ai.netFlowUsd).toBe(80);
    expect(ai.volumeUsd).toBe(14_000); // base AI volume; Solana rows excluded
    expect(a.sectors.find((s) => s.sector === 'Memecoin')?.volumeUsd).toBe(4_000); // only base's BOTS
  });

  it('matches EVM addresses case-insensitively but base58 exactly', () => {
    const a = aggregateSectors([row('solana', 'mem3', 'WIF', 5, 5)], [], membership, key);
    expect(a.unclassified).toBe(1);
  });
});
