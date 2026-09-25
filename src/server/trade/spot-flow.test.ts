import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: Array<[string, unknown, { method?: string }]> = [];
let reply: (endpoint: string) => unknown = () => ({});
vi.mock('@/server/nansen/client', () => ({
  callNansen: vi.fn(async (endpoint: string, body: unknown, opts: { method?: string }) => {
    calls.push([endpoint, body, opts]);
    return { data: reply(endpoint) };
  }),
}));

const { spotQuote, spotPrepare, spotExecute, bridgeStatus } = await import('./spot');
const { createAlerts, listTideAlerts, toggleAlert, deleteAlert, planStormAlerts } = await import('@/server/agents/alerts');

const W = '0x' + 'a'.repeat(40), T = '0x' + 'b'.repeat(40);
beforeEach(() => { calls.length = 0; });

describe('spot trade flow (mocked Nansen; nothing is signed or broadcast here)', () => {
  it('quotes, drops oversize quotes, and prepares only for the quoting wallet', async () => {
    reply = (e) => e === 'trade/quote'
      ? { quotes: [{ aggregator: 'x', inUsdValue: 100, outUsdValue: 99, outAmount: '5', priceImpactPct: 0.1 }, { aggregator: 'y', inUsdValue: 1e9 }] }
      : { simulationPassed: true, needsApproval: true, approvalTxData: { to: T }, swapTxData: { to: T } };
    const q = await spotQuote({ chain: 'base', side: 'buy', base: 'USDC', token: T, amount: '100', wallet: W });
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ aggregator: 'x', inUsd: 100, outAmount: '5' });
    await expect(spotPrepare(q[0].id, '0x' + 'c'.repeat(40))).rejects.toThrow(/another wallet/);
    const p = await spotPrepare(q[0].id, W);
    expect(p).toMatchObject({ chain: 'base', simulationPassed: true, needsApproval: true });
    await expect(spotPrepare('nope', W)).rejects.toThrow(/expired/);
    await expect(spotQuote({ chain: 'base', side: 'sell', base: 'USDC', token: 'bad', amount: '1', wallet: W })).rejects.toThrow(/valid Base/);
  });
  it('checks a signed transaction before broadcasting, and reads bridge status', async () => {
    await expect(spotExecute('base', 'nothex')).rejects.toThrow(/signed EVM/);
    reply = () => ({ txHash: '0xabc', status: 'ok', substatus: 'done' });
    expect(await spotExecute('base', '0x' + 'ab'.repeat(80))).toEqual({ txHash: '0xabc', status: 'ok' });
    expect(await bridgeStatus('0xabc', 'base', 'solana', 'lifi')).toEqual({ status: 'ok', substatus: 'done' });
    expect(calls.at(-1)?.[1]).toMatchObject({ aggregator: 'lifi' });
  });
});

describe('Smart Alerts (mocked Nansen)', () => {
  it('creates each planned alert, lists only its own, and refuses foreign ids', async () => {
    const plan = { requests: [{ name: 'Peregrine · a' }, { name: 'Peregrine · b' }] } as unknown as Parameters<typeof createAlerts>[0];
    await expect(async () => planStormAlerts('base', T, [W], { type: 'telegram', data: { chatId: '1' } })).rejects.toThrow(/No Dump Risk/);
    reply = () => ({});
    expect(await createAlerts(plan)).toBe(plan.requests.length);
    reply = () => [
      { id: 'a1', name: 'Peregrine · AERO', isEnabled: true, type: 'x', timeWindow: '1h', channels: [{ type: 'telegram' }] },
      { id: 'z9', name: 'Someone else', isEnabled: true, type: 'x', timeWindow: '1h' },
    ];
    const list = await listTideAlerts();
    expect(list.map((a) => [a.id, a.name, a.channels])).toEqual([['a1', 'AERO', ['telegram']]]);
    await toggleAlert('a1', false);
    expect(calls.at(-1)?.[0]).toBe('smart-alert/toggle');
    await deleteAlert('a1');
    expect(calls.at(-1)?.[2].method).toBe('DELETE');
    await expect(deleteAlert('z9')).rejects.toThrow(/Not a Peregrine alert/);
  });
});
