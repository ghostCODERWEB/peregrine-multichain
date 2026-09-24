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
