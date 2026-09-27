// `pnpm showcase`: README screenshots and animation frames from a running demo
// server (pnpm dev:demo on :3300, or TIDE_URL), so every image shows real
// recorded Nansen data and can be regenerated. Stills go to docs/screenshots;
// animation frames go to docs/screenshots/.frames/<name>, and
// scripts/make-gifs.py turns them into GIFs.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';

const BASE = process.env.TIDE_URL ?? 'http://localhost:3300';
const OUT = 'docs/screenshots';
const FRAMES = path.join(OUT, '.frames');
const TOKEN = '/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722';
const WALLET = '/wallet/0xcbb811f129782ef87e19dea9d3375045219bae00';

// Owner-only views (Smart Money data) need an owner instance with a real key: TIDE_OWNER=1.
const OWNER = process.env.TIDE_OWNER === '1';
const desktop: Array<{ path: string; file: string; scroll?: string; height?: number; owner?: boolean }> = [
  { path: '/', file: 'overview' },
  { path: '/copy', file: 'copy-lab', owner: true },
  { path: '/token', file: 'token-checker' },
  { path: TOKEN, file: 'token-verdict', height: 1100 },
  { path: WALLET, file: 'profiler', height: 1100 },
  { path: '/smart-money', file: 'wallet-network', scroll: 'section[aria-labelledby="wgraph"]', owner: true },
  { path: '/flows', file: 'chain-flows' },
  { path: '/perps', file: 'perps' },
  { path: '/predict', file: 'predictions' },
  { path: '/cascade', file: 'cascades', owner: true },
  { path: '/proof', file: 'proof' },
];
const phone: Array<{ path: string; file: string; owner?: boolean }> = [
  { path: '/', file: 'phone-today' },
  { path: '/token', file: 'phone-tokens' },
  { path: '/copy', file: 'phone-copy', owner: true },
  { path: TOKEN, file: 'phone-token' },
  { path: WALLET, file: 'phone-wallet' },
];

async function settle(page: Page, ms = 2500) {
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(ms); // charts and entrance animations finish
  // Dev overlays and the first-visit tour never belong in a product shot.
  await page.evaluate(() => { document.querySelector('nextjs-portal')?.remove(); document.querySelectorAll('.tour-card').forEach((n) => n.remove()); });
}

/** Records the page with Chrome's screencast (frames as fast as the page paints) while `act` runs. */
async function record(page: Page, name: string, ms: number, act: () => Promise<void>) {
  const dir = path.join(FRAMES, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  let i = 0;
  cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    fs.writeFileSync(path.join(dir, `${String(i++).padStart(4, '0')}-${Math.round((f.metadata.timestamp ?? 0) * 1000)}.jpg`), Buffer.from(f.data, 'base64'));
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 });
  await act();
  await page.waitForTimeout(ms);
  await cdp.send('Page.stopScreencast');
  await cdp.detach();
  console.log('frames', name, i);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const noTour = () => { try { localStorage.setItem('pg-tour-v1', 'done'); } catch { /* storage may be blocked */ } };

  const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await d.addInitScript(noTour);
  const page = await d.newPage();
  for (const s of desktop.filter((x) => OWNER || !x.owner)) {
    await page.setViewportSize({ width: 1440, height: s.height ?? 900 });
    await page.goto(`${BASE}${s.path}`);
    await settle(page);
    if (s.scroll) { await page.locator(s.scroll).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(800); }
    await page.screenshot({ path: `${OUT}/${s.file}.jpg`, type: 'jpeg', quality: 86 });
    console.log('shot', s.file);
  }
  // Desktop: the Analyze dock opens and reads the page.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}${TOKEN}`);
  await settle(page);
  await record(page, 'desktop-analyze', 1600, async () => { await page.waitForTimeout(300); await page.keyboard.press('Meta+j'); });
  await d.close();

  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
  await m.addInitScript(noTour);
  const mp = await m.newPage();
  for (const s of phone.filter((x) => OWNER || !x.owner)) {
    await mp.goto(`${BASE}${s.path}`);
    await settle(mp);
    await mp.screenshot({ path: `${OUT}/${s.file}.jpg`, type: 'jpeg', quality: 86 });
    console.log('shot', s.file);
  }
  // Genie Ask: the panel grows out of the tab bar's Ask button, then folds back.
  await mp.goto(`${BASE}/`);
  await settle(mp);
  await record(mp, 'phone-genie-ask', 900, async () => {
    await mp.waitForTimeout(250);
    await mp.getByRole('button', { name: 'Ask about this screen' }).click();
    await mp.waitForTimeout(1400);
    await mp.getByRole('button', { name: 'Ask about this screen' }).click().catch(() => mp.keyboard.press('Escape'));
  });
  // Liquid Glass tab bar: the lens glides between tabs, and the page transition plays.
  await record(mp, 'phone-tabs', 700, async () => {
    for (const label of ['Tokens', 'Copy', 'Wallets', 'Today']) {
      await mp.locator('nav[aria-label="Quick navigation"]').getByText(label, { exact: true }).click();
      await mp.waitForTimeout(900);
    }
  });
  // Scrolling: the glass bar shrinks, large title collapses.
  await mp.goto(`${BASE}/`);
  await settle(mp);
  await record(mp, 'phone-scroll', 600, async () => {
    for (let y = 0; y <= 1400; y += 70) { await mp.evaluate((v) => window.scrollTo(0, v), y); await mp.waitForTimeout(40); }
    await mp.waitForTimeout(400);
    for (let y = 1400; y >= 0; y -= 140) { await mp.evaluate((v) => window.scrollTo(0, v), y); await mp.waitForTimeout(40); }
  });
  await m.close();
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
