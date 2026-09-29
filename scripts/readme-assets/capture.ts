// `pnpm screenshots`: the README's fresh stills and animation frames, from a
// running demo server (recorded Nansen data, no key needed):
//
//   NEXT_DIST_DIR=.next-shots pnpm next build
//   DEMO_MODE=1 NANSEN_API_KEY= NEXT_DIST_DIR=.next-shots pnpm next start -p 3300
//   pnpm screenshots        (TIDE_URL to point elsewhere, CHROME for a browser binary)
//
// The browser clock is set to the submission date (27 September 2026); start the
// server with its clock there too (the phone's Today date is rendered on the server). Desktop shots are cropped to the page area
// (the sidebar carries the demo recording's date badge). Stills go to
// docs/readme/shots; animation frames go to .readme-frames/<name> with a crop
// box, and scripts/readme-assets/make-gifs.py turns them into docs/readme/gifs.
// Owner-only views (Copy Lab, Cascades, Smart Money) need an owner instance:
// their GIFs were recorded from the live app on 27 September 2026.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

const BASE = process.env.TIDE_URL ?? 'http://localhost:3300';
const SHOTS = 'docs/readme/shots';
const FRAMES = '.readme-frames';
const DAY = new Date('2026-09-27T14:00:00Z');
const TOKEN = '/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722';
const WALLET = '/wallet/0xcbb811f129782ef87e19dea9d3375045219bae00';
const PAGE_X = 262; // left edge of the page area beside the desktop sidebar

type Box = { x: number; y: number; width: number; height: number };

async function open(browser: Browser, phone: boolean, scale: number) {
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: scale, isMobile: true, hasTouch: true, colorScheme: 'dark' }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale, colorScheme: 'dark' });
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

/** Scrolls a section heading to `top` px below the viewport's top edge. */
async function scrollTo(page: Page, heading: RegExp, top = 24) {
  const h = page.locator('main h2', { hasText: heading }).first();
  await h.scrollIntoViewIfNeeded();
  await h.evaluate((n, t) => {
    const box = (n.closest('section, .material') as HTMLElement | null) ?? n;
    window.scrollBy(0, box.getBoundingClientRect().top - t);
  }, top);
  await page.waitForTimeout(1500);
}

async function still(page: Page, name: string, clip: Box) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 88, clip });
  console.log('still', name);
}

/** Records the page with Chrome's screencast while `act` runs; frames keep their timestamps. */
async function record(page: Page, name: string, crop: Box, width: number, act: () => Promise<void>, tail = 800) {
  const dir = path.join(FRAMES, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const scale = await page.evaluate(() => window.devicePixelRatio);
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ crop, scale, width }));
  const cdp = await page.context().newCDPSession(page);
  let i = 0;
  cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    fs.writeFileSync(path.join(dir, `${String(i++).padStart(4, '0')}-${Math.round((f.metadata.timestamp ?? 0) * 1000)}.jpg`), Buffer.from(f.data, 'base64'));
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, everyNthFrame: 1 });
  await act();
  await page.waitForTimeout(tail);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  console.log('frames', name, i);
}

const full = (y = 0, height = 900): Box => ({ x: PAGE_X, y, width: 1440 - PAGE_X, height });

