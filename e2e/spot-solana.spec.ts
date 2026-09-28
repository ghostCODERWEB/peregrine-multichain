import { expect, test } from './fixtures';
import { MessageV0, PublicKey, VersionedTransaction } from '@solana/web3.js';

// M8b runs only against the explicit private trading instance. Both the wallet
// and /api/trade are fakes: this test never signs or broadcasts a real trade.
const URL = process.env.TRADE_E2E_URL;
test.skip(!URL, 'Set TRADE_E2E_URL to a private instance started with FEATURE_TRADING=1.');
test.use({ baseURL: URL });

const WALLET = '7YttLkHDoYt9KQMeqWuxK2Q9g7k7NwA7NZ4hi6Mp7uYg';
const TOKEN = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6HY4GAdYQPzXbZG';

function unsignedTransaction(payer = WALLET) {
  const message = new MessageV0({
    header: { numRequiredSignatures: 1, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 0 },
    staticAccountKeys: [new PublicKey(payer)],
    recentBlockhash: '11111111111111111111111111111111',
    compiledInstructions: [],
    addressTableLookups: [],
  });
  return Buffer.from(new VersionedTransaction(message).serialize()).toString('base64');
}

test('spot: Solana quote → prepare → wallet signature → execute keeps the public key case @mobile', async ({ page }) => {
  const calls: Array<Record<string, unknown>> = [];
  await page.addInitScript((wallet) => {
    const publicKey = { toString: () => wallet };
    const w = window as unknown as { __solSigned: number; solana: unknown };
    w.__solSigned = 0;
    w.solana = {
      publicKey,
      connect: async () => ({ publicKey }),
      signTransaction: async (transaction: { signatures: Uint8Array[] }) => {
        w.__solSigned++;
        transaction.signatures[0].fill(7);
        return transaction;
      },
    };
  }, WALLET);
  await page.route('**/api/trade', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    calls.push(body);
    if (body.action === 'signals') return route.fulfill({ json: { symbol: 'BONK', storm: null, chainPressure: { cpi: 52, band: 'mixed' }, trackRecord: 'Fixture evidence.' } });
    if (body.action === 'quote') return route.fulfill({ json: { quotes: [{ id: 'quote-solana-1', aggregator: 'Jupiter', inUsd: 1.5, outUsd: 1.49, outAmount: '123', priceImpactPct: 0.1, tradingFeeUsd: 0.001, networkFeeUsd: 0.002 }] } });
    if (body.action === 'prepare') return route.fulfill({ json: { chain: 'solana', simulationPassed: true, needsApproval: false, approvalTx: null, swapTx: null, transaction: unsignedTransaction(), error: null } });
    if (body.action === 'execute') return route.fulfill({ json: { txHash: '5h6xTideFixtureSignature', status: 'submitted' } });
    return route.fulfill({ status: 400, json: { error: 'unexpected' } });
  });

  await page.goto('/trade');
  await page.getByRole('radio', { name: 'Solana' }).click();
  await page.getByLabel('Token on Solana').fill(TOKEN);
  await page.getByLabel('Pay with').selectOption('SOL');
  await page.getByLabel('Amount of SOL').fill('0.01');
  await page.getByRole('button', { name: 'Connect Solana wallet' }).click();
  await page.getByRole('button', { name: 'Get quotes' }).click();
  await page.getByRole('button', { name: 'Prepare' }).click();
  await expect(page.getByText(/Simulation: passed/)).toBeVisible();
  await page.getByRole('button', { name: 'Review the swap' }).click();
  await page.getByRole('button', { name: 'Sign the swap in my wallet' }).click();
  await expect(page.getByRole('heading', { name: 'Swap sent' })).toBeVisible();

  expect(await page.evaluate(() => (window as unknown as { __solSigned: number }).__solSigned)).toBe(1);
  expect(calls.find((c) => c.action === 'quote')).toEqual({ action: 'quote', chain: 'solana', side: 'buy', base: 'SOL', token: TOKEN, amount: '10000000', wallet: WALLET });
  expect(calls.find((c) => c.action === 'prepare')).toEqual({ action: 'prepare', quoteId: 'quote-solana-1', wallet: WALLET });
  expect(calls.find((c) => c.action === 'execute')).toMatchObject({ action: 'execute', chain: 'solana', confirm: true });
  expect(String(calls.find((c) => c.action === 'execute')?.signedTx)).not.toContain('0x');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('spot: a Solana swap prepared for another fee payer never reaches the wallet or Nansen execute', async ({ page }) => {
  const actions: unknown[] = [];
  await page.addInitScript((wallet) => {
    const publicKey = { toString: () => wallet };
    const w = window as unknown as { __solSigned: number; solana: unknown };
    w.__solSigned = 0;
    w.solana = { publicKey, connect: async () => ({ publicKey }), signTransaction: async (t: unknown) => { w.__solSigned++; return t; } };
  }, WALLET);
  await page.route('**/api/trade', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    actions.push(body.action);
    if (body.action === 'signals') return route.fulfill({ json: { symbol: 'BONK', storm: null, chainPressure: null, trackRecord: 'Fixture evidence.' } });
    if (body.action === 'quote') return route.fulfill({ json: { quotes: [{ id: 'quote-solana-2', aggregator: 'Jupiter', inUsd: 1.5, outUsd: 1.49, outAmount: '123', priceImpactPct: 0.1, tradingFeeUsd: 0.001, networkFeeUsd: 0.002 }] } });
    // The burn-style system address stands in for "someone else pays".
    if (body.action === 'prepare') return route.fulfill({ json: { chain: 'solana', simulationPassed: true, needsApproval: false, approvalTx: null, swapTx: null, transaction: unsignedTransaction('11111111111111111111111111111111'), error: null } });
    return route.fulfill({ status: 400, json: { error: 'unexpected' } });
  });

  await page.goto('/trade');
  await page.getByRole('radio', { name: 'Solana' }).click();
  await page.getByLabel('Token on Solana').fill(TOKEN);
  await page.getByLabel('Amount of USDC').fill('2');
  await page.getByRole('button', { name: 'Connect Solana wallet' }).click();
  await page.getByRole('button', { name: 'Get quotes' }).click();
  await page.getByRole('button', { name: 'Prepare' }).click();
  await page.getByRole('button', { name: 'Review the swap' }).click();
  await page.getByRole('button', { name: 'Sign the swap in my wallet' }).click();
  await expect(page.getByText(/paid by 1111…1111, not your wallet; not sending it to your wallet/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __solSigned: number }).__solSigned)).toBe(0);
  expect(actions).not.toContain('execute');
  await expect(page.getByRole('heading', { name: /^Swap (sent|confirmed)/ })).toHaveCount(0);
});
