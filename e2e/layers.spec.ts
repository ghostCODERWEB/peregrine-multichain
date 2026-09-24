import { test, expect } from '@playwright/test';

test('home weather layers preserve map and table views @mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  if (test.info().project.name === 'phone') {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Switch to paper chart theme' }).click();
  }
  for (const title of ['Perp pressure', 'Sector pressure', 'Prediction activity']) {
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
  await page.getByRole('button', { name: 'Spot pressure', exact: true }).click();
  await expect(page.locator('svg[aria-label^="Hex map"] a')).toHaveCount(38);
  expect(errors).toEqual([]);
});
