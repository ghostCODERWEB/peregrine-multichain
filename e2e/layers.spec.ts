import { test, expect } from './fixtures';

test('home overview layers switch views and keep map and table', async ({ page }) => {
  // Desktop overview only: phones get the Today screen instead of the layer switch.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/No recorded fixture/.test(m.text())) errors.push(m.text()); });
  await page.goto('/');
  const views = page.getByRole('group', { name: 'Overview views' });
  // Each layer leads with its live headline; the table view lists every reading on the same 0–100 index.
  for (const [button, column] of [['Perps', 'Open interest'], ['Sectors', '24h net flow'], ['Predictions', '24h volume']]) {
    await views.getByRole('button', { name: button, exact: true }).click();
    await expect(views.getByRole('button', { name: button, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('tab', { name: 'table', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: 'Index / 100' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    await page.getByRole('tab', { name: 'map', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`${button.toLowerCase()}.png`), fullPage: true });
  }
  await expect(page.getByText(/Not net YES\/NO flow/)).toBeVisible();
  await views.getByRole('button', { name: 'Chain flows', exact: true }).click();
  // Only chains with a reading get a tile; the grid opens on the strongest and weakest.
  const measured = ((await (await page.request.get('/api/weather')).json()).chains as Array<{ cpi: number | null }>).filter((c) => c.cpi != null).length;
  const showAll = page.getByRole('button', { name: `Show all ${measured} chains` });
  // The grid draws after the view switch; look for its "Show all" only once it is there.
  await expect(page.locator('[aria-label="Chains by Flow Index"]:visible a').first()).toBeVisible();
  if (await showAll.isVisible()) await showAll.click();
  await expect(page.locator('[aria-label="Chains by Flow Index"]:visible a')).toHaveCount(measured);
  expect(errors).toEqual([]);
});

// Live state simulated in the browser only: with the shared category cache expired, opening the layer loads it
// once (1 credit, confirmed in the request), then the layer refetches and fills in place.
test('prediction layer: an expired cache loads once on open, then fills in place', async ({ page, request }) => {
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
  await page.getByRole('group', { name: 'Overview views' }).getByRole('button', { name: 'Predictions', exact: true }).click();
  // While it loads, the view says so: never that there is no activity.
  await expect(page.getByRole('heading', { name: /^Loading prediction activity|is running/ })).toBeVisible();
  await expect(page.getByText(/No fresh prediction activity|No prediction activity right now/)).toHaveCount(0);
  // Opening the layer asks for the categories by itself; once they are in, the layer fills with readings.
  await expect(async () => {
    await page.clock.fastForward(61_000);
    expect(posts.length).toBeGreaterThan(0);
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText('No fresh shared category observation', { exact: false })).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole('tab', { name: 'table', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Index / 100' })).toBeVisible();
  expect(posts).toEqual([{ confirmCredits: 1 }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
