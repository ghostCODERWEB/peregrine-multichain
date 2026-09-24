import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/server/nansen/client', () => ({ callNansen: vi.fn() }));
import { perpPrepare, perpReads, perpExecute } from './perp';
import { callNansen } from '@/server/nansen/client';
import { POST } from '@/app/api/trade/route';

const W = `0x${'dead'.repeat(10)}`;
// A prepared action as Nansen returns one for account actions (size/price null).
const prepared = (type: string) => ({ data: { action: { type }, nonce: 1790253983255, vault_address: null, eip712: { domain: { chainId: 1337, name: 'Exchange' }, types: { Agent: [] }, primaryType: 'Agent', message: {} }, size: null, price: null }, meta: { cacheHit: false, creditsCost: 0, creditsUsed: null, creditsRemaining: null } });
const req = (body: unknown) => new Request('http://localhost/api/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('FEATURE_TRADING', '1'); vi.stubEnv('TIDE_DISPLAY_MODE', 'private'); vi.stubEnv('DEMO_MODE', '0'); });
afterEach(() => vi.unstubAllEnvs());

describe('Hyperliquid account actions (D1b)', () => {
  it('sends the probed body for each account action, uncached and unrecorded', async () => {
    vi.mocked(callNansen).mockImplementation(async (ep) => prepared(String(ep)) as never);
    await perpPrepare('cancel', W, undefined, { coin: 'BTC', orderId: 42 });
    await perpPrepare('leverage', W, undefined, { coin: 'ETH', leverage: 5, isCross: false });
    await perpPrepare('transfer', W, undefined, { amount: 25, toPerp: true });
    expect(vi.mocked(callNansen).mock.calls.map(([ep, body, opts]) => [ep, body, opts])).toEqual([
      ['perp/cancel', { wallet_address: W, coin: 'BTC', order_id: 42 }, { method: 'POST', skipCache: true, record: false }],
      ['perp/leverage', { wallet_address: W, coin: 'ETH', leverage: 5, is_cross: false }, { method: 'POST', skipCache: true, record: false }],
      ['perp/transfer', { wallet_address: W, amount: 25, to_perp: true }, { method: 'POST', skipCache: true, record: false }],
    ]);
  });
  it('keeps the prepared action server-side and submits it once, for the same wallet only', async () => {
    vi.mocked(callNansen).mockResolvedValueOnce(prepared('usdClassTransfer') as never).mockResolvedValueOnce({ data: { status: 'ok' }, meta: {} } as never);
    const p = await perpPrepare('transfer', W, undefined, { amount: 1, toPerp: false });
    expect(p).not.toHaveProperty('action');
    const sig = `0x${'a'.repeat(64)}${'b'.repeat(64)}1b`;
    await expect(perpExecute(p.id, `0x${'1'.repeat(40)}`, sig)).rejects.toThrow('another wallet');
    expect(await perpExecute(p.id, W.toUpperCase().replace('0X', '0x'), sig)).toMatchObject({ kind: 'transfer' });
    expect(vi.mocked(callNansen).mock.calls[1][1]).toMatchObject({ action: { type: 'usdClassTransfer' }, nonce: 1790253983255 });
    await expect(perpExecute(p.id, W, sig)).rejects.toThrow('expired');
  });
  it('reads resting orders with the account', async () => {
    vi.mocked(callNansen).mockImplementation(async (ep) => ({ data: ep === 'perp/orders' ? { orders: [{ coin: 'BTC', oid: 7 }] } : {}, meta: {} }) as never);
    expect((await perpReads(W)).orders).toEqual({ orders: [{ coin: 'BTC', oid: 7 }] });
  });
  it('the route validates each action before any call', async () => {
    vi.mocked(callNansen).mockImplementation(async (ep) => prepared(String(ep)) as never);
    const bad = [
      { action: 'perp-prepare', kind: 'cancel', wallet: W },
      { action: 'perp-prepare', kind: 'cancel', wallet: W, cancel: { coin: '@156', orderId: 1 } }, // a spot order
      { action: 'perp-prepare', kind: 'cancel', wallet: W, cancel: { coin: 'BTC', orderId: 1.5 } },
      { action: 'perp-prepare', kind: 'leverage', wallet: W, leverage: { coin: 'BTC', leverage: 201, isCross: true } },
      { action: 'perp-prepare', kind: 'transfer', wallet: W, transfer: { amount: -1, toPerp: true } },
      { action: 'perp-prepare', kind: 'transfer', wallet: W, cancel: { coin: 'BTC', orderId: 1 } }, // wrong params for the kind
    ];
    for (const b of bad) expect((await POST(req(b))).status).toBe(400);
    expect(callNansen).not.toHaveBeenCalled();
    const ok = await POST(req({ action: 'perp-prepare', kind: 'leverage', wallet: W, leverage: { coin: 'BTC', leverage: 3, isCross: true } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ typedData: { primaryType: 'Agent' } });
  });
  it('trading stays off without FEATURE_TRADING, and public callers are refused', async () => {
    vi.stubEnv('FEATURE_TRADING', '0');
    expect((await POST(req({ action: 'perp-state', wallet: W }))).status).toBe(403);
    vi.stubEnv('FEATURE_TRADING', '1'); vi.stubEnv('TIDE_DISPLAY_MODE', 'public');
    expect((await POST(req({ action: 'perp-state', wallet: W }))).status).toBe(403);
    expect(callNansen).not.toHaveBeenCalled();
  });
});
