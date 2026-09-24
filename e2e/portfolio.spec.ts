import { test, expect } from '@playwright/test';
const address = '0xcbb811f129782ef87e19dea9d3375045219bae00';

test('portfolio: recorded balances, allocation, stress coverage and paper theme @mobile', async ({ page }) => {
  test.setTimeout(180_000); // analyze + stress: several recorded calls and first compiles in dev
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/portfolio');
  await page.getByRole('button', { name: 'Use recorded demo wallet' }).click();
  await page.getByRole('button', { name: 'Analyze · up to 5 credits' }).click();
  await expect(page.getByRole('img', { name: /Portfolio allocation map/ })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="portfolio-allocation"] tbody tr')).not.toHaveCount(0);
  await page.getByRole('button', { name: /Run stress scenario/ }).click();
  await expect(page.getByText(/remains unmodeled/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('A simultaneous shock, not a portfolio probability interval or maximum loss. Unmodeled balances are not assumed safe.')).toBeVisible();
  await page.getByRole('button', { name: 'Switch to paper chart theme' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('wallet desk: PnL loads only on request and unsupported chains explain the gap', async ({ page }) => {
  let calls = 0;
  page.on('request', (r) => { if (r.url().endsWith('/api/wallet/desk')) calls++; });
  await page.goto(`/wallet/${address}`);
  await expect(page.locator('#wallet-desk')).toBeVisible();
  expect(calls).toBe(0);
  await page.getByLabel('Wallet desk chain').selectOption('base');
  await page.getByRole('button', { name: /Load Token PnL/ }).click();
  await expect(page.getByRole('heading', { name: 'Token performance', exact: true })).toBeVisible();
  await page.getByLabel('Wallet desk chain').selectOption('bitcoin');
  await page.getByRole('button', { name: /Load Token PnL/ }).click();
  await expect(page.getByText(/Token PnL: not available on Bitcoin/)).toBeVisible();
});

test('wallet weather: evidence, unknown styles and exact table stay legible @mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/wallet/${address}`);
  const weather = page.locator('section[aria-labelledby="wallet-weather"]');
  await expect(weather).toBeVisible();
  await expect(weather.getByText('0 extra credits')).toBeVisible();
  await expect(weather.getByText('Observed style evidence')).toBeVisible();
  await expect(weather.getByRole('heading', { name: 'Farmer' })).toBeVisible();
  await expect(weather.getByRole('heading', { name: 'Perp' })).toBeVisible();
  await expect(weather.getByText('not assessed')).toHaveCount(2);
  await page.getByLabel('Wallet desk section').selectOption('defi');
  await page.getByRole('button', { name: /Load DeFi/ }).click();
  await expect(page.getByTestId('wallet-style-farmer')).not.toContainText('not assessed');
  await expect(page.getByTestId('wallet-style-farmer')).toContainText(/protocol/);
  await expect(page.getByTestId('wallet-style-perp')).toContainText('not assessed');
  await weather.getByText('Exact exposure table').click();
  await expect(weather.getByRole('cell', { name: 'Risk coverage' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to paper chart theme' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('portfolio and paid labels reject unauthorized writes and malformed input', async ({ request }) => {
  expect((await request.post('/api/portfolio', { data: { action: 'save', addresses: [address] } })).status()).toBe(401);
  expect((await request.post('/api/portfolio', { data: { action: 'analyze', addresses: ['not-a-wallet'] } })).status()).toBe(400);
  expect((await request.post('/api/wallet/labels', { data: { address, chain: 'all', premium: true, confirmCredits: 500 } })).status()).toBe(403);
  expect((await request.post('/api/portfolio', { headers: { origin: 'https://attacker.invalid' }, data: { action: 'save', addresses: [] } })).status()).toBe(403);
});
