import { test, expect } from './fixtures';
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
// API calls come from the site's own pages: a public site answers only same-origin requests.
test.use({ extraHTTPHeaders: { referer: `${BASE}/` } });
// A refused public caller: 403 on a public view, 404 where a public site has the route switched off entirely.
const REFUSED = [403, 404];

function secrets(): { labels: string[]; wallets: string[]; counterpartyLabels: string[]; tradeLabels: string[] } {
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
    // Trader and transfer labels from the token terminal's calls.
    const tradeLabels = new Set<string>();
    for (const r of db.prepare("SELECT body FROM response_cache WHERE endpoint IN ('tgm/dex-trades', 'tgm/transfers', 'tgm/jup-dca')").all() as Array<{ body: string }>) {
      try {
        const rows = (JSON.parse(r.body) as { data?: Array<Record<string, unknown>> }).data ?? [];
        for (const x of rows) for (const k of ['trader_address_label', 'from_address_label', 'to_address_label', 'trader_label']) {
          const v = x[k];
          if (typeof v === 'string' && v.length > 8) tradeLabels.add(v);
        }
      } catch { /* skip */ }
    }
    db.close();
    return { labels, wallets, counterpartyLabels: [...counterpartyLabels], tradeLabels: [...tradeLabels] };
  } catch {
    return { labels: [], wallets: [], counterpartyLabels: [], tradeLabels: [] }; // a clean demo DB — also fine
  }
}

const { labels, wallets, counterpartyLabels, tradeLabels } = secrets();
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
  await expect(page.locator('text=/\\d[\\d,]* cr$/')).toHaveCount(0);
});

test('home: fronts withheld, no labels or smart-money wallets', async ({ page }) => {
  await page.goto('/');
  // Public mode shows as the withheld rotations card on a public view (demo), or, on a public site
  // (TIDE_PUBLIC_SITE=1, where that card can never unlock and is left out), as the Nansen attribution.
  await expect(page.getByRole('heading', { name: /key-owner view only/ }).or(page.getByText('Public view · Powered by Nansen API')).first()).toBeVisible();
  const html = await page.content();
  assertClean('home', html);
  for (const w of wallets.slice(0, 20)) expect(html.includes(w), `home leaks smart-money wallet ${w}`).toBe(false);
});

test('weather API and public API expose no private data', async ({ request }) => {
  const w = await (await request.get('/api/weather')).json();
  expect(w.mode).toBe('public');
  expect(w.fronts).toEqual([]);
  expect(w.inference).toBeNull();
  for (const c of w.chains) if (c.source) expect(c.source).toBe('market-flow');
  assertClean('/api/weather', JSON.stringify(w));
  expect(REFUSED).toContain((await request.get('/api/public/fronts')).status());
  const fr = await request.get('/api/public/forecast?chain=base');
  if (fr.status() === 200) { const f = await fr.json(); expect(f.measured_from === null || f.measured_from === 'market-flow').toBe(true); }
  else expect(REFUSED).toContain(fr.status());
});

