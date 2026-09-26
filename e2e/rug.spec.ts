import { test, expect } from '@playwright/test';

const AERO = '/rug/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631';

test('rug checker: in the nav, lists eligible networks, and grades a token with six checks @mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/rug');
  await expect(page.getByRole('heading', { level: 1, name: 'Rug Checker' })).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Network' }).getByRole('radio', { name: 'Base' })).toBeVisible();
  if (test.info().project.name === 'desktop') await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Rug Checker' })).toHaveAttribute('href', '/rug');

  await page.goto(AERO);
  await expect(page.getByRole('heading', { level: 1, name: /Rug risk: (Low|Moderate|High|Critical|Unknown)/ })).toBeVisible({ timeout: 60_000 });
  const checks = page.getByRole('region', { name: /^(Exit liquidity|Top-10 holders|Insider clusters|Token age|Sell pressure|Nansen risk indicators): / });
  await expect(checks).toHaveCount(6);
  await expect(page.getByText(/\d+ Nansen calls, \d+ credits/)).toBeVisible({ timeout: 60_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test('rug checker: unsupported networks and bad addresses are refused', async ({ request }) => {
  expect((await request.get('/api/rug/bitcoin/bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')).status()).toBe(404);
  expect((await request.get('/api/rug/base/not-an-address')).status()).toBe(400);
});
