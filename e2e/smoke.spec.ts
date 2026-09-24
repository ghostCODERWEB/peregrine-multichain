import { test, expect, type Page } from '@playwright/test';

// Demo-mode tokens and wallets: recorded live, replayed from fixtures.
const TOKEN = '/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722';
const WALLET = '/wallet/0xcbb811f129782ef87e19dea9d3375045219bae00';

/** Fails the test on any uncaught page error or console error, and on any
 *  horizontal overflow (the layout must fit the viewport). */
async function watch(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Download the React DevTools/.test(m.text())) errors.push(`console: ${m.text()}`); });
  return {
    errors,
    async noOverflow() {
      const [doc, win] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(doc, 'page scrolls sideways').toBeLessThanOrEqual(win + 1);
    },
  };
}

test('home: all 38 chains on the map, fronts, storm ticker, anchor @mobile', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('svg[aria-label^="Hex map"] a')).toHaveCount(38); // one link per chain
  await expect(page.getByRole('heading', { name: /Storm warnings/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /weather report/i })).toBeVisible();
  await w.noOverflow();
  expect(w.errors).toEqual([]);
});

test('chain page: Tier A with every module, and an unsupported chain says so', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/chain/base');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Base');
  await expect(page.locator('#flows')).toBeVisible();
  await expect(page.locator('#tape')).toBeVisible();
  // V4: the hero's pressure ring, the market grid and the chain ranking.
  await expect(page.getByRole('img', { name: /^Chain Pressure Index \d+ of 100$/ })).toBeVisible();
  await expect(page.locator('#grid')).toBeVisible();
  await expect(page.locator('section[aria-labelledby="grid"]')).toContainText(/most-traded tokens up|Nansen/);
  await expect(page.getByRole('list', { name: /Chains by DEX volume|Chains by/ })).toBeVisible();
  await w.noOverflow();
  await page.goto('/chain/algorand');
  await expect(page.getByText(/Not available on Algorand in Nansen API/).first()).toBeVisible();
  expect(w.errors).toEqual([]);
});

test('token page: waves stream in and the Storm Score lands @mobile', async ({ page }) => {
  const w = await watch(page);
  await page.goto(`${TOKEN}?view=all`);
  await expect(page.getByRole('heading', { name: /Storm Score: \d+ of 100/ })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('svg[aria-label^="Wind rose"]')).toBeVisible();
  await expect(page.locator('svg[aria-label^="Wind rose"] path')).toHaveCount(24); // 6 segments × 4 windows
  await expect(page.locator('#odds')).toBeVisible();
  await expect(page.getByText(/This page: \d+ Nansen calls/)).toBeVisible({ timeout: 60_000 });
  // The hero carries the Storm ring once the score lands.
  await expect(page.getByRole('region', { name: /Storm/ }).first().getByRole('img', { name: /^Storm Score \d+ of 100$/ })).toBeVisible();
  // The terminal (M2): tape, transfer river, social pulse; owner-only
  // sections say why they are withheld in the public demo.
  await expect(page.getByRole('heading', { name: /buyers vs \d+ sellers in the latest \d+ trades/ })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="river"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Social heat \d+|Social pulse/ })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="pnlboard"]')).toContainText('Nansen does not allow its PnL leaderboard in public views');
  await expect(page.getByText(/Storm v2 candidates/)).toBeVisible();
  // V3 visuals: the holder sphere, cohort bars and the liquidation ladder
  // (or Nansen's plain reason there is none).
  await expect(page.locator('svg[aria-label^="Holder constellation"]')).toBeVisible();
  await expect(page.getByRole('list', { name: /Net flow by segment, 1d/ })).toBeVisible();
  await expect(page.locator('section[aria-labelledby="leverage"]')).toContainText(/Mark|No open Hyperliquid perp positions|No recorded fixture|not available/);
  await w.noOverflow();
  expect(w.errors).toEqual([]);
});

