import { test, expect } from '@playwright/test';

const TOKEN = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';

test('Time Machine: hidden outcome, lock, reveal, immutable replay in Desk @mobile', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `replay-${test.info().project.name}-${Date.now()}` });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (test.info().project.name === 'phone') {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('tide-theme', 'paper'));
  }
  await page.goto(`/replay/base/${TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Time Machine', exact: true })).toBeVisible();
  await page.getByLabel('Replay window').selectOption('1h');
  const preparing = page.waitForResponse((r) => r.url().endsWith('/api/replay') && r.request().postDataJSON()?.action === 'prepare');
  await page.getByRole('button', { name: /Load historical evidence/ }).click();
  const p = await (await preparing).json();
  expect(p).not.toHaveProperty('outcome');
  expect(p).not.toHaveProperty('path');
  expect(p.receipt.served).toBe('recorded');
  await expect(page.getByRole('heading', { name: /^What was known/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lock decision & reveal' })).toBeDisabled();
  await expect(page.getByRole('img', { name: /After the cutoff/ })).toHaveCount(0);
  await page.getByRole('radio', { name: 'PASS', exact: true }).click();
  await page.getByLabel('Replay thesis').fill('Recorded replay acceptance check');
  const revealing = page.waitForResponse((r) => r.url().endsWith('/api/replay') && r.request().postDataJSON()?.action === 'lock');
  await page.getByRole('button', { name: 'Lock decision & reveal' }).click();
  const r = await (await revealing).json();
  expect(r.call.source).toBe('replay');
  expect(r.call.grade).not.toBeNull();
  await expect(page.getByRole('img', { name: /After the cutoff/ })).toBeVisible();
  expect((await page.request.post('/api/replay', { data: { action: 'lock', id: p.id, stance: 'bull', setup: 'other' } })).status()).toBe(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('time-machine.png'), fullPage: true });
  await page.getByRole('link', { name: 'View replay in the Desk →' }).click();
  await expect(page.getByText('Time Machine replays', { exact: true })).toBeVisible();
  await expect(page.getByText('Recorded replay acceptance check', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Time Machine: all three recorded windows have evidence without future candles', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `windows-${Date.now()}` });
  await page.goto(`/replay/base/${TOKEN}`);
  for (const horizon of ['1h', '24h', '7d']) {
    await page.getByLabel('Replay window').selectOption(horizon);
    const pending = page.waitForResponse((r) => r.url().endsWith('/api/replay'));
    await page.getByRole('button', { name: /Load historical evidence/ }).click();
    const response = await pending;
    expect(response.ok()).toBe(true);
    const p = await response.json();
    expect(p.history.length).toBeGreaterThan(0);
    expect(p.readings.every((r: { at: number }) => r.at <= p.cut)).toBe(true);
    await expect(page.getByRole('img', { name: /After the cutoff/ })).toHaveCount(0);
  }
});
