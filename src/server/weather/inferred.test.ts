import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/server/nansen/client', () => ({ callNansen: vi.fn() }));
import { fundingLinks, inferredWeather, refreshInferredWeather } from './inferred';
import { getDb, setKv } from '@/server/nansen/db';
import { callNansen } from '@/server/nansen/client';
import { contextScope } from '@/server/context';
import { POST } from '@/app/api/weather/inferred/route';

const owner = { mode: 'owner' as const, user: null, apiKey: null, keyLast4: null, keyPlan: null };
const subject = { address: `0x${'1'.repeat(40)}`, chain: 'base' };
const raw = (label = null as string | null, relation = 'First Funder') => ({ data: [{ address: `0x${'2'.repeat(40)}`, address_label: label, relation, chain: 'ethereum', block_timestamp: '2020-01-01T00:00:00Z', transaction_hash: 'synthetic-tx' }] });
beforeEach(() => { getDb().exec('DELETE FROM kv; DELETE FROM smart_money_trades;'); vi.clearAllMocks(); vi.stubEnv('DEMO_MODE', '0'); vi.stubEnv('TIDE_DISPLAY_MODE', 'public'); });
afterEach(() => vi.unstubAllEnvs());

describe('private funding evidence', () => {
  it('allows direct funding only, stripping labels and refusing service counterparties', () => {
    const parse = (data: unknown) => fundingLinks(subject, 'profiler/address/related-wallets', subject, data, Date.now());
    expect(parse(raw())).toHaveLength(1);
    expect(JSON.stringify(parse(raw('Private human label')))).not.toContain('Private human label');
    expect(parse(raw('Binance Exchange'))).toEqual([]);
    expect(parse(raw(null, 'Deployed by'))).toEqual([]);
    expect(parse({ data: [null, { chain: 'fake' }] })).toEqual([]);
  });
  it('withholds even metadata publicly, and expires private evidence', () => {
    setKv('weather:funding-evidence:v1', JSON.stringify({ at: 1, checked: 6, calls: 12, credits: 12, failures: 0, links: [] }));
    expect(inferredWeather('public')).toBeNull();
    expect(inferredWeather('private')).toMatchObject({ stale: true, fronts: [], links: 0 });
  });
  it('rejects public, cross-origin and unconfirmed paid actions before calls', async () => {
    const req = (body: unknown, origin?: string) => new Request('http://localhost/api/weather/inferred', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
    expect((await POST(req({ confirmCredits: 12 }))).status).toBe(403);
    vi.stubEnv('TIDE_DISPLAY_MODE', 'private');
    expect((await POST(req({ confirmCredits: 12 }, 'http://localhost:9999'))).status).toBe(403);
    expect((await POST(req({ confirmCredits: 1 }))).status).toBe(428);
    expect(callNansen).not.toHaveBeenCalled();
  });
  it('bounds the owner batch and refuses a second run within an hour', async () => {
    const now = Date.now();
    const insert = getDb().prepare('INSERT INTO smart_money_trades (chain, tx_hash, wallet, side, token_address, usd_value, traded_at, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (let n = 1; n <= 10; n++) insert.run('base', `test-${n}`, `0x${String(n).padStart(40, '0')}`, 'sell', 'test-token', 100, now - 1000, now);
    vi.mocked(callNansen).mockResolvedValue({ data: { data: [] }, meta: { cacheHit: false, creditsCost: 1, creditsUsed: null, creditsRemaining: null } });
    const result = await contextScope.run(owner, () => refreshInferredWeather(now));
    expect(result).toMatchObject({ checked: 6, calls: 12, credits: 12, fronts: [] });
    expect(callNansen).toHaveBeenCalledTimes(12);
    for (const c of vi.mocked(callNansen).mock.calls) expect(c[2]).toEqual({ record: false });
    await expect(contextScope.run(owner, () => refreshInferredWeather(now))).rejects.toThrow('once per hour');
    await expect(refreshInferredWeather(now)).rejects.toThrow('Only the instance owner');
  });
});
