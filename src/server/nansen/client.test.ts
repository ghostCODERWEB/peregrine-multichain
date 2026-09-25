import { describe, it, expect, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';

const dir = await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-client-'));
  process.env.TIDE_DB_PATH = p.join(d, 'client.db');
  return d;
});

import { getDb } from './db';
import { callNansen, NansenApiError, callScope, lastKnownCreditsRemaining } from './client';

const ENV = { ...process.env };
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => { getDb().exec('DELETE FROM credit_ledger; DELETE FROM response_cache;'); Object.assign(process.env, { NANSEN_API_KEY: 'k', DEMO_MODE: '' }); });
afterEach(() => { process.env = { ...ENV }; vi.unstubAllGlobals(); vi.useRealTimers(); });
const res = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });

describe('callNansen', () => {
  it('sends the key in the apikey header, records credits and the balance, and caches', async () => {
    const fetch = vi.fn(async () => res(200, { data: [1] }, { 'x-nansen-credits-cost': '5', 'x-nansen-credits-remaining': '900' }));
    vi.stubGlobal('fetch', fetch);
    const tally = { calls: 0, credits: 0, cached: 0 };
    const r = await callScope.run(tally, () => callNansen<{ data: number[] }>('tgm/holders', { a: 1 }, { record: false }));
    expect(r.data.data).toEqual([1]);
    expect(r.meta.creditsCost).toBe(5);
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ apikey: 'k' });
    expect(lastKnownCreditsRemaining()).toBe(900);
    const again = await callScope.run(tally, () => callNansen('tgm/holders', { a: 1 }, { record: false }));
    expect(again.meta.cacheHit).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(tally).toEqual({ calls: 2, credits: 5, cached: 1 });
    expect((getDb().prepare('SELECT SUM(credits) AS c FROM credit_ledger').get() as { c: number }).c).toBe(5);
  });

  it('retries a 429 after Retry-After, and a 5xx with backoff', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn()
      .mockResolvedValueOnce(res(429, 'slow down', { 'retry-after': '1' }))
      .mockResolvedValueOnce(res(503, 'busy'))
      .mockResolvedValueOnce(res(200, { ok: true }));
    vi.stubGlobal('fetch', fetch);
    const p = callNansen('tgm/indicators', { b: 1 }, { record: false, skipCache: true });
    await vi.runAllTimersAsync();
    await expect(p).resolves.toMatchObject({ data: { ok: true } });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('throws NansenApiError with the status and parsed body, and refuses without a key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(400, { error: 'bad chain' })));
    const e = await callNansen('tgm/holders', { c: 1 }, { record: false }).catch((x) => x);
    expect(e).toBeInstanceOf(NansenApiError);
    expect(e).toMatchObject({ status: 400, body: { error: 'bad chain' } });
    process.env.NANSEN_API_KEY = '';
    await expect(callNansen('tgm/holders', { d: 1 }, { record: false })).rejects.toThrow(/NANSEN_API_KEY is not set/);
  });

  it('validates the response shape when a schema is given', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(200, { data: 'not an array' })));
    const { z } = await import('zod');
    await expect(callNansen('tgm/holders', { e: 1 }, { record: false, schema: z.object({ data: z.array(z.number()) }) })).rejects.toThrow();
  });
});
