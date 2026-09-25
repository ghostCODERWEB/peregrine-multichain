import { describe, it, expect, afterEach, vi } from 'vitest';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  process.env.TIDE_DB_PATH = p.join(f.mkdtempSync(p.join(o.tmpdir(), 'x402-')), 'x402.db');
});
import { buildAuthorization, typedDataFor, paymentPayload, encodeHeader, type PaymentRequirement } from '@/lib/x402';
import { quote, paidCall, paymentStats, x402Enabled, X402Error } from './x402';

const REQ: PaymentRequirement = {
  scheme: 'exact', network: 'eip155:8453', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', amount: '10000',
  payTo: '0x93053f1e7A5eFEDa532Fe69CbbE43cBEc3A0F13f', maxTimeoutSeconds: 300, extra: { name: 'USD Coin', version: '2' },
};
const RESOURCE = { url: 'https://api.nansen.ai/api/v1/token-screener', description: 'screener', mimeType: '' };
const BODY = { chains: ['base'] };
const PR = { x402Version: 2, resource: RESOURCE, accepts: [REQ, { ...REQ, network: 'solana:x', asset: 'So1', extra: {} }] };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** Nansen as seen by x402.ts: discovery, then the endpoint's reply. */
function nansen(reply: () => Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    url.endsWith('/.well-known/x402') ? json(200, { resources: ['POST /api/v1/token-screener'] }) : reply()));
}

async function header() {
  const acct = privateKeyToAccount(generatePrivateKey());
  const auth = buildAuthorization(REQ, acct.address, Math.floor(Date.now() / 1000), `0x${'cd'.repeat(32)}`);
  const td = typedDataFor(REQ, auth);
  const signature = await acct.signTypedData({
    domain: { ...td.domain, verifyingContract: td.domain.verifyingContract as `0x${string}` },
    types: { TransferWithAuthorization: td.types.TransferWithAuthorization }, primaryType: td.primaryType,
    message: {
      from: auth.from as `0x${string}`, to: auth.to as `0x${string}`, value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore), nonce: auth.nonce as `0x${string}`,
    },
  });
  return encodeHeader(paymentPayload(RESOURCE, REQ, auth, signature));
}

afterEach(() => { vi.unstubAllGlobals(); delete process.env.TIDE_PUBLIC_SITE; });

describe('x402 quote and paid call (mocked Nansen; no funds move)', () => {
  it('is off on the public site', async () => {
    process.env.TIDE_PUBLIC_SITE = '1';
    expect(x402Enabled()).toBe(false);
    await expect(quote('token-screener', BODY, null)).rejects.toBeInstanceOf(X402Error);
  });
  it('quotes the signable options cheapest first and names the rest', async () => {
    nansen(() => json(402, PR));
    const q = await quote('token-screener', BODY, '0x' + 'a'.repeat(40));
    expect(q.options).toEqual([expect.objectContaining({ network: expect.any(String), priceUsd: 0.01 })]);
    expect(q.unsupported).toEqual(['solana:x']);
    await expect(quote('no-such-endpoint', BODY, null)).rejects.toThrow(/Unknown Nansen endpoint/);
    nansen(() => json(200, {}));
    await expect(quote('token-screener', BODY, null)).rejects.toThrow(/Expected a price/);
  });
  it('settles, logs, and explains a rejection or failure', async () => {
    const h = await header();
    nansen(() => json(200, { data: [] }));
    const ok = await paidCall('token-screener', BODY, h, null);
    expect(ok.priceUsd).toBe(0.01);
    nansen(() => json(402, { ...PR, error: 'insufficient funds' }));
    await expect(paidCall('token-screener', BODY, h, null)).rejects.toThrow(/too little USDC/);
    nansen(() => new Response('boom', { status: 500 }));
    await expect(paidCall('token-screener', BODY, h, null)).rejects.toThrow(/responded 500/);
    expect(paymentStats(0).map((r) => r.status).sort()).toEqual(['failed', 'rejected', 'settled']);
  });
});