test('token views: tabs switch the layout and keep it in the URL', async ({ page }) => {
  const w = await watch(page);
  await page.goto(TOKEN);
  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#sphere')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('#tape')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Terminal' }).click();
  await expect(page).toHaveURL(/view=terminal/);
  await expect(page.locator('#tape')).toBeVisible();
  await expect(page.locator('#sphere')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Leverage' }).click();
  await expect(page.locator('#leverage')).toBeVisible();
  await expect(page.locator('#positions')).toBeVisible();
  await w.noOverflow();
  expect(w.errors).toEqual([]);
});

test('token terminal: a trade opens its transaction; news loads on request', async ({ page }) => {
  await page.goto(`${TOKEN}?view=terminal`);
  const firstTrade = page.locator('section[aria-labelledby="tape"] tbody tr').first();
  await expect(firstTrade).toBeVisible({ timeout: 60_000 });
  await firstTrade.click();
  const dialog = page.getByRole('dialog', { name: 'Transaction' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Succeeded|Failed|Nansen did not find|No recorded fixture|not available/)).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('wallet page: balances and the migration trail', async ({ page }) => {
  const w = await watch(page);
  await page.goto(WALLET);
  await expect(page.locator('#trail')).toBeVisible();
  // While a streamed section swaps in, its loading card and the resolved one
  // briefly coexist (both carry the id): wait for the swap to finish.
  await expect(page.locator('#bal')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('#bal')).toBeVisible();
  expect(w.errors).toEqual([]);
});

test('alpha: leaders with score rings and a filterable board, or a plain reason @mobile', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/alpha');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const board = page.locator('section[aria-labelledby="alpha-board"]');
  const reason = page.getByText(/The Alpha board builds from the scanner/);
  await expect(board.or(reason)).toBeVisible();
  if (await board.count()) {
    await expect(page.getByRole('img', { name: /alpha score \d+ of 100/ }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: /All chains/ })).toHaveAttribute('aria-selected', 'true');
  }
  await w.noOverflow();
  expect(w.errors).toEqual([]);
});

test('smart-money desk: the demo (a public view) explains it is private @mobile', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/smart-money');
  await expect(page.getByRole('heading', { name: 'The smart-money desk is private' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Sign in with your Nansen key/ })).toBeVisible();
  await w.noOverflow();
  expect(w.errors).toEqual([]);
});

test('perps: pressure grid, crowding map, and a coin opens its ladder @mobile', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/perps');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Hyperliquid perps/);
  const tiles = page.getByRole('list', { name: /coins by Perp Pressure Index/ }).getByRole('button');
  await expect(tiles.first()).toBeVisible();
  await expect(page.locator('svg[aria-label^="Crowding map"]')).toBeVisible();
  await tiles.first().click();
  await expect(page.locator('section[aria-labelledby="coin-ladder"]')).toBeVisible();
  await expect(page.locator('section[aria-labelledby="coin-ladder"]')).toContainText(/Mark|No open Hyperliquid|No recorded fixture|Nansen/, { timeout: 60_000 });
  await w.noOverflow();
  expect(w.errors).toEqual([]);
});

test('predictions: category weather, repricing, and a market opens its detail @mobile', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/predict');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Prediction categories by heat' }).getByRole('listitem').first()).toBeVisible();
  const market = page.locator('section[aria-labelledby="markets"] tbody tr').first();
  await expect(market).toBeVisible();
  await market.click();
  await expect(page.locator('section[aria-labelledby="pm-price"]')).toBeVisible();
  await expect(page.locator('section[aria-labelledby="pm-price"]')).toContainText(/implied probability|No recorded fixture|Nansen/, { timeout: 60_000 });
  await w.noOverflow();
  expect(w.errors).toEqual([]);
});

test('agents: research agent explains it runs on a key; MCP answers tools/list @mobile', async ({ page, request }) => {
  const w = await watch(page);
  await page.goto('/agent');
  await expect(page.getByRole('heading', { name: 'Research agent' })).toBeVisible();
  await expect(page.getByText(/runs on a Nansen key/)).toBeVisible();
  await w.noOverflow();
  expect(w.errors).toEqual([]);
  const init = await request.post('/api/mcp', { data: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '0' } } } });
  expect((await init.json()).result.serverInfo.name).toBe('tide');
  const list = await request.post('/api/mcp', { data: { jsonrpc: '2.0', id: 2, method: 'tools/list' } });
  const names = ((await list.json()).result.tools as Array<{ name: string }>).map((t) => t.name);
  expect(names).toEqual(expect.arrayContaining(['tide_weather', 'tide_storm', 'tide_perps']));
  const call = await request.post('/api/mcp', { data: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'tide_weather', arguments: {} } } });
  expect((await call.json()).result.content[0].text).toContain('Nansen API, via Peregrine');
});

test('trade: off unless the operator turns it on, and says so', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/trade');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Swap with Peregrine');
  await expect(page.getByText(/Trading is off on this instance|Trading runs on a Nansen key/)).toBeVisible();
  expect(w.errors).toEqual([]);
});

test('lab, coverage and alerts render', async ({ page }) => {
  const w = await watch(page);
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: /Storm \(≥50% drawdown/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why the weights stay expert priors' })).toBeVisible();
  await page.getByRole('button', { name: 'Test the rule' }).click();
  await expect(page.locator('section[aria-labelledby="strategy"]')).toContainText(/hours later/);
  await page.goto('/coverage');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('38 chains');
  await page.goto('/alerts');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Alerts that keep watching');
  expect(w.errors.filter((e) => !/alerts/.test(e))).toEqual([]);
});
