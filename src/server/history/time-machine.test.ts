import { describe, it, expect } from 'vitest';
import { compareHoldings } from './time-machine';

describe('time machine comparison', () => {
  it('joins by chain and token (case-insensitive), marks new and exited tokens, ranks by absolute change', () => {
    const rows = compareHoldings(
      [{ chain: 'base', token_address: '0xA', token_symbol: 'A', value_usd: 100, holders_count: 5, share_of_holdings_percent: 1 }, { chain: 'eth', token_address: '0xB', token_symbol: 'B', value_usd: 50, holders_count: 2, share_of_holdings_percent: 1 }],
      [{ chain: 'base', token_address: '0xa', token_symbol: 'A', value_usd: 130, holders_count: 7, share_of_holdings_percent: 1 }, { chain: 'eth', token_address: '0xC', token_symbol: 'C', value_usd: 80, holders_count: 1, share_of_holdings_percent: 1 }],
    );
    expect(rows.map((r) => [r.symbol, r.edge])).toEqual([['A', null], ['C', 'entered-top'], ['B', 'left-top']]);
    expect(rows[0]).toMatchObject({ deltaUsd: 30, thenHolders: 5, nowHolders: 7 });
    expect(rows[1].deltaPct).toBeNull();
  });
});
