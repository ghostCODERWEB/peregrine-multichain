// Records the real application for the showcase film (see ../06-capture-plan.md).
// Every take is Chrome's screencast of the running app: frames are saved with
// their capture timestamps so the editor can place them on real time.
//
//   BASE=http://localhost:3500 CHROME=/path/to/chrome npx tsx video-production/src/capture.ts [take ...]
//
// LIVE_URL (an instance with a Nansen key) records the AI answers for real.
// Otherwise /api/explain is replayed in the page (REPLAY below): the same
// server-sent event protocol, timed like the agent, rendered by the real
// panel. The replayed text uses only figures shown on the same screen; it is
// not Nansen agent output (see ../01-product-analysis.md).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from '@playwright/test';

const BASE = process.env.LIVE_URL ?? process.env.BASE ?? 'http://localhost:3500';
const REPLAY = !process.env.LIVE_URL;
const OUT = path.resolve(__dirname, '../captures');
const TOKEN = '/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722';
const RUG = '/rug/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722';
const WALLET = '/wallet/0xcbb811f129782ef87e19dea9d3375045219bae00';

// A clean cursor and click ripple drawn into the page (screencasts do not include the OS pointer).
const CURSOR = `(() => {
  try { localStorage.setItem('pg-tour-v1', 'done'); } catch {}
  const touch = matchMedia('(pointer: coarse)').matches;
  addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = '#vp-cursor{position:fixed;left:0;top:0;width:22px;height:22px;margin:-3px 0 0 -3px;z-index:2147483647;pointer-events:none;transition:transform .08s ease-out;filter:drop-shadow(0 2px 6px rgba(0,0,0,.55))}' +
      '.vp-ripple{position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;border:2px solid rgba(95,245,200,.9);background:rgba(95,245,200,.18);transform:translate(-50%,-50%) scale(.2);animation:vpr .5s ease-out forwards}' +
      '@keyframes vpr{to{transform:translate(-50%,-50%) scale(1);opacity:0}} nextjs-portal,.tour-card{display:none!important}';
    document.head.appendChild(st);
    let c = null;
    if (!touch) {
      c = document.createElement('div'); c.id = 'vp-cursor';
      c.innerHTML = '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 2l15 8.2-6.6 1.6-3.1 6.2z" fill="#fff" stroke="#0b1210" stroke-width="1.3" stroke-linejoin="round"/></svg>';
      c.style.transform = 'translate(' + (innerWidth * .72) + 'px,' + (innerHeight * .78) + 'px)';
      document.body.appendChild(c);
      addEventListener('mousemove', (e) => { c.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    }
    const ripple = (x, y, size) => { const r = document.createElement('div'); r.className = 'vp-ripple'; r.style.left = x + 'px'; r.style.top = y + 'px'; r.style.width = r.style.height = size + 'px'; document.body.appendChild(r); setTimeout(() => r.remove(), 600); };
    addEventListener('mousedown', (e) => ripple(e.clientX, e.clientY, 44), true);
    addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) ripple(t.clientX, t.clientY, 64); }, true);
  });
})();`;

type Rec = { stop: () => Promise<number> };
// Event times (epoch seconds, the screencast's clock) for the sound design: clicks, typing, taps, AI opening.
const events: Record<string, Array<{ kind: string; abs: number }>> = {};
let current = '';
const mark = (kind: string) => (events[current] ??= []).push({ kind, abs: Date.now() / 1000 });
async function start(page: Page, name: string): Promise<Rec> {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  current = name; events[name] = [];
  const cdp = await page.context().newCDPSession(page);
  let i = 0;
  cdp.on('Page.screencastFrame', (f: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    fs.writeFileSync(path.join(dir, `${String(i++).padStart(5, '0')}-${Math.round((f.metadata.timestamp ?? 0) * 1000)}.jpg`), Buffer.from(f.data, 'base64'));
    void cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => undefined);
  });
  const vp = page.viewportSize()!;
  const scale = (await page.evaluate(() => devicePixelRatio)) || 1;
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: Math.round(vp.width * scale), maxHeight: Math.round(vp.height * scale), everyNthFrame: 1 });
  return { stop: async () => { await cdp.send('Page.stopScreencast').catch(() => undefined); await cdp.detach().catch(() => undefined); console.log(`take ${name}: ${i} frames`); return i; } };
}

