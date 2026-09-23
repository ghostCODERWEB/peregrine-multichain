// `pnpm screenshots`: README images from the running demo server (pnpm
// dev:demo on :3300), so they show real recorded data and stay reproducible.
import { chromium } from '@playwright/test';

const BASE = process.env.TIDE_URL ?? 'http://localhost:3300';
const shots: Array<{ path: string; file: string; wait?: string; height?: number; scrollTo?: string }> = [
  { path: '/', file: 'map.png', wait: 'svg[aria-label^="Hex map"]', height: 900 },
  { path: '/token/sui/0x76a49ebaf991fa2d4cb6a352af14425d453fe2ba6802b5ed2361b227150b6689%3A%3Atake%3A%3ATAKE', file: 'token.png', wait: 'text=/Storm Score: \\d+ of 100/', height: 1000 },
  { path: '/chain/base', file: 'chain.png', wait: '#flows', height: 900 },
  { path: '/lab', file: 'lab.png', wait: 'text=/Out of sample/', height: 950 },
  { path: '/coverage', file: 'coverage.png', wait: '#matrix', height: 950 },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  for (const s of shots) {
    await page.setViewportSize({ width: 1440, height: s.height ?? 900 });
    await page.goto(`${BASE}${s.path}`);
    if (s.wait) await page.waitForSelector(s.wait, { timeout: 60_000 });
    await page.waitForTimeout(2500); // charts settle
    if (s.scrollTo) await page.locator(s.scrollTo).scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
    await page.screenshot({ path: `docs/img/${s.file}` });
    console.log('shot', s.file);
  }
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
