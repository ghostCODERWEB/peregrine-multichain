import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/server/nansen/client', () => ({ callNansen: vi.fn() }));
import { createCall, deskScope, gradeDue, listCalls, deskSummary, MAX_OPEN } from './calls';
import { callNansen } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import { GET, POST } from '@/app/api/desk/route';

const T = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
const pub = { mode: 'public' as const, user: null, apiKey: null, keyLast4: null, keyPlan: null };
const owner = { ...pub, mode: 'owner' as const };
const meta = { cacheHit: false, creditsCost: 1, creditsUsed: null, creditsRemaining: null };
const candles = (...cs: Array<[number, number]>) => ({ data: { chain: 'base', token_address: T, timeframe: '1h', data: cs.map(([t, c]) => ({ interval_start: new Date(t).toISOString(), close: c, open: c, high: c, low: c })) }, meta });
const call = { chain: 'base', token: T, symbol: 'AERO', stance: 'bull' as const, horizon: '24h' as const, setup: 'smart-money flow' as const, thesis: 'SM buying into a flat price', invalidation: 0.6 };
const req = (method: string, body?: unknown, cookie?: string, origin?: string) => new Request('http://localhost/api/desk', { method, headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) }, body: body ? JSON.stringify(body) : undefined });
beforeEach(() => { getDb().exec('DELETE FROM calls'); vi.clearAllMocks(); vi.stubEnv('DEMO_MODE', '0'); vi.stubEnv('TIDE_DISPLAY_MODE', 'public'); });
afterEach(() => vi.unstubAllEnvs());

describe('call cards (L1)', () => {
  it('scopes a desk to the owner, a member, or a valid anonymous cookie only', () => {
    expect(deskScope(owner, null)).toBe('owner');
    expect(deskScope({ ...pub, user: { id: 7, family: 'evm', address: '0x' } as never }, 'x'.repeat(24))).toBe('user:7');
    expect(deskScope(pub, 'AbC_def-123456789012')).toBe('desk:AbC_def-123456789012');
    expect(deskScope(pub, 'short')).toBeNull();
    expect(deskScope(pub, null)).toBeNull();
  });
  it('saves the entry price with its receipt and what TIDE read then', async () => {
    const now = Date.now();
    vi.mocked(callNansen).mockResolvedValue(candles([now - 4 * 3_600_000, 0.7], [now - 1000, 0.72]) as never);
    const c = await createCall('owner', owner, call, now);
    expect(c).toMatchObject({ stance: 'bull', entry: 0.72, invalidation: 0.6, dueAt: now + 86_400_000, source: 'live', grade: null, symbol: 'AERO' });
    expect(c.entryReceipt).toMatchObject({ endpoint: 'tgm/token-ohlcv', served: 'live', credits: 1, excerpt: expect.stringContaining('close 0.72') });
    expect(vi.mocked(callNansen).mock.calls[0][1]).toMatchObject({ chain: 'base', token_address: T, timeframe: '4h' });
    expect(c.context).toHaveProperty('storm');
  });
  it('refuses an invalidation on the wrong side, and caps open calls', async () => {
    vi.mocked(callNansen).mockResolvedValue(candles([Date.now() - 1000, 0.72]) as never);
    await expect(createCall('owner', owner, { ...call, invalidation: 0.8 })).rejects.toThrow('below the entry');
    const insert = getDb().prepare("INSERT INTO calls (scope, chain, token, stance, horizon, setup, entry_price, entry_at, created_at, due_at, entry_receipt) VALUES ('owner','base',?, 'bull','24h','other',1,1,1,2,'{}')");
    for (let i = 0; i < MAX_OPEN; i++) insert.run(T);
    await expect(createCall('owner', owner, call)).rejects.toThrow(`${MAX_OPEN} open calls`);
  });
  it('grades a due call from candles for exactly its window, with a receipt', async () => {
    const t0 = Date.now() - 2 * 86_400_000;
    vi.mocked(callNansen).mockResolvedValueOnce(candles([t0 - 1000, 1]) as never);
    const c = await createCall('owner', owner, { ...call, invalidation: null }, t0);
    vi.mocked(callNansen).mockResolvedValueOnce(candles([t0 + 3_600_000, 1.01], [t0 + 20 * 3_600_000, 1.05]) as never);
    expect(await gradeDue('owner')).toEqual({ graded: 1, pending: 0 });
    expect(vi.mocked(callNansen).mock.calls[1][1]).toEqual({ chain: 'base', token_address: T, timeframe: '1h', date_range: { start: new Date(t0).toISOString(), end: new Date(t0 + 86_400_000).toISOString() } });
    const [g] = listCalls('owner');
    expect(g).toMatchObject({ id: c.id, grade: 'won', exit: 1.05, gradeReceipt: { endpoint: 'tgm/token-ohlcv', excerpt: expect.stringContaining('2 1h closes') } });
    expect(deskSummary('owner').dna.bySetup[0]).toMatchObject({ key: 'smart-money flow', won: 1, hitRate: 1 });
  });
  it('leaves a call open with a note when Nansen has no candles or fails', async () => {
    const t0 = Date.now() - 2 * 86_400_000;
    vi.mocked(callNansen).mockResolvedValueOnce(candles([t0 - 1000, 1]) as never);
    await createCall('owner', owner, { ...call, invalidation: null }, t0);
    vi.mocked(callNansen).mockResolvedValueOnce(candles() as never);
    expect(await gradeDue('owner')).toEqual({ graded: 0, pending: 1 });
    vi.mocked(callNansen).mockRejectedValueOnce(new Error('Nansen tgm/token-ohlcv responded 503'));
    await gradeDue('owner');
    expect(listCalls('owner')[0]).toMatchObject({ grade: null, gradeNote: expect.stringContaining('503') });
  });
  it('the route gives a public visitor an httpOnly desk cookie, and refuses cross-site or malformed calls', async () => {
    vi.mocked(callNansen).mockResolvedValue(candles([Date.now() - 1000, 0.72]) as never);
    expect((await POST(req('POST', { action: 'create', ...call }, undefined, 'https://elsewhere.invalid'))).status).toBe(403);
    expect((await POST(req('POST', { action: 'create', ...call, stance: 'moon' }))).status).toBe(400);
    expect((await POST(req('POST', { action: 'create', ...call, thesis: 'x'.repeat(201) }))).status).toBe(400);
    const r = await POST(req('POST', { action: 'create', ...call }));
    expect(r.status).toBe(200);
    const cookie = r.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^tide_desk=[A-Za-z0-9_-]{24}; Path=\/; HttpOnly; SameSite=Lax/);
    const mine = await (await GET(req('GET', undefined, cookie.split(';')[0]))).json();
    expect(mine.calls).toHaveLength(1);
    expect((await (await GET(req('GET'))).json()).calls).toHaveLength(0); // another browser sees nothing
  });
});
