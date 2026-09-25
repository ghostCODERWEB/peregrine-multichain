import { test, expect } from '@playwright/test';

// P3: Capital Flows, the animated chain-to-chain rotation map. Rotations come
// from Nansen smart-money DEX trades, so public views get a locked panel and
// the endpoint refuses them; the owner flow runs on synthetic, clearly fake
// data stubbed into the page (no Nansen call, no live data).
test('capital flows: public views are locked, and the flows API refuses them', async ({ page, request }) => {
  expect((await request.get('/api/weather/flows?hours=48')).status()).toBe(403);
  await page.goto('/');
  const flows = page.locator('section[aria-labelledby="fronts-title"]');
  await expect(flows.getByRole('heading', { name: 'Capital flows: key-owner view only' })).toBeVisible();
  await expect(flows.getByRole('link', { name: 'Use my Nansen key' })).toHaveAttribute('href', '/account');
  await expect(flows.locator('animateMotion')).toHaveCount(0);
  await page.goto('/chain/base');
  await expect(page.locator('section[aria-labelledby="fronts-title"]').getByRole('heading', { name: 'Capital flows: key-owner view only' })).toBeVisible();
});

test('capital flows: Radar has an orbital teaser, not the full detail (synthetic owner data) @mobile', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = await (await request.get('/api/weather')).json();
  const w = (addr: string, sold: string[], bought: string[], usdIn: number) => ({ wallet: addr, label: null, soldUsd: usdIn, boughtUsd: usdIn, soldTokens: sold, boughtTokens: bought });
  const prov = { title: 'Synthetic test flow', formula: 'Not live data', inputs: [], calls: [], notes: [] };
  const front = (from: string, to: string, netUsd: number, wallets: ReturnType<typeof w>[]) =>
    ({ from, to, netUsd, grossForward: netUsd, grossBack: 0, confidence: 0.9, walletCount: wallets.length, inferred: false, wallets, provenance: prov });
  const day = [
    front('base', 'robinhood', 50_000, [w(`0x${'a'.repeat(40)}`, ['AAA'], ['BBB'], 30_000), w(`0x${'b'.repeat(40)}`, ['AAA'], ['CCC'], 20_000)]),
    front('robinhood', 'ethereum', 6_000, [w(`0x${'c'.repeat(40)}`, ['BBB'], ['ETH'], 3_000), w(`0x${'d'.repeat(40)}`, ['BBB'], ['ETH'], 3_000)]),
  ];
  const twoDays = [...day, front('arbitrum', 'base', 2_000, [w(`0x${'e'.repeat(40)}`, ['ARB'], ['DDD'], 1_000), w(`0x${'f'.repeat(40)}`, ['ARB'], ['DDD'], 1_000)])];
  const asked: string[] = [];
  await page.route('**/api/weather', (r) => r.fulfill({ json: { ...base, mode: 'private', withheld: [], fronts: day } }));
  await page.route('**/api/weather/flows?*', (r) => { asked.push(new URL(r.request().url()).searchParams.get('hours')!); return r.fulfill({ json: { hours: 48, fronts: twoDays } }); });
  await page.clock.install();
  await page.goto('/');
  const flows = page.locator('section[aria-labelledby="fronts-title"]');
  // The bulletin poll that brings the owner data only runs after hydration.
  await expect(async () => {
    await page.clock.fastForward(61_000);
    await expect(flows.getByRole('heading', { name: 'Capital Flows', exact: true })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(flows.getByRole('listitem')).toHaveCount(2);
  await expect(page.locator('svg[aria-label^="Capital rotations"] animateMotion').first()).toBeAttached();
  await expect(flows.getByRole('list', { name: 'All flows' })).toHaveCount(0);
  await expect(flows.getByRole('link', { name: 'See all →' })).toHaveAttribute('href','/flows');
  expect(asked).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await flows.screenshot({ path: test.info().outputPath('capital-flows.png') });
  expect(errors).toEqual([]);
});

test('capital flows page: in the nav; public views get the measured net-flow map, not rotations', async ({ page }) => {
  await page.goto('/');
  if (test.info().project.name === 'desktop') {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Capital Flows' }).click();
    await expect(page).toHaveURL(/\/flows$/);
  } else {
    await page.goto('/flows');
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Capital Flows' })).toBeVisible();
  // Public: measured per-chain net flow with modeled arcs, never wallet-level rotations.
  const map = page.locator('section[aria-labelledby="netflow-title"]');
  await expect(map).toBeVisible();
  await expect(map.getByText(/nodes measured, arcs modeled|Not enough measured net flow/)).toBeVisible();
  await expect(page.locator('section[aria-labelledby="fronts-title"]')).toHaveCount(0);
  await expect(page.locator('#flow-days')).toHaveCount(0); // no rotation history for public views
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('capital flows: animated arcs, flow detail and window switch (synthetic owner data) @mobile', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = await (await request.get('/api/weather')).json();
  const w = (addr: string, sold: string[], bought: string[], usdIn: number) => ({ wallet: addr, label: null, soldUsd: usdIn, boughtUsd: usdIn, soldTokens: sold, boughtTokens: bought });
  const prov = { title: 'Synthetic test flow', formula: 'Not live data', inputs: [], calls: [], notes: [] };
  const front = (from: string, to: string, netUsd: number, wallets: ReturnType<typeof w>[]) =>
    ({ from, to, netUsd, grossForward: netUsd, grossBack: 0, confidence: 0.9, walletCount: wallets.length, inferred: false, wallets, provenance: prov });
  const day = [
    front('base', 'robinhood', 50_000, [w(`0x${'a'.repeat(40)}`, ['AAA'], ['BBB'], 30_000), w(`0x${'b'.repeat(40)}`, ['AAA'], ['CCC'], 20_000)]),
    front('robinhood', 'ethereum', 6_000, [w(`0x${'c'.repeat(40)}`, ['BBB'], ['ETH'], 3_000), w(`0x${'d'.repeat(40)}`, ['BBB'], ['ETH'], 3_000)]),
  ];
  const twoDays = [...day, front('arbitrum', 'base', 2_000, [w(`0x${'e'.repeat(40)}`, ['ARB'], ['DDD'], 1_000), w(`0x${'f'.repeat(40)}`, ['ARB'], ['DDD'], 1_000)])];
  const asked: string[] = [];
  await page.route('**/api/weather', (r) => r.fulfill({ json: { ...base, mode: 'private', withheld: [], fronts: day } }));
  await page.route('**/api/weather/flows?*', (r) => { asked.push(new URL(r.request().url()).searchParams.get('hours')!); return r.fulfill({ json: { hours: 48, fronts: twoDays } }); });
  await page.clock.install();
  await page.goto('/flows');
  const flows = page.locator('section[aria-labelledby="fronts-title"]');
  // The bulletin poll that brings the owner data only runs after hydration.
  await expect(async () => {
    await page.clock.fastForward(61_000);
    await expect(flows.getByRole('heading', { name: 'Capital rotating Base → Robinhood: $50.0K net, 2 wallets' })).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(flows.getByRole('list', { name: 'All flows' }).getByRole('listitem')).toHaveCount(2);
  await expect(flows.locator('animateMotion').first()).toBeAttached();
  await expect(flows.getByText('Sold on Base')).toBeVisible();
  await expect(flows.getByText('AAA', { exact: true })).toBeVisible();
  await flows.getByRole('button', { name: /Robinhood → Ethereum/ }).click();
  await expect(flows.getByText('Bought on Ethereum')).toBeVisible();
  await flows.getByRole('button', { name: '48h' }).click();
  await expect(flows.getByRole('list', { name: 'All flows' }).getByRole('listitem')).toHaveCount(3);
  expect(asked).toEqual(['48']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await flows.screenshot({ path: test.info().outputPath('capital-flows.png') });
  expect(errors).toEqual([]);
});
