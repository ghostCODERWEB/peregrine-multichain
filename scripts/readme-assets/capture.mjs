// README media from a running Peregrine: a still of every major screen, desktop and phone, and a short
// recording of each key interaction (webm; scripts/readme-assets/clip-to-gif.sh turns one into a GIF).
//   BASE=https://… node scripts/readme-assets/capture.mjs shots|clips [name...]
// Raw output goes to docs/readme/.capture (git-ignored). A page that fails to render stops its capture.
import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const B = process.env.BASE || 'https://peregrine-submission.up.railway.app';
const OUT = process.env.OUT || path.join(__dirname, '../../docs/readme/.capture');
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'clips'), { recursive: true });
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: 'dark' };
const PHONE = { ...devices['iPhone 14 Pro'], colorScheme: 'dark' };
const AERO = '/token/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631';
const quiet = async (p) => {
  // Hide the floating Analyze button and the tour so they never cover content in a still.
  await p.addStyleTag({ content: '.tour-card{display:none!important} ::-webkit-scrollbar{display:none}' });
};
const settle = async (p, ms = 2500) => { await p.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {}); await p.waitForTimeout(ms); };
const open = async (p, url) => {
  const r = await p.goto(B + url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  if (!r || r.status() >= 400) throw new Error(`${url} answered ${r?.status()}`);
  await settle(p); await quiet(p);
  if (!(await p.locator('main').count()) || await p.getByText(/This page hit a problem|Application not found|Not Found/).count()) throw new Error(`${url} did not render the app`);
};
const top = async (p) => { await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400); };
const toSel = async (p, sel, block = 'start') => { await p.evaluate(([s, b]) => { const e = document.querySelector(s); if (e) { const card = e.closest('section, .material') ?? e; card.scrollIntoView({ block: b }); scrollBy(0, -12); } }, [sel, block]); await p.waitForTimeout(1600); };
const glide = async (p, dy, steps = 30, pause = 16) => { for (let i = 0; i < steps; i++) { await p.mouse.wheel(0, dy / steps); await p.waitForTimeout(pause); } };

// ------------------------------------------------------------------ stills
const SHOTS = [
  // name, device, url, prepare
  ['overview', DESK, '/', null],
  ['overview-predictions-layer', DESK, '/', async (p) => { await p.getByRole('group', { name: 'Overview views' }).getByRole('button', { name: 'Predictions', exact: true }).click().catch(() => {}); await p.waitForTimeout(5000); }],
  ['alpha', DESK, '/alpha', null],
  ['token-verdict', DESK, AERO, null],
  ['token-insiders', DESK, AERO, async (p) => toSel(p, 'h2:is([id])', 'start').then(() => p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((x) => /insider clusters/.test(x.textContent)); h?.closest('section')?.scrollIntoView({ block: 'start' }); scrollBy(0, -12); })).then(() => p.waitForTimeout(2500))],
  ['token-checker', DESK, '/token', null],
  ['copy-lab', DESK, '/copy', null],
  ['cascades', DESK, '/cascade', null],
  ['perps', DESK, '/perps', null],
  ['perps-coin', DESK, '/perps/BTC', null],
  ['predictions', DESK, '/predict', null],
  ['chain-flows', DESK, '/flows', null],
  ['chain', DESK, '/chain/solana', null],
  ['sectors', DESK, '/sectors', null],
  ['smart-money', DESK, '/smart-money', null],
  ['profiler', DESK, '/wallet/0xe16d837a2099b7b8f5aa117f82099c4d115f868b', null],
  ['research-desk', DESK, '/agent', null],
  ['coverage', DESK, '/coverage', null],
  ['history', DESK, '/history', null],
  ['proof', DESK, '/proof', null],
  ['phone-today', PHONE, '/', null],
  ['phone-tokens', PHONE, '/token', null],
  ['phone-token', PHONE, AERO, null],
  ['phone-copy', PHONE, '/copy', null],
  ['phone-perps', PHONE, '/perps', null],
  ['phone-predict', PHONE, '/predict', null],
  ['phone-wallet', PHONE, '/wallet/0xe16d837a2099b7b8f5aa117f82099c4d115f868b', null],
];

