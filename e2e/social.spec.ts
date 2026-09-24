import { test, expect } from '@playwright/test';

// D1a: an author's week (ra-agent/posts-by-user) on request, from the
// recorded demo: reach and the breadth of tokens the account pushed.
test('social pulse: an author’s week loads on request with its cashtag breadth @mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/token/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631?view=terminal');
  const button = page.getByRole('button', { name: "@wacy_time1's week · 5 credits" }).first();
  await expect(button).toBeVisible({ timeout: 60_000 });
  // Waves keep streaming in; keep the button clear of the fixed phone header.
  await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await button.click();
  await expect(page.getByText(/@wacy_time1: \d+ posts in 7 days/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/different cashtags this week/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
