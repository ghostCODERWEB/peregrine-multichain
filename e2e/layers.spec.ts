import { test, expect } from '@playwright/test';

test('home radar layers preserve map and table views @mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  if (test.info().project.name === 'phone') {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Switch to paper chart theme' }).click();
  }
  for (const title of ['Perp flow', 'Sector flow', 'Prediction activity']) {
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByText('Separate populations and units:', { exact: false })).toBeVisible();
    await page.getByRole('tab', { name: 'table', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'Index / 100' })).toBeVisible();
    await page.getByRole('tab', { name: 'map', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`${title.toLowerCase().replaceAll(' ', '-')}.png`), fullPage: true });
  }
  await expect(page.getByText(/Not net YES\/NO flow/)).toBeVisible();
  await page.getByRole('button', { name: 'Spot flow', exact: true }).click();
  await expect(page.locator('svg[aria-label^="Hex map"] a')).toHaveCount(38);
  expect(errors).toEqual([]);
});

// Live state simulated in the browser only: an expired category cache offers
// one explicit, priced load; after it the layer refetches and fills in place.
test('prediction layer: an expired cache offers a priced load, then fills in place @mobile', async ({ page, request }) => {
  const base = await (await request.get('/api/weather')).json();
  const layer = base.layers.find((l: { id: string }) => l.id === 'predictions');
  let loaded = false;
  const posts: unknown[] = [];
  await page.route('**/api/weather', (route) => route.fulfill({ json: { ...base, layers: base.layers.map((l: { id: string }) => l.id !== 'predictions' ? l : loaded
    ? { ...layer, recorded: false, at: base.generatedAt }
    : { ...layer, recorded: false, at: null, readings: [], unavailable: 'No fresh shared category observation: the 15-minute cache is empty or expired.' }) } }));
  await page.route('**/api/weather/categories', (route) => { posts.push(route.request().postDataJSON()); loaded = true; return route.fulfill({ json: { cached: false, credits: 1 } }); });
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Prediction activity', exact: true }).click();
  const load = page.getByRole('button', { name: 'Load category activity · 1 credit' });
  await expect(async () => {
    await page.clock.fastForward(61_000);
    await expect(load).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await load.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath('prediction-load.png') });
  await load.click();
  await expect(load).toHaveCount(0);
  await expect(page.getByRole('link').filter({ hasText: layer.metric }).first()).toBeVisible();
  expect(posts).toEqual([{ confirmCredits: 1 }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
