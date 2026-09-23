import { chromium, type FullConfig } from '@playwright/test';

// The dev server compiles each route on its first request; load every
// route the suites visit once, in a real browser, so no test spends its
// timeout waiting on a compile. (Right after a source edit, Turbopack's dev
// server can still hydrate one page against a stale client chunk — a
// shifted base-ui useId — which a production build never does. For a clean
// signal run the suite against one: `next build` then E2E_URL=….)
const ROUTES = ['/', '/chain/base', '/chain/algorand', '/lab', '/coverage', '/alerts', '/account'];

export default async function warmup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const r of ROUTES) {
    await page.goto(new URL(r, baseURL).toString(), { timeout: 120_000 }).catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  }
  await browser.close();
}