const wait = (p: Page, ms: number) => p.waitForTimeout(ms);
/** Moves the mouse along an eased path in `ms` (the drawn cursor follows). */
async function glide(p: Page, x: number, y: number, ms = 700) {
  const from = await p.evaluate(() => { const c = document.getElementById('vp-cursor'); const m = c?.style.transform.match(/translate\(([\d.]+)px, ?([\d.]+)px\)/); return m ? [+m[1], +m[2]] : [innerWidth * 0.72, innerHeight * 0.78]; });
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    await p.mouse.move(from[0] + (x - from[0]) * e, from[1] + (y - from[1]) * e);
    await wait(p, ms / steps);
  }
}
async function glideTo(p: Page, sel: ReturnType<Page['locator']>, ms = 700) {
  const b = await sel.boundingBox();
  if (b) await glide(p, b.x + b.width / 2, b.y + b.height / 2, ms);
}
async function settle(p: Page, url: string, ms = 2500) {
  await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => undefined);
  await wait(p, ms);
}

async function desktopContext(browser: Awaited<ReturnType<typeof chromium.launch>>) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  await ctx.addInitScript(CURSOR);
  if (REPLAY) await ctx.addInitScript(REPLAY_SCRIPT);
  return ctx;
}

// Figures below are the ones on screen: token page (Nock on Base) and Overview.
const ANSWERS = {
  token: {
    tools: ['token_information', 'flow_intelligence', 'dex_trades'],
    text: "**Moderate, and exits are the risk.** Nock scores 41 of 100. The heaviest input is **exit liquidity at 79**: $1.1M of liquidity against a $61M market cap, so size cannot leave quietly. Nansen's own risk indicators sit at 46, cohort shear at 50.\n\n**Who is selling:** in the last 24h, 184 sellers sold $942.7K against $766.2K bought by 359 buyers. Fewer, larger sellers are distributing into many small buyers.\n\n**Watch:** sell pressure is only 28 today. If it rises while liquidity stays thin, the score moves to Watch.",
  },
  home: {
    tools: ['chain_flows', 'token_screener'],
    text: "**Money is rotating into Ton and out of Near.** Ton leads net inflow at +$78.2K with a Flow Index of 64; Near lost $59.05M and reads 28. 27 of 38 chains are measured right now.\n\n**Worth a look:** Hyperliquid open interest is $16.27B, and six tokens score High or Critical dump risk.",
  },
};
const REPLAY_SCRIPT = `(() => {
  const A = ${JSON.stringify(ANSWERS)};
  const real = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (!url.endsWith('/api/explain')) return real(input, init);
    const a = location.pathname === '/' ? A.home : A.token;
    const enc = new TextEncoder();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const body = new ReadableStream({ async start(c) {
      const send = (e) => c.enqueue(enc.encode('event: ' + e.type + '\\ndata: ' + JSON.stringify(e) + '\\n\\n'));
      await sleep(450);
      for (const t of a.tools) { send({ type: 'tool', name: t }); await sleep(200); }
      await sleep(200);
      const words = a.text.split(' ');
      for (let i = 0; i < words.length; i++) { send({ type: 'delta', text: words[i] + (i < words.length - 1 ? ' ' : '') }); await sleep(28); }
      send({ type: 'finish' }); c.close();
    } });
    return Promise.resolve(new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }));
  };
})();`;

