import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/server/nansen/client', () => ({ callNansen: vi.fn() }));
vi.mock('./omnibox', () => ({ omnibox: vi.fn() }));
import { previewCommand, runCommand, pageToken } from './commands';
import { omnibox } from './omnibox';
import { callNansen } from '@/server/nansen/client';
import { GET, POST } from '@/app/api/command/route';

const AERO = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
const W = '0x51c72848c68a965f66fa7a88855f9f7784502a7f';
const meta = { cacheHit: false, creditsCost: 1, creditsUsed: null, creditsRemaining: null };
const req = (method: string, url: string, body?: unknown, origin?: string) => new Request(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: body ? JSON.stringify(body) : undefined });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('DEMO_MODE', '0'); vi.stubEnv('TIDE_DISPLAY_MODE', 'public');
  vi.mocked(omnibox).mockResolvedValue({ query: 'aero', results: [{ kind: 'chain', title: 'Base', subtitle: '', href: '/chain/base' }, { kind: 'token', title: 'AERO · Aerodrome', subtitle: '', href: `/token/base/${AERO}` }] } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('⌘K commands, server side (L5)', () => {
  it('previews resolve the token with free search and price the command; nothing paid runs', async () => {
    const p = await previewCommand('who bought $AERO last 6h', '/');
    expect(p).toMatchObject({ title: 'Who bought AERO · Aerodrome on Base in the last 6h', cost: 1, href: null, problem: null, target: { chain: 'base', address: AERO } });
    expect(callNansen).not.toHaveBeenCalled();
  });
  it('navigation commands open existing pages, free', async () => {
    expect((await previewCommand('/replay aero 7d', '/'))?.href).toBe(`/replay/base/${AERO}?at=7d`);
    expect((await previewCommand('/call aero', '/'))?.href).toBe(`/token/base/${AERO}#call`);
    expect((await previewCommand('/follow aero', '/'))?.href).toBe(`/token/base/${AERO}?view=flow#follow`);
    expect((await previewCommand('fade AERO if whales dump', '/'))?.href).toBe(`/alerts?template=token-flows&chain=base&token=${AERO}`);
    expect(await previewCommand('/desk', '/')).toMatchObject({ href: '/desk', cost: 0 });
    expect(await previewCommand('aero', '/')).toBeNull(); // an ordinary search
  });
  it('"this" means the token page the palette was opened on, and nothing elsewhere', async () => {
    expect(pageToken(`/token/base/${AERO}`)).toMatchObject({ chain: 'base', address: AERO });
    expect((await previewCommand('fade this if whales dump', `/token/base/${AERO}`))?.href).toBe(`/alerts?template=token-flows&chain=base&token=${AERO}`);
    expect((await previewCommand('who bought this', '/desk'))?.problem).toMatch('works on a token page');
    expect(omnibox).not.toHaveBeenCalled();
  });
  it('related wallets default EVM addresses to Ethereum and refuse non-addresses', async () => {
    expect(await previewCommand(`/related ${W}`, '/')).toMatchObject({ cost: 1, target: { chain: 'ethereum', address: W } });
    expect((await previewCommand(`/related ${W} on base`, '/'))?.target?.chain).toBe('base');
    expect((await previewCommand('/related notanaddress', '/'))?.problem).toMatch('look like a wallet');
  });
  it('who-bought runs one exact ISO window, unrecorded', async () => {
    vi.mocked(callNansen).mockResolvedValue({ data: { data: [{ address: W, address_label: 'Market Maker', bought_volume_usd: 2_690_911, sold_volume_usd: 12 }, { address: '0xdead', bought_volume_usd: 0 }] }, meta } as never);
    const now = Date.parse('2026-09-24T17:00:00Z');
    const a = await runCommand((await previewCommand('/who-bought aero 6h', '/'))!, now);
    expect(vi.mocked(callNansen).mock.calls[0]).toEqual(['tgm/who-bought-sold', expect.objectContaining({ chain: 'base', token_address: AERO, buy_or_sell: 'BUY', date: { from: '2026-09-24T11:00:00.000Z', to: '2026-09-24T17:00:00.000Z' } }), { record: false }]);
    expect(a.rows).toEqual([{ address: W, label: 'Market Maker', detail: 'bought $2.7M · sold $12', href: `/wallet/${W}?chain=base` }]);
    expect(a.credits).toBe(1);
  });
  it('the route: previews are free, runs need confirmation and same origin, public answers lose labels', async () => {
    const g = await (await GET(req('GET', '/api/command?q=%2Fwho-bought%20aero%206h&ctx=%2F'))).json();
    expect(g.preview).toMatchObject({ cost: 1 });
    expect((await POST(req('POST', '/api/command', { q: '/who-bought aero 6h', ctx: '/' }))).status).toBe(428);
    expect((await POST(req('POST', '/api/command', { q: '/who-bought aero 6h', ctx: '/', confirmCredits: 1 }, 'https://elsewhere.invalid'))).status).toBe(403);
    expect(callNansen).not.toHaveBeenCalled();
    vi.mocked(callNansen).mockResolvedValue({ data: { data: [{ address: W, address_label: 'Market Maker', bought_volume_usd: 100 }] }, meta } as never);
    const r = await (await POST(req('POST', '/api/command', { q: '/who-bought aero 6h', ctx: '/', confirmCredits: 1 }))).json();
    expect(r.answer.rows[0]).toMatchObject({ address: W });
    expect(r.answer.rows[0].label ?? null).toBeNull(); // public view: stripped
    expect(r.answer.preview.title).toMatch('Who bought'); // the command's own title survives
    expect((await POST(req('POST', '/api/command', { q: '/replay aero', ctx: '/', confirmCredits: 1 }))).status).toBe(422); // pages aren't "run"
  });
});
