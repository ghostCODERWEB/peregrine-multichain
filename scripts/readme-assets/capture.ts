// `pnpm screenshots`: the README's stills and animation frames, from a running
// demo server (recorded Nansen data, no key needed):
//
//   NEXT_DIST_DIR=.next-shots pnpm next build
//   DEMO_MODE=1 NANSEN_API_KEY= NEXT_DIST_DIR=.next-shots pnpm next start -p 3300
//   pnpm screenshots [desktop|phone|today]   (TIDE_URL to point elsewhere, CHROME for a browser binary)
//
// The browser clock is set to the submission date (27 September 2026). The phone's
// Today header is rendered on the server, so run the `today` group against a server
// whose clock starts on that date too. Desktop shots are cropped to the page area
// beside the sidebar (the sidebar carries the demo recording's date badge).
//
// Stills go to docs/readme/shots. Animation frames go to .readme-frames/<name> with a
// crop box, and scripts/readme-assets/make-gifs.py turns them into docs/readme/gifs.
// Owner-only views (Copy Lab, Cascades, the Smart Money desk) need an owner instance:
// their GIFs were recorded from the live app on 27 September 2026.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

const BASE = process.env.TIDE_URL ?? 'http://localhost:3300';
const SHOTS = 'docs/readme/shots';
const FRAMES = '.readme-frames';
const DAY = new Date('2026-09-27T14:00:00Z');
const TOKEN = '/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722';
const RUG = '/rug/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722';
const WALLET = '/wallet/0xcbb811f129782ef87e19dea9d3375045219bae00';
const MARKET = '/predict/4052418';
const W = 1440, H = 900; // desktop viewport
const PAGE_X = 262; // left edge of the page area beside the desktop sidebar
const PHONE = { width: 390, height: 844 };

type Box = { x: number; y: number; width: number; height: number };

async function open(browser: Browser, phone: boolean, scale: number, height = H) {
  const ctx = await browser.newContext(phone
    ? { viewport: PHONE, deviceScaleFactor: scale, isMobile: true, hasTouch: true, colorScheme: 'dark' }
    : { viewport: { width: W, height }, deviceScaleFactor: scale, colorScheme: 'dark' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pg-tour-v1', 'done'); } catch { /* storage may be blocked */ } });
  await ctx.clock.install({ time: DAY });
  const page = await ctx.newPage();
  await page.clock.resume();
  return page;
}

async function go(page: Page, route: string, ms = 3500) {
  await page.goto(`${BASE}${route}`, { timeout: 90_000 });
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  await page.waitForTimeout(ms); // charts and entrance animations finish
  await page.evaluate(() => { document.querySelector('nextjs-portal')?.remove(); document.querySelectorAll('.tour-card').forEach((n) => n.remove()); });
}

/** Hides the floating Analyze button so it does not cover the card being shown. */
const noDock = (page: Page) => page.addStyleTag({ content: '[data-analyze-dock]{display:none!important}' });

async function tab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).first().click();
  await page.waitForTimeout(3000);
}

const card = (page: Page, re: RegExp) => page.locator('main h2', { hasText: re }).first();

/** Scrolls so the section headed `from` sits `top` px below the viewport's top, and returns the band
 *  from that section's top to the bottom of the section headed `to` (or `from`), across the page area. */
async function band(page: Page, from: RegExp, to?: RegExp, top = 20, max = 1300): Promise<Box> {
  const h = card(page, from);
  await h.scrollIntoViewIfNeeded();
  await h.evaluate((n, t) => {
    const box = (n.closest('section, .material') as HTMLElement | null) ?? n;
    window.scrollBy(0, box.getBoundingClientRect().top - t);
  }, top);
  await page.waitForTimeout(2500); // lazy sections render once they are on screen
  const rect = (re: RegExp) => card(page, re).evaluate((n) => ((n.closest('section, .material') as HTMLElement | null) ?? n).getBoundingClientRect().toJSON());
  const bottom = (await rect(to ?? from)).bottom;
  const vw = page.viewportSize()!;
  const x = vw.width === W ? PAGE_X : 0;
  // Near the page's end the section cannot reach `top`: start where it actually landed.
  const y = Math.max(0, Math.max(top, (await rect(from)).top) - 12);
  return { x, y, width: vw.width - x, height: Math.min(vw.height, bottom + 14, y + max) - y };
}

