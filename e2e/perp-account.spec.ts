import { test, expect } from '@playwright/test';

// D1b: Hyperliquid account actions on /trade. The trading UI only renders on a
// private instance with FEATURE_TRADING=1, so this runs only when
// TRADE_E2E_URL points at one. The wallet is a fake injected into the page and
// /api/trade is stubbed: nothing reaches Nansen or the exchange, and the test
// checks what the page would ask the server to prepare and submit.
const URL = process.env.TRADE_E2E_URL;
test.skip(!URL, 'Set TRADE_E2E_URL to a private instance started with FEATURE_TRADING=1.');
test.use({ baseURL: URL });

const WALLET = '0x000000000000000000000000000000000000dEaD';

test('perp account: resting orders cancel, USDC moves and leverage all go through confirm → sign → submit @mobile', async ({ page }) => {
  const calls: Array<Record<string, unknown>> = [];
  await page.addInitScript((wallet) => {
    const w = window as unknown as { __signed: number; ethereum: unknown };
    w.__signed = 0;
    w.ethereum = { request: async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts') return [wallet];
      if (method === 'eth_chainId') return '0x539';
      if (method === 'eth_signTypedData_v4') { w.__signed++; return `0x${'ab'.repeat(64)}1b`; }
      return null;
    } };
  }, WALLET);
  await page.route('**/api/trade', async (route) => {
    const b = route.request().postDataJSON() as Record<string, unknown>;
    calls.push(b);
    if (b.action === 'perp-state') return route.fulfill({ json: { fee: { approved: true }, account: { account_value: 120, spotUsdc: 40 }, positions: [], orders: { orders: [
      { coin: 'BTC', side: 'B', limitPx: '60000', sz: '0.001', oid: 555253264109, orderType: 'Limit', tif: 'Gtc', reduceOnly: false, isTrigger: false },
      { coin: '@156', side: 'B', limitPx: '113.35', sz: '152.369', oid: 555253264089, orderType: 'Limit', tif: 'Alo', reduceOnly: false, isTrigger: false },
    ] } } });
    if (b.action === 'perp-prepare') return route.fulfill({ json: { id: `stub-${b.kind}`, typedData: { domain: { chainId: 1337, name: 'Exchange' }, types: {}, primaryType: 'Agent', message: {} }, size: null, price: null, expiresInMs: 45_000 } });
    if (b.action === 'perp-execute') return route.fulfill({ json: { kind: String(b.id).replace('stub-', ''), result: { status: 'ok' } } });
    return route.fulfill({ status: 400, json: { error: 'unexpected' } });
  });

  await page.goto('/trade?coin=BTC');
  await page.getByRole('button', { name: 'Connect wallet' }).click();
  const orders = page.locator('section', { has: page.getByRole('heading', { name: 'Resting orders' }) });
  await expect(orders.getByRole('row')).toHaveCount(3);
  await expect(orders.getByRole('button', { name: 'Cancel' })).toHaveCount(1); // the spot order (@156) has none
  await expect(orders.getByText('spot', { exact: true })).toBeVisible();

  // Cancel: confirm, sign once, submit with confirm: true.
  await orders.getByRole('button', { name: 'Cancel' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Confirm' });
  await expect(dialog).toContainText('Cancel your resting BTC buy order #555253264109');
  await dialog.getByRole('button', { name: 'Sign in my wallet and submit' }).click();
  await expect(page.getByText(/^Order cancelled:/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __signed: number }).__signed)).toBe(1);

  // Transfer and leverage: prepared and shown, then dismissed without signing.
  await page.getByLabel('USDC to move').fill('25');
  await page.getByRole('button', { name: 'Spot → perps' }).click();
  await expect(dialog).toContainText('Move 25 USDC from spot to perps');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.getByLabel('Leverage', { exact: true }).fill('5');
  await page.getByRole('radio', { name: 'Isolated' }).click();
  await page.getByRole('button', { name: 'Prepare leverage' }).click();
  await expect(dialog).toContainText('Set BTC leverage to 5× (isolated margin)');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect(await page.evaluate(() => (window as unknown as { __signed: number }).__signed)).toBe(1);

  const prepares = calls.filter((c) => c.action === 'perp-prepare').map(({ kind, cancel, transfer, leverage }) => ({ kind, cancel, transfer, leverage }));
  expect(prepares).toEqual([
    { kind: 'cancel', cancel: { coin: 'BTC', orderId: 555253264109 }, transfer: undefined, leverage: undefined },
    { kind: 'transfer', cancel: undefined, transfer: { amount: 25, toPerp: true }, leverage: undefined },
    { kind: 'leverage', cancel: undefined, transfer: undefined, leverage: { coin: 'BTC', leverage: 5, isCross: false } },
  ]);
  expect(calls.filter((c) => c.action === 'perp-execute')).toEqual([{ action: 'perp-execute', id: 'stub-cancel', wallet: WALLET, signature: `0x${'ab'.repeat(64)}1b`, confirm: true }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('perp-account.png'), fullPage: true });
});