// ------------------------------------------------------------------ clips
const CLIPS = {
  // Overview: the page settles, then a slow scroll through the flow map, pulse and radar.
  'overview-tour': [DESK, '/', async (p) => { await p.waitForTimeout(1200); await glide(p, 900, 60, 30); await p.waitForTimeout(800); await glide(p, 900, 60, 30); await p.waitForTimeout(1000); }],
  // Analyze (⌘J): the dock opens with its genie, select from page, ask.
  'analyze-desktop': [DESK, '/flows', async (p) => {
    await p.evaluate(() => { document.querySelector('#chain-net')?.closest('section')?.scrollIntoView({ block: 'center' }); }); await p.waitForTimeout(900);
    await p.getByRole('button', { name: /Analyze with Nansen/ }).click(); await p.waitForTimeout(1500);
    const pick = async (sel) => {
      await p.getByRole('button', { name: /Select from page/ }).click(); await p.waitForTimeout(500);
      const box = await p.locator(sel).first().evaluate((e) => { const r = (e.closest('section') ?? e).getBoundingClientRect(); return { x: r.x + r.width * 0.45, y: r.y + r.height * 0.55 }; });
      await p.mouse.move(box.x - 120, box.y - 60, { steps: 12 }); await p.mouse.move(box.x, box.y, { steps: 18 }); await p.waitForTimeout(700);
      await p.mouse.click(box.x, box.y); await p.waitForTimeout(1100);
    };
    await pick('#chain-net'); await pick('#chain-index-history');
    const ask = p.locator('[data-analyze-dock] textarea, [role=dialog] textarea').first();
    await ask.click().catch(() => {}); await p.keyboard.type('Which chain matters most here, and why?', { delay: 55 }); await p.waitForTimeout(2200);
  }],
  'analyze-phone': [PHONE, '/', async (p) => { await p.waitForTimeout(800); await p.getByRole('button', { name: 'Ask about this screen' }).click(); await p.waitForTimeout(2600); await p.keyboard.press('Escape').catch(() => {}); await p.getByRole('button', { name: /close/i }).first().click().catch(() => {}); await p.waitForTimeout(1500); }],
  // Alpha: first buys, open the top token, its verdict resolves.
  'alpha-to-token': [DESK, '/alpha', async (p) => { await p.waitForTimeout(1500); await glide(p, 500, 30, 25); await p.waitForTimeout(600); const a = p.locator('section', { has: p.getByRole('heading', { name: /Early alpha/ }) }).locator('li a[href^="/token/"]').first(); await a.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await a.click(); await p.waitForTimeout(4500); await glide(p, 600, 40, 25); await p.waitForTimeout(1200); }],
  // Token Checker: type, results appear, open one.
  'token-checker': [DESK, '/token', async (p) => { await p.waitForTimeout(800); const box = p.getByPlaceholder('Token name, symbol or address · 25 networks'); await box.click(); await p.keyboard.type('aero', { delay: 160 }); await p.waitForTimeout(2200); const hit = p.locator('a[href^="/token/base/0x940181"]:visible').first(); await hit.hover(); await p.waitForTimeout(500); await hit.click(); await p.waitForTimeout(5000); await glide(p, 500, 30, 25); await p.waitForTimeout(1500); }],
  // Copy Lab: tabs re-rank the board.
  'copy-lab': [DESK, '/copy', async (p) => { await p.waitForTimeout(1500); for (const m of ['perps', 'predict', 'spot']) { await p.locator(`main a[href="/copy?m=${m}"]:visible`).first().click({ timeout: 8000 }).catch(() => {}); await p.waitForTimeout(3000); } }],
  // Cascades: the leadership map, then a replay.
  'cascades': [DESK, '/cascade', async (p) => { await p.waitForTimeout(2000); await glide(p, 700, 45, 25); await p.waitForTimeout(2500); await glide(p, 700, 45, 25); await p.waitForTimeout(2500); }],
  // Perps: the paged books and the liquid pager lens.
  'perps-pager': [DESK, '/perps', async (p) => { await toSel(p, '#perps-price-movers'); const bars = p.locator('.pager'); const n = await bars.count(); for (let k = 0; k < 3; k++) for (let i = 0; i < Math.min(n, 4); i++) { const nx = bars.nth(i).getByRole('button', { name: 'Next page' }); if (await nx.isVisible().catch(() => false) && await nx.isEnabled().catch(() => false)) { await nx.click(); await p.waitForTimeout(650); } } await p.waitForTimeout(1200); }],
  // Perps coin terminal: liquidation radar and positioning.
  'perps-coin': [DESK, '/perps/BTC', async (p) => { await p.waitForTimeout(2500); await glide(p, 800, 50, 25); await p.waitForTimeout(2500); await glide(p, 700, 45, 25); await p.waitForTimeout(2000); }],
  // Phone: tab bar lens between tabs.
  'phone-tabs': [PHONE, '/', async (p) => { await p.waitForTimeout(1500); for (const t of ['Tokens', 'Copy', 'Wallets', 'Today']) { await p.getByRole('link', { name: t, exact: true }).last().click().catch(() => {}); await p.waitForTimeout(2200); } }],
  // Phone: numbered pager with the liquid lens.
  'phone-pager': [PHONE, '/perps', async (p) => { const bar = p.locator('.pager', { has: p.getByRole('button', { name: 'Page 2' }) }).first(); await bar.evaluate((e) => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200); for (const n of ['Page 2', 'Page 3', 'Page 4', 'Page 1']) { await bar.getByRole('button', { name: n }).click().catch(() => {}); await p.waitForTimeout(900); } await p.waitForTimeout(600); }],
  // Phone: scroll with the collapsing title and the section rail.
  'phone-scroll': [PHONE, '/predict', async (p) => { await p.waitForTimeout(1200); await glide(p, 1400, 70, 25); await p.waitForTimeout(700); await glide(p, -1400, 70, 25); await p.waitForTimeout(1000); }],
};