/** One card, scrolled into view, with a small margin. */
async function cardBox(page: Page, re: RegExp): Promise<Box> {
  await card(page, re).evaluate((n) => window.scrollBy(0, ((n.closest('section, .material') as HTMLElement | null) ?? n).getBoundingClientRect().top - 24));
  await page.waitForTimeout(2000);
  const b = await card(page, re).evaluate((n) => ((n.closest('section, .material') as HTMLElement | null) ?? n).getBoundingClientRect().toJSON());
  return { x: b.x - 12, y: b.y - 12, width: b.width + 24, height: b.height + 24 };
}

const area = (y = 0, height = H): Box => ({ x: PAGE_X, y, width: W - PAGE_X, height });

async function still(page: Page, name: string, clip: Box) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 90, clip });
  console.log('still', name, `${Math.round(clip.width)}×${Math.round(clip.height)}`);
}

/** Records the page with Chrome's screencast at full resolution while `act` runs; frames keep their timestamps. */
async function record(page: Page, name: string, crop: Box, width: number, act: () => Promise<void>, tail = 900) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) return;
  const dir = path.join(FRAMES, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const vw = page.viewportSize()!;
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ crop, viewport: vw, width }));
  const cdp = await page.context().newCDPSession(page);
  let i = 0;
  cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    fs.writeFileSync(path.join(dir, `${String(i++).padStart(4, '0')}-${Math.round((f.metadata.timestamp ?? 0) * 1000)}.jpg`), Buffer.from(f.data, 'base64'));
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1, maxWidth: vw.width * dpr, maxHeight: vw.height * dpr });
  await act();
  await page.waitForTimeout(tail);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  console.log('frames', name, i);
}

async function desktopStills(browser: Browser) {
  // A tall viewport so a band of several cards fits whole; page-top shots keep a 900px screen.
  const p = await open(browser, false, 2, 1400);
  const only = process.env.ONLY?.split(',');
  const shot = async (route: string, name: string, pick: () => Promise<Box>, setup?: () => Promise<void>) => {
    if (only && !only.includes(name)) return;
    await go(p, route);
    await noDock(p);
    if (setup) await setup();
    await still(p, name, await pick());
  };
  const top = (height = H) => async () => area(0, height);
  // Market
  await shot('/', 'overview-index', () => band(p, /^Flow Index$/));
  await shot('/', 'overview-risk', () => band(p, /^Risk alerts$/, /^24h projections$/));
  await shot('/alpha', 'alpha-map', () => band(p, /^Market map$/));
  await shot('/alpha', 'alpha-leaders', () => band(p, /worth a look/, undefined, 20, 900));
  await shot('/flows', 'chain-flows', top());
  await shot('/flows', 'chain-rotation', () => band(p, /^Flow Index change, 6 hours$/, /^Market-wide net flow/));
  await shot('/history', 'history', top(470));
  await shot('/chain/base', 'chain-page', top());
  await shot('/chain/base', 'chain-gauge', () => band(p, /^Flow gauge$/, /^All-trader flow has put/));
  await shot('/sectors', 'sectors', top());
  await shot('/sectors', 'sector-tokens', () => cardBox(p, /^Tokens driving sector flow$/));
  await shot('/perps', 'perps', top(670));
  await shot('/perps', 'perps-movers', () => band(p, /^Price movers, 24h$/, /^Funding extremes, yearly$/));
  await shot('/perps', 'perps-index', () => band(p, /^Every coin by Perp Flow Index$/));
  await shot('/predict', 'predictions', top());
  await shot('/predict', 'predictions-movers', () => band(p, /^Biggest probability movers$/, /^Largest markets by open interest$/));
  await shot('/predict', 'predictions-categories', () => band(p, /categories running hot/));
  await shot(MARKET, 'prediction-market', top());
  await shot(MARKET, 'prediction-book', () => band(p, /^Implied probability$/, /^Order book$/));
  // Tokens
  await shot('/token', 'token-checker', () => band(p, /^Token Scores, last 7 days$/, /^Most traded tokens/));
  await shot(RUG, 'rug', top(760));
  await shot(TOKEN, 'token-score', () => cardBox(p, /^Token Score/), async () => { await p.getByText('All inputs and Nansen indicators').first().click(); await p.waitForTimeout(1500); });
  await shot(TOKEN, 'token-flow', () => band(p, /^Exchanges buy/, /^Exchanges buy/, 72), () => tab(p, 'Flow'));
  await shot(TOKEN, 'token-trades', () => band(p, /buyers vs .* sellers in the latest/, /buyers vs .* sellers in the latest/, 72), () => tab(p, 'Terminal'));
  // Wallets
  await shot(WALLET, 'profiler', top());
  await shot(WALLET, 'profiler-holdings', () => band(p, /^Holdings/, /^Where realized PnL came from$/));
  await shot(WALLET, 'profiler-pnl', () => band(p, /^Realized PnL, 30 days$/, /^Counterparties$/));
  const portfolio = async () => {
    await p.getByRole('button', { name: /recorded demo wallet/i }).click();
    await p.waitForTimeout(600);
    await p.getByRole('button', { name: /^Analyze$/ }).click();
    await p.waitForTimeout(6000);
  };
  await shot('/wallet#portfolio', 'portfolio', () => band(p, /priced positions/), portfolio);
  // Proof and coverage: the API-call card (the ledger is the submission's) and what Nansen serves per chain
  await shot('/proof', 'proof-calls', top(330));
  await shot('/coverage', 'coverage-matrix', () => band(p, /^What Nansen serves, chain by chain/));
  // Paper theme
  await go(p, '/');
  await noDock(p);
  await p.getByRole('button', { name: /paper chart theme/i }).first().click();
  await p.waitForTimeout(2500);
  await still(p, 'overview-paper', area(0, 830));
  await p.context().close();
}

