import { test, expect, type Page } from './fixtures';

// L5: ⌘K commands on the recorded demo. Typing previews for free (Nansen's
// search); a priced command runs only on Enter.
/** The palette's own results: pages also have <option>s (a pager's rows-per-page select). */
const results = (page: Page) => page.getByRole('dialog', { name: 'Search' });

async function palette(page: Page, text: string) {
  await page.goto('/');
  // Named: pages also carry other comboboxes (a pager's rows-per-page select).
  const box = page.getByRole('combobox', { name: 'Search Peregrine' });
  await expect(async () => {
    if (!(await box.isVisible())) await page.keyboard.press('Control+k');
    await expect(box).toBeFocused({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await box.fill(text);
  return box;
}

test('commands: "/" lists what each command does and costs', async ({ page }) => {
  await palette(page, '/');
  const who = results(page).getByRole('option').filter({ hasText: '/who-bought TOKEN 6h' });
  await expect(who).toContainText('1 credit');
  await expect(results(page).getByRole('option').filter({ hasText: '/replay TOKEN 24h' })).toContainText('opens a page');
  await expect(results(page).getByRole('option')).toHaveCount(9);
});

test('commands: /replay opens the Time Machine at the asked window', async ({ page }) => {
  const box = await palette(page, '/replay aerodrome 7d');
  const opt = results(page).getByRole('option').first();
  await expect(opt).toContainText('Time Machine: AERO · Aerodrome at T−7d', { timeout: 30_000 });
  await expect(opt).toContainText('free');
  await box.press('Enter');
  await expect(page).toHaveURL(/\/replay\/base\/0x940181a94a35a4569e4529a3cdfb74e38fd98631\?at=7d/, { timeout: 30_000 });
  await expect(page.getByLabel('Replay window')).toHaveValue('7d');
});

test('commands: /ask opens Analyze with Nansen on the token page, with suggestions for it', async ({ page }) => {
  const box = await palette(page, '/ask aerodrome');
  const opt = results(page).getByRole('option').first();
  await expect(opt).toContainText('Ask Nansen about AERO · Aerodrome (750 credits, confirmed there)', { timeout: 30_000 });
  await box.press('Enter');
  await expect(page).toHaveURL(/\/token\/base\/0x940181a94a35a4569e4529a3cdfb74e38fd98631\?ask=1/, { timeout: 30_000 });
  // The panel's code loads on first open, after the token page itself: allow for it.
  const panel = page.getByRole('dialog', { name: 'Analyze with Nansen' });
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel.getByRole('button', { name: 'Analyze this page' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('commands: "who bought $aerodrome last 6h" shows its price, spends nothing until Enter, then answers inline @mobile', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (r) => { if (r.url().endsWith('/api/command') && r.method() === 'POST') posts.push(r.url()); });
  const box = await palette(page, 'who bought $aerodrome last 6h');
  const opt = results(page).getByRole('option').first();
  await expect(opt).toContainText('Who bought AERO · Aerodrome on Base in the last 6h', { timeout: 30_000 });
  await expect(opt).toContainText('1 credit');
  expect(posts).toEqual([]);
  await box.press('Enter');
  await expect(results(page).getByRole('option').filter({ hasText: /Wallet$/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Recorded demo: the recorded 7-day buyers and sellers, not the window you typed\..*tgm\/who-bought-sold · 0 credits/)).toBeVisible();
  expect(posts).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('dialog', { name: 'Search' }).screenshot({ path: test.info().outputPath('commands.png') });
});
