import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/server/nansen/client', () => ({ callNansen: vi.fn() }));
import { followCandidates, runFollow, cachedFollow, FOLLOW_CREDITS } from './follow';
import { callNansen } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import { GET, POST } from '@/app/api/follow/route';

const T0 = '0xb3b32f9f8827d4634fe7d973fa1034ec9fddb3b3', M = 60_000, H = 3_600_000;
const now = Date.now();
const meta = { cacheHit: false, creditsCost: 1, creditsUsed: null, creditsRemaining: null };
const trade = (t: number, wallet: string, action = 'BUY') => ({ block_timestamp: new Date(t).toISOString(), trader_address: wallet, action, estimated_value_usd: 100 });
const insert = (t: number, wallet: string, usd: number, side = 'buy', token = T0) => getDb().prepare('INSERT INTO smart_money_trades (chain, tx_hash, wallet, wallet_label, side, token_address, usd_value, traded_at, captured_at) VALUES (?,?,?,?,?,?,?,?,?)')
  .run('base', `tx-${t}-${wallet}`, wallet, 'Smart Trader', side, token, usd, t, t);
const req = (method: string, body?: unknown, origin?: string) => new Request(`http://localhost/api/follow${method === 'GET' ? `?chain=base&token=${T0}` : ''}`, { method, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: body ? JSON.stringify(body) : undefined });
beforeEach(() => { getDb().exec('DELETE FROM smart_money_trades; DELETE FROM kv;'); vi.clearAllMocks(); vi.stubEnv('DEMO_MODE', '0'); vi.stubEnv('TIDE_DISPLAY_MODE', 'private'); });
afterEach(() => vi.unstubAllEnvs());

describe('smart-money follow-through (L4)', () => {
  it('takes events from the stored smart-money tape only: buys, ≥ $250, last 7 days, after-window complete', () => {
    const e = now - 30 * H;
    insert(e, '0xaa', 1000); insert(e + 5 * M, '0xbb', 400); insert(e + H, '0xcc', 100); insert(e + 2 * H, '0xdd', 900, 'sell');
    insert(now - 5 * M, '0xee', 5000); insert(now - 8 * 86_400_000, '0xff', 5000);
    const c = followCandidates('base', T0, now);
    expect(c.events).toEqual([{ t: e, wallets: ['0xaa', '0xbb'], usd: 1400, buys: 2 }]);
    expect(c.labels.get('0xaa')).toBe('Smart Trader');
  });
  it('reads exact before/after windows, stops at two pages, and grades on covered minutes', async () => {
    const e = now - 30 * H;
    insert(e, '0xaa', 1000);
    vi.mocked(callNansen).mockImplementation(async (ep, body) => {
      if (ep === 'tgm/token-ohlcv') return { data: { data: Array.from({ length: 40 }, (_, i) => ({ interval_start: new Date(e - 2 * H + i * H).toISOString(), close: 1 + i / 100 })) }, meta } as never;
      const b = body as { date: { from: string }; pagination: { page: number } };
      const from = Date.parse(b.date.from);
      if (from < e) return { data: { data: [trade(e - 8 * M, '0x01')], pagination: { is_last_page: true } }, meta } as never; // before: one buyer in 10 min
      // after: a busy tape, two full pages, never the last page
      const rows = Array.from({ length: 100 }, (_, i) => trade(e + (b.pagination.page - 1) * 60_000 + i * 600, `0x${(b.pagination.page * 100 + i).toString(16)}`));
      return { data: { data: rows, pagination: { is_last_page: false } }, meta } as never;
    });
    const r = await runFollow('base', T0, now);
    const bodies = vi.mocked(callNansen).mock.calls.filter(([ep]) => ep === 'tgm/dex-trades').map(([, b]) => b as { date: { from: string; to: string }; pagination: { page: number } });
    expect(bodies.map((b) => [b.date.from, b.date.to, b.pagination.page])).toEqual([
      [new Date(e - 10 * M).toISOString(), new Date(e).toISOString(), 1],
      [new Date(e).toISOString(), new Date(e + 10 * M).toISOString(), 1],
      [new Date(e).toISOString(), new Date(e + 10 * M).toISOString(), 2],
    ]);
    for (const [, , opts] of vi.mocked(callNansen).mock.calls) expect(opts).toMatchObject({ record: false });
    const [ev] = r.results;
    expect(ev.after.truncated).toBe(true);
    expect(ev.verdict).toBe('followed');
    expect(ev.outcome).toMatchObject({ from: expect.any(Number), to: expect.any(Number) });
    expect(r.credits).toBe(4);
    expect(r.notes.join(' ')).toMatch('cut at 200 trades');
    expect(ev.labels).toEqual(['Smart Trader']);
    expect(cachedFollow('base', T0, now)?.results).toHaveLength(1);
  });
  it('refuses when the tape has no smart-money buys, before any call', async () => {
    await expect(runFollow('base', T0, now)).rejects.toThrow('No smart-money buys');
    expect(callNansen).not.toHaveBeenCalled();
  });
  it('the route is owner-only and priced: public 403, cross-site 403, unconfirmed 428, before any call', async () => {
    vi.stubEnv('TIDE_DISPLAY_MODE', 'public');
    expect((await GET(req('GET'))).status).toBe(403);
    expect((await POST(req('POST', { chain: 'base', token: T0, confirmCredits: FOLLOW_CREDITS }))).status).toBe(403);
    vi.stubEnv('TIDE_DISPLAY_MODE', 'private');
    expect((await POST(req('POST', { chain: 'base', token: T0, confirmCredits: FOLLOW_CREDITS }, 'https://elsewhere.invalid'))).status).toBe(403);
    expect((await POST(req('POST', { chain: 'base', token: T0, confirmCredits: 1 }))).status).toBe(428);
    expect(callNansen).not.toHaveBeenCalled();
    const g = await (await GET(req('GET'))).json();
    expect(g).toMatchObject({ candidates: { events: 0, buys: 0 }, report: null, maxCredits: FOLLOW_CREDITS });
  });
});
