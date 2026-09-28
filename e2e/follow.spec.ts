import { test, expect } from './fixtures';

// L4: smart-money follow-through. Public/demo views explain why it's owner-only;
// the owner flow runs on a private instance (PRIVATE_E2E_URL, or the trading
// suite's TRADE_E2E_URL) with /api/follow stubbed: no Nansen call, no spend.
const AERO = '/token/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631';

test('follow-through: public views explain it is owner-only, and make no call', async ({ page }) => {
  const calls: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/follow')) calls.push(r.url()); });
  await page.goto(`${AERO}?view=flow`);
  const card = page.locator('section', { has: page.getByRole('heading', { name: 'Did anyone follow smart money?' }) });
  await expect(card).toContainText('runs only for the instance owner', { timeout: 60_000 });
  expect(calls).toEqual([]);
});

const PRIVATE = process.env.PRIVATE_E2E_URL ?? process.env.TRADE_E2E_URL;
test.describe('owner', () => {
  test.skip(!PRIVATE, 'Set PRIVATE_E2E_URL to a private (owner) instance.');
  test.use({ baseURL: PRIVATE });
  test('follow-through: shows the stored events, asks for the price, then lists each event with its verdict @mobile', async ({ page }) => {
    const posts: unknown[] = [];
    const e = Date.parse('2026-09-23T14:00:00Z');
    const stats = (buyers: number, perMin: number, truncated = false) => ({ buyers, buyUsd: 1000, sellUsd: 200, coveredMin: 10, truncated, perMin });
    const report = { chain: 'base', token: '0x940181a94a35a4569e4529a3cdfb74e38fd98631', at: e + 30 * 3_600_000, credits: 7, notes: [], calls: [{ endpoint: 'tgm/dex-trades', body: {}, credits: 1, ref: 'live' }],
      results: [
        { event: { t: e, wallets: ['0xaa', '0xbb'], usd: 12_500, buys: 3 }, labels: ['Smart Trader'], before: stats(2, 0.2), after: stats(9, 0.9, true), ratio: 3.67, verdict: 'followed', outcome: { from: 1, to: 1.04, ret: 0.04 }, outcomePending: false },
        { event: { t: e - 5 * 3_600_000, wallets: ['0xcc'], usd: 2_000, buys: 1 }, labels: [], before: stats(6, 0.6), after: stats(3, 0.3), ratio: 0.57, verdict: 'ignored', outcome: { from: 1, to: 0.98, ret: -0.02 }, outcomePending: false },
      ],
      summary: { events: 2, judged: 2, followed: 1, ignored: 1, medianAfterFollowed: 0.04, medianAfterOthers: -0.02 } };
    await page.route('**/api/follow?*', (r) => r.fulfill({ json: { candidates: { events: 2, buys: 4 }, report: null, maxCredits: 21 } }));
    await page.route('**/api/follow', (r) => { posts.push(r.request().postDataJSON()); return r.fulfill({ json: { report } }); });
    await page.goto(`${AERO}?view=flow`);
    const card = page.locator('section', { has: page.getByRole('heading', { name: /follow smart money|Followed \d/ }) });
    await expect(card).toContainText('4 smart-money buys of this token (≥ $250) in the last 7 days, grouped into 2 events', { timeout: 60_000 });
    await card.getByRole('button', { name: 'Check follow-through · up to 21 credits' }).click();
    await expect(page.getByRole('heading', { name: 'Followed 1 of 2 smart-money buys within 10 minutes' })).toBeVisible();
    await expect(card.getByRole('row')).toHaveCount(3);
    await expect(card.getByRole('row').nth(1)).toContainText(/0\.20 → 0\.90.*2 → 9 buyers · tape cut.*followed.*\+4\.0%/);
    await expect(card).toContainText('Median 24h after followed buys +4.0%, after the rest −2.0%. 2 events is an anecdote');
    expect(posts).toEqual([{ chain: 'base', token: '0x940181a94a35a4569e4529a3cdfb74e38fd98631', confirmCredits: 21 }]);
    await card.screenshot({ path: test.info().outputPath('follow.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
});
