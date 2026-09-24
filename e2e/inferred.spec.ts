import { test, expect } from '@playwright/test';

test('inference: public requests cannot inspect or refresh private evidence', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Inferred rotations · evidence, not ownership' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Check funding evidence/ })).toHaveCount(0);
  expect((await request.post('/api/weather/inferred', { data: { confirmCredits: 12 } })).status()).toBe(403);
  expect((await (await request.get('/api/weather')).json()).inference).toBeNull();
});

// Synthetic private response only inside this browser test. Never seeded into
// demo fixtures or passed off as a real Nansen observation.
test('inference: synthetic candidate has dashed arcs and inspectable evidence @mobile', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = await (await request.get('/api/weather')).json();
  const now = base.generatedAt;
  const match = { seller: { address: 'SyntheticSolanaWalletCaseSensitive12345', chain: 'solana' }, buyer: { address: `0x${'1'.repeat(40)}`, chain: 'base' }, sellAt: now - 2000, buyAt: now - 1000, soldUsd: 100, boughtUsd: 80, matchedUsd: 80, group: 'synthetic-group', evidence: { child: { address: 'SyntheticSolanaWalletCaseSensitive12345', chain: 'solana' }, funder: { address: `0x${'1'.repeat(40)}`, chain: 'base' }, at: now - 3000, transactionHash: 'SYNTHETIC-funding-evidence', endpoint: 'profiler/address/related-wallets', request: {} } };
  const front = { from: 'solana', to: 'base', netUsd: 160, grossForward: 160, grossBack: 0, walletCount: 2, confidence: 0.49, inferred: true, wallets: [], evidence: [match], provenance: { title: 'Synthetic test evidence', formula: 'Not live data', inputs: [], calls: [], notes: [] } };
  await page.route('**/api/weather', (route) => route.fulfill({ json: { ...base, mode: 'private', inference: { at: now, checked: 6, links: 2, stale: false, failures: 0, maxCredits: 12, fronts: [front] } } }));
  if (test.info().project.name === 'phone') {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => localStorage.setItem('tide-theme', 'paper'));
  }
  await page.clock.install();
  await page.goto('/');
  const toggle = page.getByRole('checkbox', { name: 'Show inferred candidates as dashed arcs on the spot map' });
  // The 60s poll timer only exists after hydration; advance until it has fired.
  await expect(async () => {
    await page.clock.fastForward(61_000);
    await expect(toggle).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await toggle.check();
  await expect(page.locator('svg path[stroke-dasharray="6 5"]')).toHaveCount(1);
  await page.getByRole('button', { name: /Solana.*Base.*Inferred/ }).click();
  await expect(page.getByRole('heading', { name: 'Inferred: Solana → Base' })).toBeVisible();
  await expect(page.getByText(/Funding transaction: SYNTHETIC/)).toBeVisible();
  await expect(page.getByRole('link', { name: match.seller.address })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('inferred-evidence.png') });
});