async function desktop(browser: Browser) {
  // Motion: recorded at 1x and scaled into GIFs.
  const p = await open(browser, false, 1);

  // Overview: the net-flow ring draws its arcs and particles start to run.
  await p.goto(`${BASE}/`, { timeout: 90_000 });
  await record(p, 'overview', full(0, 600), 860, async () => {
    await p.waitForTimeout(4200);
    await p.mouse.move(905, 263, { steps: 12 }); // the top-inflow chain node
    await p.waitForTimeout(1600);
  });

  // Token page: price range and chart style switch, then the Verdict card.
  await go(p, TOKEN);
  await noDock(p);
  await record(p, 'token-chart', full(0, 790), 800, async () => {
    await p.waitForTimeout(700);
    const tab = (name: string) => p.getByRole('tab', { name, exact: true }).first().click();
    await tab('1M'); await p.waitForTimeout(1500);
    await tab('line'); await p.waitForTimeout(1200);
    await tab('area'); await p.waitForTimeout(1200);
    await tab('candles'); await p.waitForTimeout(1000);
    await p.mouse.move(700, 300, { steps: 20 });
    await p.mouse.move(820, 280, { steps: 30 });
    await p.waitForTimeout(1200);
  });

  // Holders: the 3D holder sphere turns under the pointer; clusters sit beside it.
  await go(p, TOKEN);
  await noDock(p);
  await p.getByRole('tab', { name: 'Holders' }).click().catch(() => p.getByText('Holders', { exact: true }).first().click());
  await p.waitForTimeout(3500);
  await scrollTo(p, /insider clusters/i, 72);
  const sphere = await p.locator('main h2', { hasText: /insider clusters/i }).first().evaluate((h) => {
    const r = (h.closest('section, .material') as HTMLElement).getBoundingClientRect();
    return { x: r.x, y: r.y - 6, width: r.width, height: Math.min(r.height + 12, 900 - r.y + 6) };
  });
  await record(p, 'holders', sphere, 720, async () => {
    const cx = sphere.x + sphere.width / 2, cy = sphere.y + sphere.height * 0.55;
    await p.mouse.move(cx - 120, cy);
    await p.mouse.down();
    await p.mouse.move(cx + 160, cy + 40, { steps: 40 });
    await p.mouse.move(cx - 60, cy - 50, { steps: 40 });
    await p.mouse.up();
    await p.waitForTimeout(2200);
  });

  // Section rail: hover previews each section's name; a click jumps there.
  await go(p, TOKEN);
  await noDock(p);
  await record(p, 'section-rail', full(0, 900), 860, async () => {
    const ticks = p.locator('nav[aria-label="Jump to section"] button');
    const n = await ticks.count();
    const first = (await ticks.first().boundingBox())!, last = (await ticks.nth(n - 1).boundingBox())!;
    await p.mouse.move(1300, first.y - 40);
    await p.mouse.move(first.x + 4, first.y + 2, { steps: 10 });
    await p.mouse.move(last.x + 4, last.y + 2, { steps: 60 });
    await p.waitForTimeout(500);
    const pick = ticks.nth(Math.round(n * 0.6));
    const b = (await pick.boundingBox())!;
    await p.mouse.move(b.x + 4, b.y + 2, { steps: 20 });
    await p.waitForTimeout(500);
    await p.mouse.click(b.x + 4, b.y + 2);
    await p.waitForTimeout(1600);
  });
  await p.context().close();

  // Stills: recorded at 2x.
  const s = await open(browser, false, 2);
  await go(s, '/flows'); await noDock(s);
  await still(s, 'chain-flows', full(0, 900));
  await go(s, '/chain/base'); await noDock(s);
  await still(s, 'chain-page', full(0, 900));
  await go(s, '/sectors'); await noDock(s);
  await still(s, 'sectors', full(0, 900));
  await go(s, WALLET); await noDock(s);
  await still(s, 'profiler', full(0, 900));
  await s.context().close();
}

async function phone(browser: Browser) {
  // Stills at 3x.
  const s = await open(browser, true, 3);
  const screen: Box = { x: 0, y: 0, width: 390, height: 844 };
  for (const [route, name] of [['/', 'phone-today'], ['/alpha', 'phone-alpha'], [TOKEN, 'phone-token'], [WALLET, 'phone-wallet'], ['/perps', 'phone-perps'], ['/proof', 'phone-proof']] as const) {
    await go(s, route);
    await still(s, name, screen);
  }
  await s.context().close();

  // Motion at 2x.
  const p = await open(browser, true, 2);
  await go(p, '/');
  // Liquid Glass tab bar: the lens glides between tabs as screens change.
  await record(p, 'phone-tabs', screen, 300, async () => {
    for (const label of ['Tokens', 'Wallets', 'Today']) {
      await p.locator('nav[aria-label="Quick navigation"]').getByText(label, { exact: true }).click();
      await p.waitForTimeout(1300);
    }
  });
  // Scrolling: the large title collapses and the glass bar shrinks.
  await go(p, '/');
  await record(p, 'phone-scroll', screen, 300, async () => {
    for (let y = 0; y <= 1500; y += 60) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(45); }
    await p.waitForTimeout(700);
    for (let y = 1500; y >= 0; y -= 120) { await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(45); }
  });
  // Section rail: drag down the right edge; the section's name rides beside the finger.
  await go(p, TOKEN);
  await record(p, 'phone-rail', screen, 300, async () => {
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
  await p.context().close();
}

async function main() {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const only = process.argv[2];
  if (!only || only === 'desktop') await desktop(browser);
  if (!only || only === 'phone') await phone(browser);
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
