import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/server/nansen/client', () => ({ callNansen: vi.fn() }));
import { perpDepositQuote, perpDepositSteps, perpBridgeStatus } from './perp-bridge';
import { callNansen } from '@/server/nansen/client';
import { POST } from '@/app/api/trade/route';

const W = '0x000000000000000000000000000000000000dEaD', USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', RELAY = '0x4cd00e387622c35bddb9b4c962c136462338bc31';
const approve = `0x095ea7b3${RELAY.slice(2).padStart(64, '0')}${(12_500_000).toString(16).padStart(64, '0')}`;
const liveLike = (inAmount = '12500000') => ({ data: {
  execution_type: 'evm_transaction', request_id: `0x${'1'.repeat(64)}`,
  amount_in: { amount: inAmount, amount_formatted: '12.5', decimals: 6, name: 'USD Coin' },
  amount_out: { amount: '1247000000', amount_formatted: '12.47', decimals: 8, name: 'USDC (Perps)' },
  steps: [
    { id: 'approve', kind: 'transaction', description: 'Sign an approval for USDC', items: [{ data: { from: W, to: USDC, data: approve, value: '0', chainId: 8453 } }] },
    { id: 'deposit', kind: 'transaction', description: 'Depositing funds to the relayer', items: [{ data: { from: W, to: RELAY, data: '0xe8017952', value: '0', chainId: 8453 } }] },
  ],
}, meta: { cacheHit: false, creditsCost: 0 } });
const req = (body: unknown) => new Request('http://localhost/api/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('FEATURE_TRADING', '1'); vi.stubEnv('TIDE_DISPLAY_MODE', 'private'); vi.stubEnv('DEMO_MODE', '0'); });
afterEach(() => vi.unstubAllEnvs());

describe('Hyperliquid deposits (D1c)', () => {
  it('quotes in 6-decimal base units to the perps balance, and withholds the transactions', async () => {
    vi.mocked(callNansen).mockResolvedValue(liveLike() as never);
    const q = await perpDepositQuote(W, 'base', '12.5');
    expect(vi.mocked(callNansen).mock.calls[0]).toEqual(['perp/bridge/quote', { wallet_address: W, origin_chain: 'base', destination_chain: 'hyperliquid', origin_token: USDC, destination_token: 'perps', amount: '12500000' }, { method: 'POST', skipCache: true, record: false }]);
    expect(q).toMatchObject({ send: '12.5', receive: '12.47', receiveName: 'USDC (Perps)', chain: 'base' });
    expect(q).not.toHaveProperty('txs');
  });
  it('refuses a quote that does not match the request', async () => {
    vi.mocked(callNansen).mockResolvedValue(liveLike('1250000000') as never);
    await expect(perpDepositQuote(W, 'base', '12.5')).rejects.toThrow('don’t match');
    await expect(perpDepositQuote(W, 'base', '0')).rejects.toThrow('above zero');
  });
  it('releases the checked transactions once, to the same wallet only', async () => {
    vi.mocked(callNansen).mockResolvedValue(liveLike() as never);
    const q = await perpDepositQuote(W, 'base', '12.5');
    expect(() => perpDepositSteps(q.id, `0x${'1'.repeat(40)}`)).toThrow('another wallet');
    const s = perpDepositSteps(q.id, W.toLowerCase());
    expect(s.chainId).toBe(8453);
    expect(s.txs.map((t) => t.step)).toEqual(['approve', 'deposit']);
    expect(() => perpDepositSteps(q.id, W)).toThrow('expired');
  });
  it('reads bridge status by request id or transaction hash and keeps only hashes', async () => {
    vi.mocked(callNansen).mockResolvedValue({ data: { status: 'pending', raw_status: 'waiting', source_tx_hashes: [`0x${'a'.repeat(64)}`, 'junk'], destination_tx_hashes: [] }, meta: {} } as never);
    expect(await perpBridgeStatus({ requestId: `0x${'1'.repeat(64)}` })).toEqual({ status: 'pending', raw: 'waiting', source: [`0x${'a'.repeat(64)}`], destination: [] });
    expect(vi.mocked(callNansen).mock.calls[0].slice(0, 2)).toEqual(['perp/bridge/status', { request_id: `0x${'1'.repeat(64)}` }]);
    await expect(perpBridgeStatus({})).rejects.toThrow('needs');
  });
  it('the route refuses unsupported chains, over-precise amounts, unconfirmed releases and bad ids before any call', async () => {
    const bad = [
      { action: 'perp-deposit-quote', wallet: W, chain: 'bnb', amount: '10' },
      { action: 'perp-deposit-quote', wallet: W, chain: 'base', amount: '10.1234567' },
      { action: 'perp-deposit-steps', id: 'abcdefghij', wallet: W },
      { action: 'perp-bridge-status', requestId: '0x1234' },
    ];
    for (const b of bad) expect((await POST(req(b))).status).toBe(400);
    expect(callNansen).not.toHaveBeenCalled();
  });
});
