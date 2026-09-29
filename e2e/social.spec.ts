import { test, expect } from './fixtures';

// D1a: an author's week (ra-agent/posts-by-user) on request, from the
// recorded demo: reach and the breadth of tokens the account pushed.
test('social pulse: an author’s week shows its reach and cashtag breadth @mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/token/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631?view=terminal');
  // The author's week (ra-agent/posts-by-user) now loads with the social card, no click needed.
  await expect(page.getByText(/@wacy_time1: \d+ posts in 7 days/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/different cashtags this week/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});
