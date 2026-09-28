import { test, expect } from './fixtures';
const address = '0xcbb811f129782ef87e19dea9d3375045219bae00';

test('portfolio: recorded balances, allocation, stress coverage and paper theme @mobile', async ({ page }) => {
  test.setTimeout(180_000); // analyze + stress: several recorded calls and first compiles in dev
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/portfolio');
  // At phone width the page carries a second, hidden copy of some controls: act on the visible ones.
  await page.getByRole('button', { name: 'Use recorded demo wallet' }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Analyze', exact: true }).filter({ visible: true }).click();
  // A group, not an image: its blocks are links to each token.
  await expect(page.getByRole('group', { name: /Portfolio allocation map/ })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="portfolio-allocation"] tbody tr')).not.toHaveCount(0);
  await page.getByRole('button', { name: /Run stress scenario/ }).click();
  await expect(page.getByText(/remains unmodeled/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText('A simultaneous shock, not a portfolio probability interval or maximum loss. Unmodeled balances are not assumed safe.')).toBeVisible();
  await page.getByRole('button', { name: 'Switch to paper chart theme' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('wallet desk: the default section loads on open, each pick loads once, unsupported chains explain the gap', async ({ page }) => {
  let calls = 0;
  page.on('request', (r) => { if (r.url().endsWith('/api/wallet/desk')) calls++; });
  await page.goto(`/wallet/${address}`);
  const desk = page.locator('section[aria-labelledby="wallet-desk"]');
  await expect(desk).toBeVisible();
  // Token PnL (1 credit) loads on open; DeFi, perps and the rest only when picked.
  await expect.poll(() => calls).toBe(1);
  await page.getByLabel('Wallet desk chain').selectOption('base');
  await expect(desk.getByRole('heading', { name: 'Token PnL · 30 days' })).toBeVisible();
  await expect.poll(() => calls).toBe(2);
  await page.getByLabel('Wallet desk chain').selectOption('bitcoin');
  await expect(desk.getByText('Token PnL: not available on Bitcoin in Nansen API.')).toBeVisible();
});

test('wallet weather: evidence, unknown styles and exact table stay legible @mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/wallet/${address}`);
  const weather = page.locator('section[aria-labelledby="wallet-weather"]');
  await expect(weather).toBeVisible();
  await expect(weather.getByText('Observed style evidence')).toBeVisible();
  await expect(weather.getByRole('heading', { name: 'Farmer' })).toBeVisible();
  await expect(weather.getByRole('heading', { name: 'Perp' })).toBeVisible();
  await expect(weather.getByText('not assessed')).toHaveCount(2);
  // DeFi is not auto-loaded; picking it in the Wallet desk loads it and the Farmer style gets assessed.
  await page.getByLabel('Wallet desk chain').selectOption('base');
  await page.getByLabel('Wallet desk section').selectOption('defi');
  await expect(page.getByTestId('wallet-style-farmer')).not.toContainText('not assessed', { timeout: 30_000 });
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