async function desktopMotion(browser: Browser) {
  const p = await open(browser, false, 1);

  // Overview: the net-flow ring draws its arcs and particles start to run.
  await p.goto(`${BASE}/`, { timeout: 90_000 });
  await noDock(p);
  await record(p, 'overview', area(0, 600), 1100, async () => {
    await p.waitForTimeout(4200);
    await p.mouse.move(905, 263, { steps: 12 }); // the top-inflow chain node
    await p.waitForTimeout(1800);
  });

  // Token page: price range and chart style switch under the pointer.
  await go(p, TOKEN);
  await noDock(p);
  await record(p, 'token-chart', area(0, 790), 1100, async () => {
    await p.waitForTimeout(600);
    await tab(p, '1M');
    await p.getByRole('tab', { name: 'line', exact: true }).first().click(); await p.waitForTimeout(1300);
    await p.getByRole('tab', { name: 'area', exact: true }).first().click(); await p.waitForTimeout(1300);
    await p.getByRole('tab', { name: 'candles', exact: true }).first().click(); await p.waitForTimeout(1000);
    await p.mouse.move(700, 450, { steps: 20 });
    await p.mouse.move(860, 420, { steps: 30 });
    await p.waitForTimeout(1200);
  });

  // Holders: the 3D holder sphere turns under the pointer; clusters sit beside it.
  await go(p, TOKEN);
  await noDock(p);
  await tab(p, 'Holders');
  const sphere = await band(p, /insider clusters/i, /insider clusters/i, 72);
  await record(p, 'holders', sphere, 1100, async () => {
    const cx = PAGE_X + 360, cy = sphere.y + sphere.height * 0.55;
    await p.mouse.move(cx - 120, cy);
    await p.mouse.down();
    await p.mouse.move(cx + 160, cy + 40, { steps: 40 });
    await p.mouse.move(cx - 60, cy - 50, { steps: 40 });
    await p.mouse.up();
    await p.mouse.move(cx + 20, cy + 60, { steps: 15 });
    await p.waitForTimeout(2200);
  });

  // Section rail: hover previews each section's name; a click jumps there.
  await go(p, TOKEN);
  await noDock(p);
  await record(p, 'section-rail', area(0, H), 1100, async () => {
    const ticks = p.locator('nav[aria-label="Jump to section"] button');
    const n = await ticks.count();
    const first = (await ticks.first().boundingBox())!, last = (await ticks.nth(n - 1).boundingBox())!;
    await p.mouse.move(1300, first.y - 40);
    await p.mouse.move(first.x + 4, first.y + 2, { steps: 10 });
    await p.mouse.move(last.x + 4, last.y + 2, { steps: 60 });
    await p.waitForTimeout(500);
    const b = (await ticks.nth(Math.round(n * 0.6)).boundingBox())!;
    await p.mouse.move(b.x + 4, b.y + 2, { steps: 20 });
    await p.waitForTimeout(500);
    await p.mouse.click(b.x + 4, b.y + 2);
    await p.waitForTimeout(1600);
  });

  // Market map: hovering a bubble brings up that token's flow, price and alpha score.
  await go(p, '/alpha');
  await noDock(p);
  const map = await band(p, /^Market map$/);
  await record(p, 'alpha-map', map, 1100, async () => {
    const bubbles = p.locator('figure[aria-label^="Market map"] [aria-label*=" alpha "]');
    const n = await bubbles.count();
    for (const k of [0.15, 0.4, 0.65, 0.85]) {
      const bb = await bubbles.nth(Math.floor(n * k)).boundingBox();
      if (bb) { await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 18 }); await p.waitForTimeout(1100); }
    }
  });

  // Pager: the current page's lens glides between page numbers.
  await go(p, '/token');
  await noDock(p);
  const table = await band(p, /^Most traded tokens/);
  await record(p, 'pager', table, 1100, async () => {
    const pager = p.locator('nav[aria-label^="Pages: Most traded"]');
    for (let k = 0; k < 3; k++) { await pager.getByRole('button', { name: 'Next page' }).click(); await p.waitForTimeout(1100); }
    await pager.locator('button[data-go="0"]').click(); // the first page's number always shows
    await p.waitForTimeout(1300);
  });

  // Analyze with Nansen: ⌘J opens the panel with questions for this page; Select from page attaches a card.
  await go(p, TOKEN);
  await record(p, 'analyze', area(0, H), 1100, async () => {
    await p.waitForTimeout(500);
    await p.keyboard.press('Control+j');
    await p.waitForTimeout(1600);
    await p.getByRole('button', { name: 'Select from page' }).first().click();
    await p.waitForTimeout(700);
    const score = (await card(p, /^Token Score/).boundingBox())!;
    await p.mouse.move(score.x + 60, score.y + 120, { steps: 25 });
    await p.waitForTimeout(700);
    await p.mouse.click(score.x + 60, score.y + 120);
    await p.waitForTimeout(900);
    const input = p.getByPlaceholder(/Ask about/i).first();
    await input.click();
    await input.pressSequentially('Why is the score moderate?', { delay: 55 });
    await p.waitForTimeout(1200);
  });

  // Paper theme: the whole terminal switches between dark and paper.
  await go(p, '/');
  await noDock(p);
  await record(p, 'theme', area(0, 830), 1100, async () => {
    await p.waitForTimeout(700);
    await p.getByRole('button', { name: /paper chart theme/i }).first().click();
    await p.waitForTimeout(2000);
    await p.getByRole('button', { name: /navy theme/i }).first().click();
    await p.waitForTimeout(1500);
  });
  await p.context().close();
}

