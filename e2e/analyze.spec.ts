import { test, expect } from './fixtures';

// Analyze with Nansen: the one Ask surface on every page. Opening it, reading
// the suggestions and closing it must never call the paid routes; only a
// question sent calls /api/explain.
const TOKEN = '/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722';

test('Analyze with Nansen: opens from the dock and ⌘J, suggests questions, spends nothing until asked', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the phone opens it from the tab bar (below)');
  const paid: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/(explain|agent)$/.test(new URL(r.url()).pathname)) paid.push(r.url()); });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(TOKEN);
  const panel = page.getByRole('dialog', { name: 'Analyze with Nansen' });
  await page.getByRole('button', { name: 'Analyze with Nansen (⌘J)' }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Suggested')).toBeVisible();
  await expect(panel.getByPlaceholder('Ask about this page…')).toBeVisible();
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toBeHidden();
  await page.keyboard.press('Control+j');
  await expect(panel).toBeVisible();
  expect(paid).toEqual([]);
  expect(errors).toEqual([]);
});

test('Genie Ask: the phone tab bar opens and closes the same panel with no paid call @mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone tab bar');
  const paid: string[] = [];
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/(explain|agent)$/.test(new URL(r.url()).pathname)) paid.push(r.url()); });
  await page.goto('/');
  const ask = page.getByRole('button', { name: 'Ask about this screen' });
  await ask.click();
  const panel = page.getByRole('dialog', { name: 'Analyze with Nansen' });
  await expect(panel).toBeVisible();
  await expect(ask).toHaveAttribute('aria-pressed', 'true');
  await ask.click();
  await expect(panel).toBeHidden();
  expect(paid).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
