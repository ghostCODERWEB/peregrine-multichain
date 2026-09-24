import { test, expect } from '@playwright/test';

// L5a: Ask Nansen, the contextual research panel. Opening it must never call
// the paid agent route. The wallet page renders it from a Server Component
// (no client-side render prop reaching across the RSC boundary), which is
// the regression this guards. Public/demo views explain it's gated behind a
// Nansen key, same as the full /agent page; the owner-only content (context
// lines, starters, price confirmation) is stubbed on a private instance,
// following the same pattern as follow.spec.ts.
const WALLET = '/wallet/0xcbb811f129782ef87e19dea9d3375045219bae00';
const CHAIN = '/chain/base';
const AERO = '/token/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631';

test('Ask Nansen: opens from the wallet page (a Server Component) with no agent call, and explains public access @mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const agentCalls: string[] = [];
  page.on('request', (r) => { if (r.url().endsWith('/api/agent') && r.method() === 'POST') agentCalls.push(r.url()); });

  await page.goto(WALLET);
  const before = new Set(await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((name) => name.endsWith('.js'))));
  await page.getByRole('button', { name: 'Ask Nansen' }).click();
  await expect(page.getByRole('dialog', { name: 'Ask Nansen' })).toBeVisible();
  await expect(page.getByText(/runs on a Nansen key/)).toBeVisible();
  await expect.poll(async () => (await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name).filter((name) => name.endsWith('.js')))).filter((name) => !before.has(name)).length).toBeGreaterThan(0);
  expect(agentCalls).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('Ask Nansen: opens from the chain page and from the token call card, both with no agent call', async ({ page }) => {
  await page.goto(CHAIN);
  await page.getByRole('button', { name: 'Ask Nansen' }).click();
  await expect(page.getByRole('dialog', { name: 'Ask Nansen' })).toBeVisible();
  await expect(page.getByText(/runs on a Nansen key/)).toBeVisible();
  await page.keyboard.press('Escape');

  await page.goto(AERO);
  const card = page.locator('section', { has: page.getByRole('heading', { name: /^Make a call on/ }) });
  await card.getByRole('button', { name: 'Ask Nansen' }).click();
  await expect(page.getByRole('dialog', { name: 'Ask Nansen' })).toBeVisible();
  await expect(page.getByText(/runs on a Nansen key/)).toBeVisible();
});

// Owner-only content: the visible context lines, starters and price
// confirmation, with /api/agent stubbed so no live agent call or key is
// needed. Runs only against a private (owner-mode) instance.
const PRIVATE = process.env.PRIVATE_E2E_URL ?? process.env.TRADE_E2E_URL;
test.describe('owner', () => {
  test.skip(!PRIVATE, 'Set PRIVATE_E2E_URL to a private (owner) instance.');
  test.use({ baseURL: PRIVATE });

  test('Ask Nansen: shows page context with receipts and starters on open, never calling the paid agent route', async ({ page }) => {
    const agentPosts: unknown[] = [];
    const context = {
      title: 'AERO on Base', view: 'private',
      lines: [
        { label: 'Token', value: 'AERO (0x9401…8631) on Base', at: null, source: 'the page address' },
        { label: 'Storm Score (7-day dump risk, 0–100)', value: '40, Cloudy, confidence 0.70', at: Date.now() - 3_600_000, source: 'Peregrine Dive Risk from Nansen holders, flows and indicators' },
      ],
    };
    await page.route('**/api/agent?*', (r) => r.fulfill({ json: { reports: [], usedToday: 0, cap: 2, price: 750, context, starters: ['Who has been buying AERO this week, and do those buyers have a profitable record?'], demo: false } }));
    await page.route('**/api/agent', (r) => { agentPosts.push(r.request().method()); return r.continue(); });
    await page.goto(AERO);
    const card = page.locator('section', { has: page.getByRole('heading', { name: /^Make a call on/ }) });
    await card.getByRole('button', { name: 'Ask Nansen' }).click();
    await expect(page.getByRole('dialog', { name: 'Ask Nansen' })).toBeVisible();
    await expect(page.getByText('What Peregrine will send with your first question')).toBeVisible();
    await expect(page.getByText(/Storm Score \(7-day dump risk, 0–100\): 40, Cloudy, confidence 0\.70/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Who has been buying AERO this week/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ask \(750 credits\)$/ })).toBeDisabled(); // no question typed yet
    expect(agentPosts.some((m) => m === 'POST')).toBe(false);
  });

  test('Ask Nansen: chain-page starters name the chain', async ({ page }) => {
    await page.route('**/api/agent?*', (r) => r.fulfill({ json: { reports: [], usedToday: 0, cap: 2, price: 750, context: { title: 'the Base chain page', view: 'private', lines: [] }, starters: ['Where is smart money moving on Base this week, and into which tokens?'], demo: false } }));
    await page.goto(CHAIN);
    await page.getByRole('button', { name: 'Ask Nansen' }).click();
    await expect(page.getByRole('dialog', { name: 'Ask Nansen' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Where is smart money moving on Base/ })).toBeVisible();
  });
});
