import { describe, it, expect } from 'vitest';
import { checkDepositQuote } from './deposit-check';

// Shaped like the live Base → Hyperliquid perps quote of 2026-09-24 (10 USDC).
const W = '0x000000000000000000000000000000000000dEaD', USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', RELAY = '0x4cd00e387622c35bddb9b4c962c136462338bc31';
const approveData = (spender = RELAY, amount = BigInt(10_000_000)) => `0x095ea7b3${spender.slice(2).toLowerCase().padStart(64, '0')}${amount.toString(16).padStart(64, '0')}`;
const quote = (o: { approve?: string; to?: string; from?: string; chainId?: number; value?: string; outName?: string; inAmount?: string; kind?: string } = {}) => ({
  execution_type: o.kind ?? 'evm_transaction', request_id: `0x${'1'.repeat(64)}`,
  amount_in: { amount: o.inAmount ?? '10000000', amount_formatted: '10.0', decimals: 6, symbol: 'USDC', name: 'USD Coin' },
  amount_out: { amount: '997899800', amount_formatted: '9.978998', decimals: 8, symbol: 'USDC', name: o.outName ?? 'USDC (Perps)' },
  steps: [
    { id: 'approve', kind: 'transaction', description: 'Sign an approval for USDC', items: [{ data: { from: o.from ?? W, to: o.to ?? USDC, data: o.approve ?? approveData(), value: '0', chainId: o.chainId ?? 8453, gas: '73112' } }] },
    { id: 'deposit', kind: 'transaction', description: 'Depositing funds to the relayer', items: [{ data: { from: W, to: RELAY, data: '0xe8017952', value: o.value ?? '0', chainId: 8453 } }] },
  ],
  fees: { relayer: { amountFormatted: '0.021002', amountUsd: '0.021000' } },
  details: { timeEstimate: 1, totalImpact: { percent: '-0.21' } },
});
const want = { wallet: W.toLowerCase(), chainId: 8453, usdc: USDC, amountBase: '10000000', decimals: 6 };

describe('deposit quote check', () => {
  it('accepts the live shape and summarizes what the user sends and receives', () => {
    const r = checkDepositQuote(quote(), want);
    expect(r).toMatchObject({ view: { send: '10.0', receive: '9.978998', receiveName: 'USDC (Perps)', feeUsdc: '0.021002', impactPct: -0.21, seconds: 1 } });
    expect('txs' in r && r.txs.map((t) => t.step)).toEqual(['approve', 'deposit']);
  });
  it('refuses a wrong scale, a spot destination or a withdrawal route', () => {
    expect(checkDepositQuote(quote({ inAmount: '1000000000' }), want)).toHaveProperty('error');
    expect(checkDepositQuote(quote({ outName: 'USDC (Spot)' }), want)).toMatchObject({ error: expect.stringContaining('not the perps balance') });
    expect(checkDepositQuote(quote({ kind: 'hyperliquid_signature' }), want)).toHaveProperty('error');
  });
  it('refuses steps from another wallet, on another chain or sending native value', () => {
    expect(checkDepositQuote(quote({ from: `0x${'2'.repeat(40)}` }), want)).toHaveProperty('error');
    expect(checkDepositQuote(quote({ chainId: 1 }), want)).toHaveProperty('error');
    expect(checkDepositQuote(quote({ value: '1' }), want)).toHaveProperty('error');
  });
  it('refuses an approval for another token, another spender or more than the amount', () => {
    expect(checkDepositQuote(quote({ to: `0x${'3'.repeat(40)}` }), want)).toMatchObject({ error: expect.stringContaining('not for USDC') });
    expect(checkDepositQuote(quote({ approve: approveData(`0x${'4'.repeat(40)}`) }), want)).toMatchObject({ error: expect.stringContaining('different contract') });
    expect(checkDepositQuote(quote({ approve: approveData(RELAY, BigInt(`0x${'f'.repeat(64)}`)) }), want)).toMatchObject({ error: expect.stringContaining('exactly') });
  });
  it('refuses an unexpected shape', () => {
    expect(checkDepositQuote({ steps: [] }, want)).toHaveProperty('error');
    expect(checkDepositQuote(null, want)).toHaveProperty('error');
  });
});
