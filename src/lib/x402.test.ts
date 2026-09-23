import { describe, it, expect } from 'vitest';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  S_PaymentRequired, buildAuthorization, typedDataFor, paymentPayload, encodeHeader, decodeHeader, signable, priceUsd,
  formatPrice, S_PaymentPayload, type PaymentRequirement,
} from './x402';
import { checkPayment, explainRejection } from '@/server/nansen/x402';
import { foldTape, tapeFromDexTrades } from './tape';

// A requirement exactly as Nansen sent it for token-screener (Base USDC,
// $0.01), plus the other kinds it offers, to check what TIDE will sign.
const BASE: PaymentRequirement = {
  scheme: 'exact', network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', amount: '10000',
  payTo: '0x93053f1e7A5eFEDa532Fe69CbbE43cBEc3A0F13f', maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' },
};
const PERMIT2: PaymentRequirement = {
  scheme: 'exact', network: 'eip155:56', asset: '0x55d398326f99059fF775485246999027B3197955', amount: '10000000000000000',
  payTo: BASE.payTo, maxTimeoutSeconds: 300, extra: { name: 'Tether USD', version: '1', assetTransferMethod: 'permit2-exact' },
};
const SOLANA: PaymentRequirement = {
  scheme: 'exact', network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amount: '10000',
  payTo: 'J7ZvJEspvwP1oRxQZ7mYmNmT22NTm3GWq3t7HEbvPZYx', maxTimeoutSeconds: 300, extra: {},
};
const RESOURCE = { url: 'https://api.nansen.ai/api/v1/token-screener', description: 'Retrieve token screener data', mimeType: '' };
const NONCE = `0x${'ab'.repeat(32)}`;

async function signed(req = BASE, now = Math.floor(Date.now() / 1000), mutate?: (p: ReturnType<typeof paymentPayload>) => void) {
  const acct = privateKeyToAccount(generatePrivateKey());
  const auth = buildAuthorization(req, acct.address, now, NONCE);
  const td = typedDataFor(req, auth);
  const signature = await acct.signTypedData({
    domain: { ...td.domain, verifyingContract: td.domain.verifyingContract as `0x${string}` },
    types: { TransferWithAuthorization: td.types.TransferWithAuthorization },
    primaryType: td.primaryType,
    message: {
      from: auth.from as `0x${string}`, to: auth.to as `0x${string}`, value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore), nonce: auth.nonce as `0x${string}`,
    },
  });
  const p = paymentPayload(RESOURCE, req, auth, signature);
  mutate?.(p);
  return { header: encodeHeader(p), acct, auth };
}