test('chain page: all-trader flows, trade tape and sectors withheld', async ({ page }) => {
  await page.goto('/chain/base');
  const text = await page.locator('main').innerText();
  // A public view shows the lock; a public site (TIDE_PUBLIC_SITE=1) leaves the locked tape card out entirely.
  expect(/Shown only to (the API key owner|this instance's owner)/.test(text) || !/Latest smart-money trades on Base/.test(text)).toBe(true);
  expect(text).not.toMatch(/Latest smart-money trades on Base\s*\n\s*WHEN/);
  assertClean('/chain/base', await page.content());
});

test('token page: every wave arrives with labels stripped', async ({ page }) => {
  // Every card on one view, so every wave is on the page.
  await page.goto('/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722?view=all');
  // Every module has streamed in once the final Token Score heading lands.
  await expect(page.getByRole('heading', { name: /Token Score: \d+ of 100/ })).toBeVisible({ timeout: 90_000 });
  assertClean('/token/base/NOCK', await page.content());
});

test('token stream: terminal waves without labels, owner-only waves never sent', async ({ request }) => {
  const res = await request.get('/api/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722/stream', { timeout: 120_000 });
  const sse = await res.text();
  expect(sse).toContain('event: done');
  expect(sse).toContain('event: tape');
  expect(sse).not.toContain('event: positions'); // perp cohorts: label-derived
  expect(sse).not.toContain('event: pnlboard'); // Nansen prohibits it publicly
  assertClean('token stream', sse);
  for (const l of [...tradeLabels, ...counterpartyLabels]) expect(sse.includes(l), `token stream leaks label "${l}"`).toBe(false);
});

test('entity page: counterparties and every section without labels, flight data included', async ({ page }) => {
  const entity = 'Aerodrome Finance';
  await page.goto(`/entity/${encodeURIComponent(entity)}`);
  await expect(page.getByRole('heading', { level: 1, name: entity })).toBeVisible();
  await expect(page.locator('#cp')).toHaveCount(1, { timeout: 60_000 }); // loading card swapped out
  await expect(page.locator('#cp')).toBeVisible();
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
  // The Smart Money trail is owner-only: a public view does not render it at all.
  await expect(page.locator('#scorecard')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#trail')).toHaveCount(0);
  await page.waitForTimeout(3000); // streamed sections
  const html = await page.content();
  assertClean('/wallet', html);
  for (const l of counterpartyLabels) expect(html.includes(l), `/wallet leaks counterparty label "${l}"`).toBe(false);
});

test('smart-money desk: private explanation only; its API refuses public callers', async ({ page, request }) => {
  await page.goto('/smart-money');
  // A public view explains the desk is private; a public site sends owner-only pages back home.
  if (new URL(page.url()).pathname === '/smart-money') await expect(page.getByRole('heading', { name: 'The smart-money desk is private' })).toBeVisible();
  await expect(page.locator('#conviction-map, #holdings, #leaders, #sm-perps, #sm-dcas')).toHaveCount(0);
  assertClean('/smart-money', await page.content());
  expect(REFUSED).toContain((await request.get('/api/smart-money')).status());
  const post = await request.post('/api/smart-money', { data: { action: 'desk', chain: 'all' }, headers: { Origin: BASE } });
  expect(REFUSED).toContain(post.status());
  expect(await post.text()).not.toContain('holders');
});

test('perps: pressure board public, trader leaderboard withheld, coin detail without labels', async ({ page, request }) => {
  await page.goto('/perps');
  await expect(page.locator('#perps-title')).toBeVisible(); // the headline is the market's live reading
  await expect(page.locator('section[aria-labelledby="leaders"]')).toContainText('Nansen does not allow its perp leaderboard in public views');
  await expect(page.locator('section[aria-labelledby="leaders"] table')).toHaveCount(0);
  assertClean('/perps', await page.content());
  const leaders = await request.post('/api/perps', { data: { action: 'leaders' }, headers: { Origin: BASE } });
  expect(REFUSED).toContain(leaders.status());
  const coin = await request.post('/api/perps', { data: { action: 'coin', symbol: 'BTC' }, headers: { Origin: BASE }, timeout: 90_000 });
  if (coin.ok()) {
    const body = await coin.text();
    assertClean('/api/perps coin', body);
    expect(JSON.parse(body).pnl).toBeNull(); // the coin's PnL leaderboard is owner-only
  }
});

test('predictions: public page and market detail carry no labels', async ({ page }) => {
  await page.goto('/predict');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  assertClean('/predict', await page.content());
});

test('alerts API: public callers cannot list, create, toggle or delete Smart Alerts', async ({ request }) => {
  const h = { Origin: BASE };
  const list = await request.get('/api/alerts');
  // DEMO_MODE answers with an empty list and a note; a live public instance refuses.
  if (list.status() !== 200) expect(REFUSED).toContain(list.status());
  expect((await list.json()).alerts ?? []).toEqual([]);
  const create = await request.post('/api/alerts', { headers: h, data: { chain: 'base', address: '0x9b5e262cf9bb04869ab40b19af91d2dc85761722', channel: { type: 'telegram', chatId: '123456789' } } });
  expect(create.ok()).toBe(false);
  expect(REFUSED).toContain((await request.patch('/api/alerts', { headers: h, data: { id: 'x', isEnabled: false } })).status());
  expect(REFUSED).toContain((await request.delete('/api/alerts?id=x', { headers: h })).status());
});

test('MCP and research agent: public callers get public tools only, no agent', async ({ request }) => {
  const list = await request.post('/api/mcp', { data: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
  // A public site switches MCP off entirely: nothing to list, nothing to call.
  if (list.status() === 404) { expect(REFUSED).toContain((await request.get('/api/agent')).status()); return; }
  const names = ((await list.json()).result.tools as Array<{ name: string }>).map((t) => t.name);
  expect(names).not.toContain('tide_fronts');
  expect(names).not.toContain('tide_smart_money');
  const sm = await request.post('/api/mcp', { data: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'tide_smart_money', arguments: {} } } });
  expect((await sm.json()).result.isError).toBe(true);
  for (const tool of ['tide_weather', 'tide_perps', 'tide_alpha']) {
    const r = await request.post('/api/mcp', { data: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: tool, arguments: {} } } });
    assertClean(`mcp ${tool}`, await r.text());
  }
  expect((await request.post('/api/mcp', { headers: { Authorization: 'Bearer tide_mcp_notarealtokennotarealtoken' }, data: { jsonrpc: '2.0', id: 4, method: 'tools/list' } })).status()).toBe(401);
  expect(REFUSED).toContain((await request.get('/api/agent')).status());
});

test('trade API: public callers cannot quote, prepare or execute', async ({ request }) => {
  const h = { Origin: BASE };
  const q = await request.post('/api/trade', { headers: h, data: { action: 'quote', chain: 'base', side: 'buy', base: 'USDC', token: '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b', amount: '5000000', wallet: '0x000000000000000000000000000000000000dEaD' } });
  expect(REFUSED).toContain(q.status());
  const x = await request.post('/api/trade', { headers: h, data: { action: 'execute', chain: 'base', signedTx: '0x' + 'ab'.repeat(80), confirm: true } });
  expect(REFUSED).toContain(x.status());
});
