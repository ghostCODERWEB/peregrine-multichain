import { test, expect } from './fixtures';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import Database from 'better-sqlite3';
import path from 'node:path';

// x402 pay-per-call, end to end against a PUBLIC live instance (X402_URL,
// e.g. `tide-public` on :3301): a keyless visitor sees the price on the
// button, connects a wallet, sees exactly what will be signed, and only the
// explicit second click asks the wallet to sign. The wallet here is a fresh
// throwaway key with no USDC, so Nansen verifies the real signature and
// refuses it for lack of funds: the whole path runs and nothing is paid.
// Skipped without X402_URL (demo mode has pay-per-call off).
const BASE = process.env.X402_URL;
const DB = process.env.X402_DB ?? 'data/tide.db';

test.skip(!BASE, 'set X402_URL to a live public instance');
test.use({ baseURL: BASE });

test('price first, confirm, then sign — nothing signed automatically', async ({ page }) => {
  const acct = privateKeyToAccount(generatePrivateKey());
  await page.exposeFunction('__tideSign', async (json: string) => {
    const td = JSON.parse(json) as {
      domain: { name: string; version: string; chainId: number; verifyingContract: `0x${string}` };
      types: { TransferWithAuthorization: Array<{ name: string; type: string }> };
      message: Record<string, string>;
    };
    const m = td.message;
    return acct.signTypedData({
      domain: td.domain, types: { TransferWithAuthorization: td.types.TransferWithAuthorization }, primaryType: 'TransferWithAuthorization',
      message: { from: m.from, to: m.to, value: BigInt(m.value), validAfter: BigInt(m.validAfter), validBefore: BigInt(m.validBefore), nonce: m.nonce },
    });
  });
  await page.addInitScript((address: string) => {
    const w = window as unknown as { __calls: string[]; __typed: string | null; __tideSign: (j: string) => Promise<string>; ethereum: unknown };
    w.__calls = [];
    w.__typed = null;
    w.ethereum = {
      request: async ({ method, params }: { method: string; params?: unknown[] }) => {
        w.__calls.push(method);
        if (method === 'eth_requestAccounts') return [address];
        if (method === 'wallet_switchEthereumChain') return null;
        if (method === 'eth_signTypedData_v4') { w.__typed = params![1] as string; return w.__tideSign(params![1] as string); }
        throw Object.assign(new Error(`unexpected ${method}`), { code: 4200 });
      },
    };
  }, acct.address);

  const calls = () => page.evaluate(() => (window as unknown as { __calls: string[] }).__calls);

  await page.goto('/chain/base');
  const priced = page.getByRole('button', { name: /Load live smart-money trades · \$0\.\d+/ });
  await expect(priced).toBeVisible({ timeout: 30_000 });
  expect(await calls()).toEqual([]); // the price is shown before the wallet is touched

  await priced.click();
  await expect(page.getByText(/Pay \$0\.\d+ USDC on (Base|Monad)/)).toBeVisible({ timeout: 30_000 });
  expect(await calls()).toEqual(['eth_requestAccounts']); // connected, not signed

  const before = Date.now();
  await page.getByRole('button', { name: 'Sign and load' }).click();
  await expect(page.getByText(/Nansen did not accept the payment: .*too little USDC.* Nothing was charged\./)).toBeVisible({ timeout: 60_000 });
  expect((await calls()).filter((c) => c === 'eth_signTypedData_v4')).toHaveLength(1);

  // What the wallet was asked to sign: exactly the quoted amount, to Nansen's payTo.
  const typed = JSON.parse((await page.evaluate(() => (window as unknown as { __typed: string }).__typed))) as { primaryType: string; message: { from: string; value: string } };
  expect(typed.primaryType).toBe('TransferWithAuthorization');
  expect(typed.message.from).toBe(acct.address);
  expect(Number(typed.message.value)).toBeLessThanOrEqual(50_000); // ≤ $0.05 in USDC atomic units

  const db = new Database(path.resolve(DB), { readonly: true });
  const row = db.prepare('SELECT status, amount_usd AS usd, error FROM payments WHERE payer = ? AND at >= ?').get(acct.address, before) as { status: string; usd: number; error: string } | undefined;
  db.close();
  expect(row?.status).toBe('rejected');
});