describe('x402 requirements', () => {
  it('parses a real Nansen 402 body', () => {
    const r = S_PaymentRequired.safeParse({ x402Version: 2, error: 'Payment required', resource: RESOURCE, accepts: [BASE, PERMIT2, SOLANA], extensions: {} });
    expect(r.success).toBe(true);
  });

  it('signs only EIP-3009 USDC on Base and Monad', () => {
    expect(signable(BASE)?.chainId).toBe(8453);
    expect(signable(PERMIT2)).toBeNull();
    expect(signable(SOLANA)).toBeNull();
    expect(signable({ ...BASE, network: 'eip155:143', asset: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603' })?.name).toBe('Monad');
    expect(signable({ ...BASE, extra: { name: 'USD Coin' } })).toBeNull(); // no EIP-712 version → cannot sign
  });

  it('prices atomic USDC amounts, including half-price promo quotes', () => {
    expect(priceUsd(BASE)).toBe(0.01);
    expect(priceUsd({ ...BASE, amount: '25000' })).toBe(0.025);
    expect(formatPrice(0.05)).toBe('$0.05');
    expect(formatPrice(0.005)).toBe('$0.005');
    expect(priceUsd(SOLANA)).toBeNull();
  });

  it('round-trips headers with non-Latin-1 token names', () => {
    const h = encodeHeader({ x402Version: 2, resource: RESOURCE, accepts: [{ ...BASE, extra: { name: 'USD₮0', version: '1' } }] });
    expect(decodeHeader(h, S_PaymentRequired)?.accepts[0].extra?.name).toBe('USD₮0');
    expect(decodeHeader('not base64 json', S_PaymentRequired)).toBeNull();
  });

  it('authorizes exactly the quoted amount to the quoted recipient, expiring with the quote', () => {
    const a = buildAuthorization(BASE, '0x0000000000000000000000000000000000000001', 1_000_000, NONCE);
    expect(a).toMatchObject({ to: BASE.payTo, value: '10000', validAfter: '999400', validBefore: '1000300' });
    expect(typedDataFor(BASE, a).domain).toEqual({ name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: BASE.asset });
  });
});

describe('x402 payment check (server, before forwarding)', () => {
  it('accepts a correctly signed payment', async () => {
    const { header, acct } = await signed();
    const r = await checkPayment(header);
    expect(r.usd).toBe(0.01);
    expect(r.payload.payload.authorization.from).toBe(acct.address);
    expect(S_PaymentPayload.safeParse(r.payload).success).toBe(true);
  });

  it('refuses a payment signed by a different wallet than it claims', async () => {
    const other = privateKeyToAccount(generatePrivateKey());
    const { header } = await signed(BASE, undefined, (p) => { p.payload.authorization.from = other.address; });
    await expect(checkPayment(header)).rejects.toThrow(/signature/);
  });

  it('refuses a tampered amount or recipient', async () => {
    const lower = await signed(BASE, undefined, (p) => { p.payload.authorization.value = '1'; });
    await expect(checkPayment(lower.header)).rejects.toThrow(/amount/);
    const elsewhere = await signed(BASE, undefined, (p) => { p.payload.authorization.to = '0x0000000000000000000000000000000000000bad'; });
    await expect(checkPayment(elsewhere.header)).rejects.toThrow(/recipient/);
  });

  it('refuses an expired authorization, a price over the ceiling and an unsigned network', async () => {
    const old = await signed(BASE, Math.floor(Date.now() / 1000) - 3600);
    await expect(checkPayment(old.header)).rejects.toThrow(/expired/);
    const pricey = await signed({ ...BASE, amount: '5000000' });
    await expect(checkPayment(pricey.header)).rejects.toThrow(/ceiling/);
    await expect(checkPayment(encodeHeader({ x402Version: 2, accepted: PERMIT2, payload: { signature: '0x00', authorization: { from: BASE.payTo, to: BASE.payTo, value: '1', validAfter: '0', validBefore: '9999999999', nonce: NONCE } } })))
      .rejects.toThrow(/does not offer/);
    await expect(checkPayment('garbage')).rejects.toThrow(/Unreadable/);
  });
});

describe('x402 rejection wording', () => {
  it('turns the facilitator verdict Nansen passes through into a sentence', () => {
    // Verbatim from a live run with an unfunded wallet.
    const raw = 'Facilitator verify failed (400): {"invalidMessage":"contract call failed: unable to call contract: execution reverted","invalidReason":"invalid_payload","isValid":false,"payer":"0x9b46bCb6810de463a3B01FF7958e064C11c0F25C"}\n';
    expect(explainRejection(raw, 'Base')).toMatch(/too little USDC on Base/);
    expect(explainRejection('{"invalidReason":"invalid_exact_evm_payload_signature"}', 'Base')).toMatch(/signature/);
    expect(explainRejection('weird\n  thing', 'Base')).toBe('weird thing');
  });
});

describe('trade tape from a paid or live dex-trades response', () => {
  const row = (t: string, wallet: string, bought: string, sold: string, usd: number) => ({
    block_timestamp: t, trader_address: wallet, trader_address_label: 'Fund X', trade_value_usd: usd,
    token_bought_symbol: bought, token_sold_symbol: sold, token_bought_address: `0x${bought}`, token_sold_address: `0x${sold}`,
  });

  it('classifies sides, skips risk↔risk swaps and folds consecutive fills', () => {
    const trades = tapeFromDexTrades({ data: [
      row('2026-09-23T10:03:00Z', '0xa', 'PEPE', 'USDC', 100),
      row('2026-09-23T10:02:00Z', '0xa', 'PEPE', 'USDC', 50),
      row('2026-09-23T10:01:00Z', '0xb', 'WETH', 'AERO', 70),
      row('2026-09-23T10:00:00Z', '0xc', 'AERO', 'PEPE', 10),
      { block_timestamp: 'bad' },
    ] });
    expect(trades.map((t) => t.side)).toEqual(['buy', 'buy', 'sell']);
    const tape = foldTape(trades);
    expect(tape).toHaveLength(2);
    expect(tape[0]).toMatchObject({ wallet: '0xa', symbol: 'PEPE', usd: 150, count: 2 });
    expect(tape[1]).toMatchObject({ wallet: '0xb', side: 'sell', symbol: 'AERO' });
    expect(tapeFromDexTrades(null)).toEqual([]);
  });
});
