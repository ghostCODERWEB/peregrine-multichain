import { test, expect, type Page } from '@playwright/test';

// M1 universal search, keyboard first, against the keyless demo (recorded
// Nansen responses): ⌘K/Ctrl+K opens the omnibox, results come from
// Nansen's search, arrows move, Enter opens. Plus the entity page and
// sector weather.

async function openOmnibox(page: Page) {
  await page.goto('/');
  const box = page.getByRole('combobox');
  // The shortcut listener exists only after hydration (slow on a cold server).
  await expect(async () => {
    if (!(await box.isVisible())) await page.keyboard.press('Control+k');
    await expect(box).toBeFocused({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  return box;
}

test('omnibox: type a name, Enter opens the top token', async ({ page }) => {
  const box = await openOmnibox(page);
  await box.fill('aerodrome');
  await expect(page.getByRole('option').first()).toContainText('AERO · Aerodrome');
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
  await box.press('Enter');
  // Navigation waits for the route to load (a first compile in dev can take a while).
  await expect(page).toHaveURL(/\/token\/base\/0x940181a94a35a4569e4529a3cdfb74e38fd98631/, { timeout: 60_000 });
});

test('omnibox: arrow to an entity, Enter opens its page with Nansen-aggregated holdings', async ({ page }) => {
  const box = await openOmnibox(page);
  await box.fill('aerodrome');
  const entity = page.getByRole('option', { name: /Aerodrome Finance/ });
  await expect(entity).toBeVisible();
  // Move down until the entity is the active option.
  for (let i = 0; i < 8 && (await entity.getAttribute('aria-selected')) !== 'true'; i++) await box.press('ArrowDown');
  await expect(entity).toHaveAttribute('aria-selected', 'true');
  await box.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Aerodrome Finance' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { name: /across \d+ chains?/ })).toBeVisible({ timeout: 30_000 });
});

test('omnibox: an address is recognized in the browser and opens its wallet page', async ({ page }) => {
  const box = await openOmnibox(page);
  await box.fill('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
  await expect(page.getByText('Looks like EVM address')).toBeVisible();
  await expect(page.getByRole('option', { name: /Wallet 0xd8dA…6045/ })).toBeVisible();
  await box.press('Enter');
  await expect(page).toHaveURL(/\/wallet\/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/, { timeout: 60_000 });
});

test('omnibox: Escape closes and returns focus to the search button', async ({ page }) => {
  const box = await openOmnibox(page);
  await box.press('Escape');
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Search tokens, wallets/ })).toBeFocused();
});

test('sectors: tiles scored on the pressure scale, or a plain reason', async ({ page }) => {
  await page.goto('/sectors');
  const tiles = page.locator('#sectors ~ * li[id], section[aria-labelledby="sectors"] li[id]');
  const reason = page.getByText(/Sector membership has not been built yet|No sector snapshots yet/);
  await expect(tiles.first().or(reason)).toBeVisible();
  if (await tiles.count()) {
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/rotating into|lean most toward|pressure|flow/);
    await expect(page.getByText(/Public view: all-trader flows/)).toBeVisible();
  }
});
