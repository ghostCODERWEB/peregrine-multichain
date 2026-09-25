import { beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '@/server/nansen/db';
import { capitalFlows } from './bulletin';

// P3: the Capital Flows map reads chain-to-chain rotations from stored
// smart-money trades. Owner view only, and only the offered windows.
const now = Date.parse('2026-09-25T02:40:00Z');
const H = 3_600_000;
const trade = (wallet: string, chain: string, side: 'buy' | 'sell', usd: number, at: number, i: number) =>
  getDb().prepare('INSERT INTO smart_money_trades (chain, tx_hash, wallet, side, token_address, usd_value, traded_at, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(chain, `tx${i}`, wallet, side, `0x${String(i).padStart(40, '0')}`, usd, at, at);

describe('capitalFlows (P3)', () => {
  beforeEach(() => {
    getDb().exec('DELETE FROM smart_money_trades;');
    // Two wallets sell on Base, then buy on Robinhood within 12h: one rotation, ~30h ago.
    trade(`0x${'a'.repeat(40)}`, 'base', 'sell', 10_000, now - 32 * H, 1);
    trade(`0x${'a'.repeat(40)}`, 'robinhood', 'buy', 9_000, now - 30 * H, 2);
    trade(`0x${'b'.repeat(40)}`, 'base', 'sell', 6_000, now - 31 * H, 3);
    trade(`0x${'b'.repeat(40)}`, 'robinhood', 'buy', 6_000, now - 29 * H, 4);
  });

  it('gives public and member views nothing at all (redistribution rules)', () => {
    expect(capitalFlows('public', 48, now)).toBeNull();
  });

  it('matches the rotation only inside a window that covers it', () => {
    expect(capitalFlows('private', 24, now)!.fronts).toEqual([]);
    const f = capitalFlows('private', 48, now)!;
    expect(f.hours).toBe(48);
    expect(f.fronts).toHaveLength(1);
    expect(f.fronts[0]).toMatchObject({ from: 'base', to: 'robinhood', netUsd: 15_000, walletCount: 2, inferred: false });
    expect(f.fronts[0].provenance.calls[0].ref).toContain('trailing 48h');
  });

  it('only offers 24h, 48h and 7d; anything else falls back to 24h', () => {
    expect(capitalFlows('private', 168, now)!.hours).toBe(168);
    expect(capitalFlows('private', 1000, now)!.hours).toBe(24);
    expect(capitalFlows('private', Number.NaN, now)!.hours).toBe(24);
  });
});

describe('flowHistory (P4)', () => {
  it('is owner-only, returns one entry per day, and nets each chain in − out over the week', async () => {
    const { flowHistory } = await import('./bulletin');
    getDb().exec('DELETE FROM smart_money_trades;');
    const t = (w: string, c: string, s: 'buy' | 'sell', usd: number, at: number, i: number) => getDb().prepare('INSERT INTO smart_money_trades (chain, tx_hash, wallet, side, token_address, usd_value, traded_at, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(c, `h${i}`, w, s, `0x${String(i).padStart(40, '0')}`, usd, at, at);
    t(`0x${'a'.repeat(40)}`, 'base', 'sell', 10_000, now - 3 * 3_600_000, 1);
    t(`0x${'a'.repeat(40)}`, 'robinhood', 'buy', 9_000, now - 2 * 3_600_000, 2);
    t(`0x${'b'.repeat(40)}`, 'base', 'sell', 6_000, now - 3 * 3_600_000, 3);
    t(`0x${'b'.repeat(40)}`, 'robinhood', 'buy', 6_000, now - 2 * 3_600_000, 4);
    expect(flowHistory('public', 7, now)).toBeNull();
    const h = flowHistory('private', 7, now)!;
    expect(h.days).toHaveLength(7);
    expect(h.days.at(-1)).toMatchObject({ day: '2026-09-25', flows: 1, netUsd: 15_000, top: { from: 'base', to: 'robinhood' } });
    expect(h.days.slice(0, 6).every((d) => d.flows === 0)).toBe(true);
    // Days before the first stored trade are unknown, not quiet.
    expect(h.days[0].recorded).toBe(false);
    expect(h.days.at(-1)!.recorded).toBe(true);
    expect(h.chains.map((c) => [c.chain, c.net])).toEqual([['robinhood', 15_000], ['base', -15_000]]);
  });
});