(async () => {
  const mode = process.argv[2] || 'shots';
  const only = process.argv.slice(3);
  const b = await chromium.launch();
  if (mode === 'shots') {
    for (const [name, dev, url, prep] of SHOTS) {
      if (only.length && !only.includes(name)) continue;
      const ctx = await b.newContext(dev); await ctx.addInitScript(() => localStorage.setItem('pg-tour-v1', 'done'));
      const p = await ctx.newPage();
      try {
        await open(p, url); await top(p);
        if (prep) await prep(p);
        await p.screenshot({ path: path.join(OUT, 'shots', `${name}.png`) });
        console.log('shot', name);
      } catch (e) { console.log('FAILED', name, e.message.slice(0, 120)); }
      await ctx.close();
    }
  } else {
    for (const [name, [dev, url, act]] of Object.entries(CLIPS)) {
      if (only.length && !only.includes(name)) continue;
      const size = dev.viewport;
      // Load first without recording, so the clip starts on a finished page.
      const warm = await b.newContext(dev); const wp = await warm.newPage(); await wp.goto(B + url, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {}); await warm.close();
      const ctx = await b.newContext({ ...dev, recordVideo: { dir: path.join(OUT, 'clips', name), size } });
      await ctx.addInitScript(() => localStorage.setItem('pg-tour-v1', 'done'));
      const p = await ctx.newPage();
      const t0 = Date.now();
      try {
        await open(p, url); await top(p);
        const start = (Date.now() - t0) / 1000;
        await act(p);
        fs.writeFileSync(path.join(OUT, 'clips', name, 'start.txt'), String(start));
        console.log('clip', name, 'starts at', start.toFixed(1), 's');
      } catch (e) { console.log('FAILED', name, e.message.slice(0, 160)); }
      await ctx.close();
    }
  }
  await b.close();
})();