async function phoneStills(browser: Browser, routes: Array<[string, string, (p: Page) => Promise<void>]>) {
  const s = await open(browser, true, 3);
  for (const [route, name, setup] of routes) {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) continue;
    await go(s, route);
    await setup(s);
    await still(s, name, { x: 0, y: 0, ...PHONE });
  }
  await s.context().close();
}

const scrollTo = (re: RegExp, top = 70) => async (p: Page) => {
  const h = card(p, re);
  await h.scrollIntoViewIfNeeded();
  await h.evaluate((n, t) => window.scrollBy(0, ((n.closest('section, .material') as HTMLElement | null) ?? n).getBoundingClientRect().top - t), top);
  await p.waitForTimeout(2500);
};
const none = async () => undefined;

async function phone(browser: Browser) {
  await phoneStills(browser, [
    [TOKEN, 'phone-token', none],
    [TOKEN, 'phone-token-score', async (p) => {
      // Open the card's preview in full, then frame it.
      await scrollTo(/^Token Score/)(p);
      await card(p, /^Token Score/).evaluate((n) => (n.closest('section, .material')?.querySelector('button[data-clamp-toggle], .clamp-toggle') as HTMLElement | null)?.click());
      await p.getByRole('button', { name: 'Show all' }).first().click().catch(() => undefined);
      await p.waitForTimeout(1200);
      await scrollTo(/^Token Score/, 64)(p);
    }],
    [WALLET, 'phone-wallet', none],
    ['/alpha', 'phone-alpha', scrollTo(/^Market map$/)],
    ['/perps', 'phone-perps', none],
    ['/predict', 'phone-predict', none],
    [MARKET, 'phone-market', none],
    ['/sectors', 'phone-sectors', scrollTo(/^Sector pulse$/)],
    ['/flows', 'phone-flows', scrollTo(/^Net flow by chain, 24h$/)],
    [RUG, 'phone-rug', none],
  ]);

  const p = await open(browser, true, 2);
  const screen: Box = { x: 0, y: 0, ...PHONE };
  // Section rail: drag down the right edge; the section's name rides beside the finger.
  await go(p, TOKEN);
  await record(p, 'phone-rail', screen, 390, async () => {
    const ticks = p.locator('nav[aria-label="Jump to section"] button');
    const n = await ticks.count();
    const first = (await ticks.first().boundingBox())!, last = (await ticks.nth(n - 1).boundingBox())!;
    const x = first.x + first.width - 3;
    await p.mouse.move(x, first.y + 2);
    await p.mouse.down();
    await p.mouse.move(x, last.y, { steps: 50 });
    await p.waitForTimeout(300);
    await p.mouse.move(x, first.y + (last.y - first.y) * 0.45, { steps: 30 });
    await p.mouse.up();
    await p.waitForTimeout(1600);
  });
  // Genie Ask: the Ask panel grows out of the tab bar with questions for this screen, then folds back.
  await go(p, TOKEN);
  await record(p, 'phone-genie', screen, 390, async () => {
    await p.waitForTimeout(500);
    await p.getByRole('button', { name: 'Ask about this screen' }).click();
    await p.waitForTimeout(2600);
    await p.getByRole('button', { name: 'Ask about this screen' }).click().catch(() => p.keyboard.press('Escape'));
    await p.waitForTimeout(1200);
  });
  // Previews: long panels open as a preview, and one tap shows all of it.
  await go(p, WALLET);
  await scrollTo(/^Holdings/, 60)(p);
  await record(p, 'phone-preview', screen, 390, async () => {
    await p.waitForTimeout(600);
    const btn = p.getByRole('button', { name: 'Show all' }).first();
    await btn.scrollIntoViewIfNeeded();
    await p.waitForTimeout(700);
    await btn.click();
    await p.waitForTimeout(1200);
    for (let k = 0; k < 10; k++) { await p.mouse.wheel(0, 80); await p.waitForTimeout(60); }
    await p.waitForTimeout(900);
  });
  await p.context().close();
}