const takes: Record<string, (b: Awaited<ReturnType<typeof chromium.launch>>) => Promise<void>> = {
  async overview(b) {
    for (const name of ['overview', 'overview-2']) {
      const ctx = await desktopContext(b); const p = await ctx.newPage();
      await p.goto('about:blank');
      const r = await start(p, name);
      await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
      await wait(p, 1800);
      const ring = p.locator('svg[role="group"]').first();
      const box = await ring.boundingBox();
      if (box) await glide(p, box.x + box.width * (name === 'overview' ? 0.72 : 0.3), box.y + box.height * 0.35, 1400);
      await wait(p, 4200);
      await r.stop(); await ctx.close();
    }
  },
  async alpha(b) {
    const ctx = await desktopContext(b); const p = await ctx.newPage();
    await settle(p, '/alpha');
    const map = p.locator('section', { hasText: 'Market map' }).first();
    await map.scrollIntoViewIfNeeded(); await wait(p, 600);
    const box = await map.boundingBox();
    const r = await start(p, 'alpha');
    if (box) { await glide(p, box.x + box.width * 0.75, box.y + box.height * 0.3, 300); for (const [fx, fy] of [[0.62, 0.42], [0.5, 0.5], [0.4, 0.45], [0.33, 0.6], [0.26, 0.52]]) await glide(p, box.x + box.width * fx, box.y + box.height * fy, 650); }
    await wait(p, 600);
    await r.stop(); await ctx.close();
  },
  async flows(b) {
    const ctx = await desktopContext(b); const p = await ctx.newPage();
    await settle(p, '/flows');
    const chart = p.locator('section', { hasText: 'Flow Index, 7 days' }).first();
    await chart.scrollIntoViewIfNeeded(); await wait(p, 500);
    const box = await chart.boundingBox();
    const r = await start(p, 'flows');
    if (box) { await glide(p, box.x + box.width * 0.15, box.y + box.height * 0.5, 300); await glide(p, box.x + box.width * 0.9, box.y + box.height * 0.45, 2600); }
    await wait(p, 500);
    await r.stop(); await ctx.close();
  },
  async token(b) {
    const ctx = await desktopContext(b); const p = await ctx.newPage();
    const r = await start(p, 'token');
    await p.goto(BASE + TOKEN, { waitUntil: 'domcontentloaded' });
    await p.getByText(/Token Score: \d+ of 100/).first().waitFor({ timeout: 60_000 }).catch(() => undefined);
    await wait(p, 1500);
    const range = p.getByRole('tablist', { name: 'Range' });
    await glideTo(p, range.getByRole('tab', { name: '1M' }), 650);
    mark('click'); await range.getByRole('tab', { name: '1M' }).click();
    await wait(p, 1200);
    const style = p.getByRole('tablist', { name: 'Style' });
    await glideTo(p, style.getByRole('tab', { name: 'line' }), 420); mark('click'); await style.getByRole('tab', { name: 'line' }).click();
    await wait(p, 900);
    await glideTo(p, style.getByRole('tab', { name: 'candles' }), 350); mark('click'); await style.getByRole('tab', { name: 'candles' }).click();
    await wait(p, 1200);
    await r.stop(); await ctx.close();
  },
  async rug(b) {
    const ctx = await desktopContext(b); const p = await ctx.newPage();
    const r = await start(p, 'rug');
    await p.goto(BASE + RUG, { waitUntil: 'domcontentloaded' });
    await p.getByText(/Rug risk:/).first().waitFor({ timeout: 60_000 }).catch(() => undefined);
    await wait(p, 3000);
    await r.stop(); await ctx.close();
  },
  async analyze(b) {
    const ctx = await desktopContext(b); const p = await ctx.newPage();
    await settle(p, TOKEN, 1000);
    await p.getByText(/Token Score: \d+ of 100/).first().waitFor({ timeout: 60_000 }).catch(() => undefined);
    await wait(p, 2500);
    const head = await p.getByText(/Token Score: \d+ of 100/).first().boundingBox();
    const r = await start(p, 'analyze');
    await wait(p, 300);
    mark('chime'); await p.keyboard.press('Meta+j');
    const panel = p.getByRole('dialog', { name: 'Analyze with Nansen' });
    await panel.waitFor();
    await wait(p, 550);
    await glideTo(p, panel.getByRole('button', { name: /Select from page/ }), 450);
    mark('click'); await panel.getByRole('button', { name: /Select from page/ }).click();
    await wait(p, 200);
    if (head) await glide(p, head.x + 150, head.y + 190, 600);
    await wait(p, 350);
    mark('click'); await p.mouse.down(); await p.mouse.up();
    await wait(p, 450);
    const box = p.getByPlaceholder(/Ask about/);
    await glideTo(p, box, 450); await box.click();
    for (const ch of 'Why is the dump risk moderate, and who is selling?') { if (ch !== ' ') mark('type'); await p.keyboard.type(ch); await wait(p, 14); }
    await wait(p, 200);
    await glideTo(p, panel.getByRole('button', { name: 'Send' }), 300);
    mark('click'); await panel.getByRole('button', { name: 'Send' }).click();
    await panel.getByText(/score moves to Watch/).waitFor({ timeout: 30_000 }).catch(() => undefined);
    await wait(p, 1800);
    await r.stop(); await ctx.close();
  },
  async wallet(b) {
    const ctx = await desktopContext(b); const p = await ctx.newPage();
    const r = await start(p, 'wallet');
    await p.goto(BASE + WALLET, { waitUntil: 'domcontentloaded' });
    await p.getByText('Trader score').first().waitFor({ timeout: 60_000 }).catch(() => undefined);
    await wait(p, 2800);
    await r.stop(); await ctx.close();
  },
  async checker(b) {
    const ctx = await desktopContext(b); const p = await ctx.newPage();
    await settle(p, '/token');
    const r = await start(p, 'checker');
    await glide(p, 1100, 620, 500);
    for (let i = 0; i < 10; i++) { await p.mouse.wheel(0, 24); await wait(p, 60); }
    await wait(p, 900);
    await r.stop(); await ctx.close();
  },
  async markets(b) {
    const ctx = await desktopContext(b); const p = await ctx.newPage();
    for (const [name, url] of [['predict', '/predict'], ['perps', '/perps'], ['sectors', '/sectors']]) {
      await settle(p, url);
      const r = await start(p, `market-${name}`);
      await glide(p, 900, 520, 400); await glide(p, 1300, 640, 1400);
      await wait(p, 600);
      await r.stop();
    }
    await ctx.close();
  },
  async proof(b) {
    const ctx = await desktopContext(b); const p = await ctx.newPage();
    const r = await start(p, 'proof');
    await p.goto(BASE + '/proof', { waitUntil: 'domcontentloaded' });
    await wait(p, 4500);
    await r.stop(); await ctx.close();
  },
  async phone(b) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark' });
    await ctx.addInitScript(CURSOR);
    if (REPLAY) await ctx.addInitScript(REPLAY_SCRIPT);
    const p = await ctx.newPage();
    await settle(p, '/', 3000);
    const r = await start(p, 'phone');
    await wait(p, 400);
    const tabs = p.locator('nav[aria-label="Quick navigation"]');
    mark('phone_glass'); await tabs.getByText('Tokens', { exact: true }).tap();
    await wait(p, 1100);
    mark('phone_glass'); await tabs.getByText('Today', { exact: true }).tap();
    await wait(p, 900);
    for (let y = 0; y <= 1200; y += 40) { await p.evaluate((v) => scrollTo(0, v), y); await wait(p, 16); }
    await wait(p, 200);
    for (let y = 1200; y >= 0; y -= 60) { await p.evaluate((v) => scrollTo(0, v), y); await wait(p, 16); }
    await wait(p, 350);
    mark('chime'); await p.getByRole('button', { name: 'Ask about this screen' }).tap();
    await wait(p, 900);
    const panel = p.getByRole('dialog', { name: 'Analyze with Nansen' });
    mark('phone_glass'); await panel.locator('button', { hasText: /\?$/ }).first().tap().catch(() => undefined);
    await panel.getByText(/dump risk\./).waitFor({ timeout: 30_000 }).catch(() => undefined);
    await wait(p, 1500);
    await r.stop(); await ctx.close();
  },
};

async function main() {
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const want = process.argv.slice(2);
  const file = path.join(OUT, 'events.json');
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const [name, fn] of Object.entries(takes)) if (!want.length || want.includes(name)) await fn(browser);
  fs.writeFileSync(file, JSON.stringify({ ...prev, ...events }, null, 1));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
