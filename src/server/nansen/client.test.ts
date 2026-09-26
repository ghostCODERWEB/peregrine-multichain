import { describe, it, expect, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';

const dir = await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-client-'));
  process.env.TIDE_DB_PATH = p.join(d, 'client.db');
  return d;
});

import { getDb } from './db';
import { wireBody, callNansen, NansenApiError, callScope, lastKnownCreditsRemaining, streamNansen, callNansenPoints, callNansenPointsPage } from './client';

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

  it('replays a recorded fixture in demo mode, and names a missing one', async () => {
    process.env.DEMO_MODE = '1';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(callNansen('tgm/holders', { never: 'recorded' })).rejects.toThrow(/No recorded fixture/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('streamNansen', () => {
  it('yields each agent event until [DONE], and records the call', async () => {
    const sse = 'data: {"type":"delta","text":"Hi"}\n\ndata: {"type":"tool_call","name":"x"}\n\ndata: [DONE]\n\n';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse, { status: 200, headers: { 'x-nansen-credits-cost': '200' } })));
    const out = [];
    for await (const e of streamNansen('agent/fast', { text: 'q' }, { record: false })) out.push(e);
    expect(out.map((e) => e.type)).toEqual(['delta', 'tool_call']);
    expect((getDb().prepare("SELECT credits FROM credit_ledger WHERE endpoint = 'agent/fast'").get() as { credits: number }).credits).toBe(200);
  });
  it('throws NansenApiError on a failed stream', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 402 })));
    const g = streamNansen('agent/fast', { text: 'q' });
    await expect(g.next()).rejects.toBeInstanceOf(NansenApiError);
  });
});

describe('points (keyless)', () => {
  it('validates the address, reads the tier and caches it; never sends a key', async () => {
    process.env.TIDE_PUBLIC_SITE = '1'; // no fixture recording into the repo
    await expect(callNansenPoints('bad')).rejects.toThrow(/wallet address/);
    const fetch = vi.fn(async () => res(200, { tier: 'ICE', points: 1200 }));
    vi.stubGlobal('fetch', fetch);
    const a = '0x' + 'b'.repeat(40);
    expect(await callNansenPoints(a)).toEqual({ tier: 'ice', points: 1200 });
    expect(await callNansenPoints(a)).toEqual({ tier: 'ice', points: 1200 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(fetch.mock.calls[0])).not.toContain('apikey');
  });
  it('reads a leaderboard page and refuses page 0', async () => {
    await expect(callNansenPointsPage(0)).rejects.toThrow(/out of range/);
    vi.stubGlobal('fetch', vi.fn(async () => res(200, { total: 5, results: [{ points: 10, rank: 1001, tier: 'green', is_eligible: true }] })));
    expect(await callNansenPointsPage(1)).toEqual({ total: 5, rows: [{ points: 10, rank: 1001, tier: 'green', eligible: true }] });
  });
});

describe('wire-level field renames', () => {
  it('sends wallet_address where Nansen renamed it, and leaves other endpoints alone', () => {
    expect(wireBody('profiler/address/pnl-summary', { address: '0xa', chain: 'all' })).toEqual({ wallet_address: '0xa', chain: 'all' });
    expect(wireBody('profiler/address/related-wallets', { address: '0xa' })).toEqual({ wallet_address: '0xa' });
    expect(wireBody('profiler/address/transactions', { address: '0xa' })).toEqual({ address: '0xa' });
  });
});