/** The Today screen, whose date is rendered on the server: run against a server whose clock starts on DAY. */
async function today(browser: Browser) {
  await phoneStills(browser, [['/', 'phone-today', none], ['/token', 'phone-tokens', none]]);
  const p = await open(browser, true, 2);
  const screen: Box = { x: 0, y: 0, ...PHONE };
  await go(p, '/');
  // Liquid Glass tab bar: the lens glides between tabs as screens change.
  await record(p, 'phone-tabs', screen, 390, async () => {
    for (const label of ['Tokens', 'Wallets', 'Today']) {
      await p.locator('nav[aria-label="Quick navigation"]').getByText(label, { exact: true }).click();
      await p.waitForTimeout(1400);
    }
  });
  // Scrolling: the large title collapses and the glass bar shrinks.
  await go(p, '/');
  await record(p, 'phone-scroll', screen, 390, async () => {
    for (let y = 0; y <= 1500; y += 50) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(40); }
    await p.waitForTimeout(700);
    for (let y = 1500; y >= 0; y -= 100) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(40); }
  });
  await p.context().close();
}

async function main() {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const only = process.argv[2];
  if (!only || only === 'desktop') { await desktopStills(browser); await desktopMotion(browser); }
  if (only === 'desktop-stills') await desktopStills(browser);
  if (only === 'desktop-motion') await desktopMotion(browser);
  if (!only || only === 'phone') await phone(browser);
  if (!only || only === 'today') await today(browser);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
