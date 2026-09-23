import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'node:path';

// Public-mode redaction (Nansen Data Redistribution Guidelines). Runs
// against a PUBLIC instance whose database holds real private data — by
// default `pnpm dev:demo` (:3300); set REDACTION_URL/REDACTION_DB to point at
// a live public instance (e.g. :3301 on data/tide.db) for the stronger test.
// It reads the real Nansen labels and smart-money wallets from that
// database, then asserts none of them appear anywhere public.
const BASE = process.env.REDACTION_URL ?? process.env.E2E_URL ?? 'http://localhost:3300';
const DB = process.env.REDACTION_DB ?? 'data/demo.db';

function secrets(): { labels: string[]; wallets: string[]; counterpartyLabels: string[] } {
  try {
    const db = new Database(path.resolve(DB), { readonly: true, fileMustExist: true });
    const labels = (db.prepare("SELECT DISTINCT wallet_label AS l FROM smart_money_trades WHERE wallet_label IS NOT NULL AND length(wallet_label) > 6 LIMIT 200").all() as Array<{ l: string }>).map((r) => r.l);
    const wallets = (db.prepare('SELECT wallet AS w FROM smart_money_trades GROUP BY wallet ORDER BY COUNT(*) DESC LIMIT 40').all() as Array<{ w: string }>).map((r) => r.w);
    // Every counterparty label Nansen returned to this instance (cached raw).
    const counterpartyLabels = new Set<string>();
    for (const r of db.prepare("SELECT body FROM response_cache WHERE endpoint = 'profiler/address/counterparties'").all() as Array<{ body: string }>) {
      try {
        const rows = (JSON.parse(r.body) as { data?: Array<{ counterparty_address_label?: string[] | null }> }).data ?? [];
        for (const x of rows) for (const l of x.counterparty_address_label ?? []) if (l && l.length > 6) counterpartyLabels.add(l);
      } catch { /* skip unreadable rows */ }
    }
    db.close();
    return { labels, wallets, counterpartyLabels: [...counterpartyLabels] };
  } catch {
    return { labels: [], wallets: [], counterpartyLabels: [] }; // a clean demo DB — also fine
  }
}

const { labels, wallets, counterpartyLabels } = secrets();
// Behavioral labels Nansen attaches to holders/traders; must not surface publicly either.
const GENERIC = ['Token Millionaire', 'High Balance', 'Smart Trader', 'High Activity'];

function assertClean(where: string, text: string) {
  for (const l of [...labels, ...GENERIC]) expect(text.includes(l), `${where} leaks label "${l}"`).toBe(false);
}

test.describe.configure({ mode: 'serial' });
test.use({ baseURL: BASE });

test('public header: public view, attribution, no credit balance', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Public view').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Powered by Nansen API' }).first()).toBeVisible();
  await expect(page.locator('text=/\\d[\\d,]* cr$/')).toHaveCount(0);
});

test('home: fronts withheld, no labels or smart-money wallets', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /key-owner view only/ })).toBeVisible();
  const html = await page.content();
  assertClean('home', html);
  for (const w of wallets.slice(0, 20)) expect(html.includes(w), `home leaks smart-money wallet ${w}`).toBe(false);
});

test('weather API and public API expose no private data', async ({ request }) => {
  const w = await (await request.get('/api/weather')).json();
  expect(w.mode).toBe('public');
  expect(w.fronts).toEqual([]);
  for (const c of w.chains) if (c.source) expect(c.source).toBe('market-flow');
  assertClean('/api/weather', JSON.stringify(w));
  expect((await request.get('/api/public/fronts')).status()).toBe(403);
  const f = await (await request.get('/api/public/forecast?chain=base')).json();
  expect(f.measured_from === null || f.measured_from === 'market-flow').toBe(true);
});

test('chain page: all-trader flows, trade tape and sectors withheld', async ({ page }) => {
  await page.goto('/chain/base');
  const text = await page.locator('main').innerText();
  expect(text).toMatch(/Shown only to (the API key owner|this instance's owner)/);
  expect(text).not.toMatch(/Latest smart-money trades on Base\s*\n\s*WHEN/);
  assertClean('/chain/base', await page.content());
});

test('token page: every wave arrives with labels stripped', async ({ page }) => {
  await page.goto('/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722');
  await expect(page.getByText(/this page: \d+ Nansen calls/)).toBeVisible({ timeout: 90_000 });
  assertClean('/token/base/NOCK', await page.content());
});

test('entity page: counterparties and every section without labels, flight data included', async ({ page }) => {
  const entity = 'Aerodrome Finance';
  await page.goto(`/entity/${encodeURIComponent(entity)}`);
  await expect(page.getByRole('heading', { level: 1, name: entity })).toBeVisible();
  await expect(page.locator('#cp')).toBeVisible({ timeout: 60_000 });
  const html = await page.content(); // includes the inline RSC payload scripts
  assertClean('/entity', html);
  // The page's own subject (and any label that is part of its name) is shown by design.
  const own = (l: string) => entity.toLowerCase().includes(l.toLowerCase()) || l.toLowerCase().includes(entity.toLowerCase());
  for (const l of counterpartyLabels) if (!own(l)) expect(html.includes(l), `/entity leaks counterparty label "${l}"`).toBe(false);
});

test('coverage: ledger shown, operator sections (per-key usage, errors, jobs, payments) withheld', async ({ page }) => {
  await page.goto('/coverage');
  await expect(page.getByRole('heading', { name: /Nansen API operations in use/ })).toBeVisible();
  await expect(page.getByText(/shown to this instance's owner only/)).toBeVisible();
  await expect(page.getByText(/Operator view/)).toHaveCount(0);
  await expect(page.locator('#users, #errors, #jobs, #payments, #drift')).toHaveCount(0);
});

test('wallet page: trail withheld, labels stripped', async ({ page }) => {
  await page.goto('/wallet/0xcbb811f129782ef87e19dea9d3375045219bae00');
  await expect(page.getByText(/trail is built from Nansen smart-money DEX trades/)).toBeVisible();
  await page.waitForTimeout(3000); // streamed sections
  const html = await page.content();
  assertClean('/wallet', html);
  for (const l of counterpartyLabels) expect(html.includes(l), `/wallet leaks counterparty label "${l}"`).toBe(false);
});
