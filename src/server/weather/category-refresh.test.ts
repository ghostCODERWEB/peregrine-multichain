import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/server/nansen/client', () => ({ callNansen: vi.fn() }));
import { loadPredictionCategories, CATEGORY_BODY } from './category-refresh';
import { callNansen } from '@/server/nansen/client';
import { contextScope, type RequestContext } from '@/server/context';
import { POST } from '@/app/api/weather/categories/route';

const member: RequestContext = { mode: 'member', user: { id: 7, family: 'evm', address: `0x${'7'.repeat(40)}` } as RequestContext['user'], apiKey: 'member-own-key', keyLast4: 'mkey', keyPlan: 'pro' };
const meta = (cacheHit: boolean) => ({ cacheHit, creditsCost: 1, creditsUsed: null, creditsRemaining: null });
const req = (body: unknown, origin?: string) => new Request('http://localhost/api/weather/categories', { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) });
beforeEach(() => vi.clearAllMocks());

describe('home category refresh', () => {
  it('always reads the shared cache on the instance key, never a member partition', async () => {
    let seen: RequestContext | undefined;
    vi.mocked(callNansen).mockImplementation(async () => { seen = contextScope.getStore(); return { data: { data: [] }, meta: meta(false) }; });
    expect(await loadPredictionCategories(member)).toEqual({ cached: false, credits: 1 });
    expect(seen).toMatchObject({ mode: 'member', apiKey: null });
    expect(vi.mocked(callNansen).mock.calls[0].slice(0, 2)).toEqual(['prediction-market/categories', CATEGORY_BODY]);
  });
  it('reports a cache hit as free', async () => {
    vi.mocked(callNansen).mockResolvedValue({ data: {}, meta: meta(true) });
    expect(await loadPredictionCategories(member)).toEqual({ cached: true, credits: 0 });
  });
  it('refuses cross-site, unconfirmed and repeated clicks before any call', async () => {
    vi.mocked(callNansen).mockResolvedValue({ data: {}, meta: meta(true) });
    expect((await POST(req({ confirmCredits: 1 }, 'https://elsewhere.invalid'))).status).toBe(403);
    expect((await POST(req({}))).status).toBe(428);
    expect((await POST(req({ confirmCredits: 5 }))).status).toBe(428);
    expect(callNansen).not.toHaveBeenCalled();
    for (let i = 0; i < 3; i++) expect((await POST(req({ confirmCredits: 1 }))).status).toBe(200);
    expect((await POST(req({ confirmCredits: 1 }))).status).toBe(429);
    expect(callNansen).toHaveBeenCalledTimes(3);
  });
});
