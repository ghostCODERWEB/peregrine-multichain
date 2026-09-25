import { describe, it, expect, vi } from 'vitest';

const A = '0x' + '1'.repeat(40), B = '0x' + '2'.repeat(40);
const ROWS: Record<string, unknown[]> = {
  'tgm/perp-trades': [{ block_timestamp: '2026-09-25T10:00:00Z', trader_address: A, side: 'Long', action: 'Open', value_usd: 5e5, price_usd: 60000, type: 'MARKET', transaction_hash: '0xt' }],
  'tgm/perp-pnl-leaderboard': [{ trader_address: A, pnl_usd_total: 1e5, pnl_usd_realised: 6e4, roi_percent_total: 40, nof_trades: 12 }],
  'perp-leaderboard': [
    { trader_address: A, total_pnl: 2e5, realized_pnl_usd: 1.5e5, roi: 0.8, account_value: 1e6, top_positions: [{ coin: 'BTC', side: 'Long', position_value_usd: 5e5 }] },
    { trader_address: B, total_pnl: -1e4, roi: -0.1, account_value: 2e5 },
  ],
};
vi.mock('@/server/nansen/client', async (orig) => ({
  ...(await orig<typeof import('@/server/nansen/client')>()),
  callNansen: vi.fn(async (endpoint: string) => {
    if (!ROWS[endpoint]) throw new Error(`no ${endpoint}`);
    return { data: { data: ROWS[endpoint] }, meta: { cacheHit: false, creditsCost: 1 } };
  }),
}));
const { coinDetail, perpLeaders, SYMBOL_RE } = await import('./detail');

describe('perp detail (mocked Nansen)', () => {
  it('guards the symbol', () => {
    expect(SYMBOL_RE.test('BTC')).toBe(true);
    expect(SYMBOL_RE.test('<script>')).toBe(false);
  });
  it('reads the tape for everyone and the PnL board only in private', async () => {
    const pub = await coinDetail('BTC', false);
    expect(pub.pnl).toBeNull();
    expect(pub.tape).toMatchObject({ rows: [{ address: A, side: 'Long', valueUsd: 5e5, type: 'MARKET' }] });
    const priv = await coinDetail('BTC', true);
    expect(priv.pnl).toMatchObject({ rows: [{ address: A, pnlUsd: 1e5, roi: 40, trades: 12 }] });
  });
  it('ranks profitable, consistent traders first', async () => {
    const l = await perpLeaders();
    expect(l.rows.map((r) => r.address)).toEqual([A, B]);
    expect(l.rows[0].score).toBeGreaterThan(l.rows[1].score);
    expect(l.rows[0].positions[0]).toMatchObject({ coin: 'BTC', valueUsd: 5e5 });
  });
});
