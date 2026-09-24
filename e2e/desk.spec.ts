import { test, expect } from '@playwright/test';

// L1: make a call on a token page, then find it on the Desk with its receipt.
// Each test runs in a fresh browser context, so it gets its own anonymous desk.
const AERO = '/token/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631';

test('desk: an empty desk explains how to start', async ({ page }) => {
  await page.goto('/desk');
  await expect(page.getByRole('heading', { name: 'Desk', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No calls yet' })).toBeVisible();
});

test('desk: a call made on a token page lands on the Desk with its entry receipt @mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(AERO);
  const card = page.locator('section', { has: page.getByRole('heading', { name: /^Make a call on/ }) });
  await expect(card.getByRole('radio', { name: 'Pass' })).toBeVisible({ timeout: 60_000 });
  await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await card.getByRole('radio', { name: 'Pass' }).click();
  await expect(card.getByLabel('Invalidation price')).toBeDisabled(); // a pass has no invalidation
  await card.getByRole('radio', { name: '7d' }).click();
  await card.getByLabel('Setup').selectOption('divergence');
  await card.getByLabel('Thesis').fill('Flow and price disagree; wait for the flow to confirm');
  await card.getByRole('button', { name: 'Save the call' }).click();
  await expect(card.getByRole('status')).toContainText(/Saved: pass .* for 7d, from \d/);
  await expect(card.getByRole('button', { name: /How this is computed: Entry price for this call/ })).toBeVisible();

  await card.screenshot({ path: test.info().outputPath('call-card.png') });
  await card.getByRole('link', { name: 'Open the Desk →' }).click();
  await expect(page.getByRole('heading', { name: 'Open calls (1)' })).toBeVisible();
  const row = page.locator('li', { hasText: 'Flow and price disagree' });
  await expect(row).toContainText('pass');
  await expect(row).toContainText('7d · divergence');
  await expect(row).toContainText(/due in 6d \d+h/);
  await expect(page.getByRole('heading', { name: 'Trader DNA: nothing graded yet' })).toBeVisible();
  await row.getByRole('button', { name: /How this is computed: Entry price/ }).click();
  await expect(page.getByText('tgm/token-ohlcv').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('desk.png'), fullPage: true });
  expect(errors).toEqual([]);
});
