import { describe, it, expect, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';

const dir = await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-site-'));
  process.env.TIDE_DB_PATH = p.join(d, 'site.db');
  return d;
});

import { getDb } from './nansen/db';
import { recordCall, webCreditsToday } from './nansen/ledger';
import { writeCache } from './nansen/cache';
import { callNansen } from './nansen/client';
import { accountsEnabled, publicSite, utcDayStart, DailyBudgetExhausted } from './site';

const ENV = { ...process.env };
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => { getDb().exec('DELETE FROM credit_ledger; DELETE FROM response_cache;'); });
afterEach(() => { process.env = { ...ENV }; vi.unstubAllGlobals(); });

describe('public-site switches', () => {
  it('turns accounts off with the site flag, or on their own', () => {
    expect(publicSite()).toBe(false);
    expect(accountsEnabled()).toBe(true);
    process.env.TIDE_ACCOUNTS = 'off';
    expect(accountsEnabled()).toBe(false);
    delete process.env.TIDE_ACCOUNTS;
    process.env.TIDE_PUBLIC_SITE = '1';
    expect(publicSite()).toBe(true);
    expect(accountsEnabled()).toBe(false);
  });
  it('resets the budget at 00:00 UTC', () => {
    expect(utcDayStart(Date.UTC(2026, 8, 25, 23, 59))).toBe(Date.UTC(2026, 8, 25));
  });
});

describe('fixtures', () => {
  it('a public site never records demo fixtures', async () => {
    const demo = await import('./nansen/demo');
    const spy = vi.spyOn(demo, 'recordFixture');
    Object.assign(process.env, { TIDE_PUBLIC_SITE: '1', NANSEN_API_KEY: 'test-key', DEMO_MODE: '' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 })));
    await callNansen('tgm/indicators', { f: 1 });
    expect(spy).not.toHaveBeenCalled();
    // Control: the same call on an ordinary instance does record.
    delete process.env.TIDE_PUBLIC_SITE;
    spy.mockImplementation(() => {});
    await callNansen('tgm/indicators', { f: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('daily web credit budget', () => {
  it('counts only visitor calls on the instance key since 00:00 UTC', () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    recordCall('tgm/holders', 300, false);            // web, instance key
    recordCall('tgm/holders', 50, false, 7);          // web, a member's own key
    delete process.env.NEXT_RUNTIME;
    recordCall('smart-money/dex-trades', 900, false); // the scanner worker
    expect(webCreditsToday()).toBe(300);
  });

  it('past the cap, serves the last known response, else refuses without calling Nansen', async () => {
    Object.assign(process.env, { NEXT_RUNTIME: 'nodejs', TIDE_PUBLIC_SITE: '1', WEB_DAILY_CREDIT_CAP: '100', NANSEN_API_KEY: 'test-key', DEMO_MODE: '' });
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    recordCall('tgm/holders', 120, false);
    // An expired entry: normally a miss, here the fallback.
    writeCache('tgm/token-information', { chain: 'base' }, { symbol: 'AERO' });
    getDb().prepare('UPDATE response_cache SET expires_at = 1').run();
    const hit = await callNansen<{ symbol: string }>('tgm/token-information', { chain: 'base' });
    expect(hit.data.symbol).toBe('AERO');
    expect(hit.meta.cacheHit).toBe(true);
    await expect(callNansen('tgm/holders', { chain: 'base' })).rejects.toBeInstanceOf(DailyBudgetExhausted);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not cap the scanner worker or a private instance without an explicit cap', async () => {
    Object.assign(process.env, { NANSEN_API_KEY: 'test-key', DEMO_MODE: '' });
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200, headers: { 'x-nansen-credits-cost': '1' } }));
    vi.stubGlobal('fetch', fetch);
    process.env.NEXT_RUNTIME = 'nodejs';
    recordCall('tgm/holders', 5000, false);
    // Private instance, no WEB_DAILY_CREDIT_CAP: not capped.
    await expect(callNansen('tgm/indicators', { a: 1 }, { record: false })).resolves.toBeTruthy();
    // Worker process (no NEXT_RUNTIME) on a public site: not capped either.
    delete process.env.NEXT_RUNTIME;
    process.env.TIDE_PUBLIC_SITE = '1';
    await expect(callNansen('tgm/indicators', { a: 2 }, { record: false })).resolves.toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
