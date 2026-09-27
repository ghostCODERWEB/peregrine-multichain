import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/server/nansen/db';
import { ensureCascadeTable } from './backfill';
import { computeCascades } from './cascades';

// vitest.setup.ts supplies a throwaway database; never use the live tape.
const now = 1_800_000_000_000;
function insert(chain: string, token: string, tx = 'same-tx') {
  getDb().prepare(`INSERT INTO smart_money_trades
    (chain, tx_hash, wallet, side, token_address, usd_value, traded_at, captured_at)
    VALUES (?, ?, 'wallet', 'buy', ?, 1000, ?, ?)`).run(chain, tx, token, now - 1000, now);
}

describe('cascade SQL identity', () => {
  beforeEach(() => {
    ensureCascadeTable();
    getDb().exec('DELETE FROM smart_money_trades; DELETE FROM cascade_trades;');
  });

  it('keeps distinct base58 tokens even with matching transaction and wallet', () => {
    const mint = 'AbcDEFGHJKLMNPQRSTUVWXYZ123456789abc';
    insert('solana', mint);
    insert('solana', mint.toLowerCase());
    expect(computeCascades({ now }).trades).toBe(2);
  });

  it('deduplicates EVM casing but never merges matching trades across chains', () => {
    const token = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    insert('base', token);
    insert('base', token.toUpperCase());
    insert('ethereum', token);
    expect(computeCascades({ now }).trades).toBe(2);
  });
});