test('perp deposit: quote, explicit confirm, the wallet sends each step on the origin chain, then bridge status @mobile', async ({ page }) => {
  const calls: Array<Record<string, unknown>> = [];
  await page.addInitScript((wallet) => {
    const w = window as unknown as { __sent: unknown[]; __switched: string[]; ethereum: unknown };
    w.__sent = []; w.__switched = [];
    w.ethereum = { request: async ({ method, params }: { method: string; params?: unknown[] }) => {
      if (method === 'eth_requestAccounts') return [wallet];
      if (method === 'eth_chainId') return '0x539';
      if (method === 'wallet_switchEthereumChain') { w.__switched.push((params?.[0] as { chainId: string }).chainId); return null; }
      if (method === 'eth_sendTransaction') { w.__sent.push(params?.[0]); return `0x${String(w.__sent.length).repeat(64)}`; }
      if (method === 'eth_getTransactionReceipt') return { status: '0x1' };
      return null;
    } };
  }, WALLET);
  const RELAY = '0x4cd00e387622c35bddb9b4c962c136462338bc31', USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  await page.route('**/api/trade', async (route) => {
    const b = route.request().postDataJSON() as Record<string, unknown>;
    calls.push(b);
    if (b.action === 'perp-state') return route.fulfill({ json: { fee: { approved: true }, account: { account_value: 0, spotUsdc: 0 }, positions: [], orders: { orders: [] } } });
    if (b.action === 'perp-deposit-quote') return route.fulfill({ json: { id: 'stub-deposit', chain: 'base', send: '12.5', receive: '12.47', receiveName: 'USDC (Perps)', feeUsdc: '0.021', impactPct: -0.2, seconds: 1, requestId: `0x${'1'.repeat(64)}`, steps: [{ id: 'approve', description: 'approval' }, { id: 'deposit', description: 'deposit' }], expiresInMs: 120000 } });
    if (b.action === 'perp-deposit-steps') return route.fulfill({ json: { chainId: 8453, txs: [
      { step: 'approve', description: 'approval', tx: { from: WALLET, to: USDC, data: '0x095ea7b3', value: '0', chainId: 8453, gas: '73112' } },
      { step: 'deposit', description: 'deposit', tx: { from: WALLET, to: RELAY, data: '0xe8017952', value: '0', chainId: 8453 } },
    ] } });
    if (b.action === 'perp-bridge-status') return route.fulfill({ json: { status: 'success', raw: 'success', source: [], destination: [] } });
    return route.fulfill({ status: 400, json: { error: 'unexpected' } });
  });

  await page.goto('/trade?coin=BTC');
  await page.getByRole('button', { name: 'Connect wallet' }).click();
  await page.getByLabel('USDC to deposit').fill('12.5');
  await page.getByRole('button', { name: 'Quote deposit' }).click();
  await expect(page.getByText(/You send 12\.5 USDC on Base; you receive about 12\.47 USDC \(Perps\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Send from my wallet' }).click();
  expect(calls.some((c) => c.action === 'perp-deposit-steps')).toBe(false); // nothing released before the confirm
  await page.getByRole('alertdialog', { name: 'Confirm deposit' }).getByRole('button', { name: 'Confirm and open my wallet' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Deposited: 12.47 USDC (Perps) arrived on Hyperliquid.' })).toBeVisible();

  const sent = await page.evaluate(() => (window as unknown as { __sent: Array<{ to: string; chainId: string; value: string; gas?: string }> }).__sent);
  expect(sent.map((t) => [t.to, t.chainId, t.value])).toEqual([[USDC, '0x2105', '0x0'], [RELAY, '0x2105', '0x0']]);
  expect(await page.evaluate(() => (window as unknown as { __switched: string[] }).__switched)).toEqual(['0x2105']);
  expect(calls.find((c) => c.action === 'perp-deposit-quote')).toMatchObject({ wallet: WALLET, chain: 'base', amount: '12.5' });
  expect(calls.find((c) => c.action === 'perp-deposit-steps')).toEqual({ action: 'perp-deposit-steps', id: 'stub-deposit', wallet: WALLET, confirm: true });
  expect(calls.find((c) => c.action === 'perp-bridge-status')).toEqual({ action: 'perp-bridge-status', requestId: `0x${'1'.repeat(64)}` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
