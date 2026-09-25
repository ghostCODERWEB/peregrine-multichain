// Scorecard: measurable checks behind the project scores (Nansen data use,
// UI/UX, code quality). Each metric is a pass rate of concrete checks, never
// a feeling. Run against a keyless demo server:
//   SCORE_URL=http://localhost:3000 pnpm tsx scripts/scorecard.ts
// Writes docs/SCORECARD.md and docs/scorecard.json.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { coverageStats, ALL_LEDGER } from '../src/config/endpoint-ledger';

const BASE = process.env.SCORE_URL ?? 'http://localhost:3000';
const ROOT = path.resolve(__dirname, '..');
const sh = (cmd: string) => { try { return { ok: true, out: execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', maxBuffer: 64 << 20 }) }; } catch (e) { const x = e as { stdout?: string; stderr?: string }; return { ok: false, out: `${x.stdout ?? ''}${x.stderr ?? ''}` }; } };

const ROUTES = ['/', '/flows', '/alpha', '/sectors', '/perps', '/predict', '/rug', '/rug/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631',
  '/token/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631', '/chain/base', '/wallet/0xcbb811f129782ef87e19dea9d3375045219bae00',
  '/smart-money', '/portfolio', '/lab', '/desk', '/trade', '/alerts', '/agent', '/coverage', '/replay/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722'];
const VIEWS = [{ name: 'desktop dark', w: 1440, h: 1000, theme: 'navy' }, { name: 'phone dark', w: 390, h: 844, theme: 'navy' }, { name: 'desktop light', w: 1440, h: 1000, theme: 'paper' }];

type Check = { metric: string; name: string; pass: boolean; detail?: string };
const checks: Check[] = [];
const add = (metric: string, name: string, pass: boolean, detail?: string) => { checks.push({ metric, name, pass, detail }); };

// ---- Code quality (static) -------------------------------------------------
const tsc = sh('pnpm -s typecheck');
add('Code quality', 'TypeScript: 0 errors', tsc.ok, tsc.ok ? undefined : tsc.out.split('\n').filter((l) => l.includes('error TS')).slice(0, 5).join(' | '));
const lint = sh('pnpm -s lint');
add('Code quality', 'ESLint: 0 problems', lint.ok, lint.ok ? undefined : lint.out.slice(0, 400));
const unit = sh('pnpm -s vitest run --coverage --coverage.reporter=json-summary --coverage.include=src/lib/** --coverage.include=src/server/** --coverage.exclude=**/*.test.ts');
const tests = /Tests\s+(\d+) passed(?: \| (\d+) skipped)?(?: \| (\d+) failed)?/.exec(unit.out) ?? /Tests\s+(\d+) failed/.exec(unit.out);
add('Code quality', 'Unit tests all pass', unit.ok, tests ? tests[0] : unit.out.slice(-300));
let covPct = 0;
try {
  const cov = JSON.parse(fs.readFileSync(path.join(ROOT, 'coverage/coverage-summary.json'), 'utf8')) as { total: { lines: { pct: number } } };
  covPct = cov.total.lines.pct;
} catch { /* no summary */ }
add('Code quality', 'Line coverage of src/lib + src/server ≥ 80%', covPct >= 80, `${covPct.toFixed(1)}%`);
// Readability: one-line blocks of JSX/logic past 220 characters (some rewrites packed whole components on one line).
const longLines: string[] = [];
const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f.name) && !/\.test\./.test(f.name)) fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (l.length > 220 && !/^\s*(\/\/|\*|import )/.test(l) && !/['"`].{150,}['"`]/.test(l)) longLines.push(`${path.relative(ROOT, p)}:${i + 1}`); }); } };
walk(path.join(ROOT, 'src'));
add('Code quality', 'No code lines over 220 characters (excluding prose strings)', longLines.length === 0, `${longLines.length}${longLines.length ? `: ${longLines.slice(0, 6).join(', ')}` : ''}`);

// ---- Nansen data (static) ---------------------------------------------------
const cs = coverageStats();
add('Nansen data', 'Every API operation used, or skipped with a written reason (0 planned, 0 unaccounted)', cs.used + cs.skipped === cs.total && cs.planned === 0, `${cs.used} used + ${cs.skipped} skipped with reasons of ${cs.total}`);
add('Nansen data', 'At least 90% of API operations in use', cs.usedPct >= 0.9, `${(cs.usedPct * 100).toFixed(1)}%`);
add('Nansen data', 'Every used operation has a redistribution class', ALL_LEDGER.filter((l) => l.usedBy?.length).every((l) => !!l.class), undefined);
const guard = sh('pnpm -s assert-nansen-only');
add('Nansen data', 'Only Nansen data hosts in src/', guard.ok, guard.ok ? undefined : guard.out.slice(0, 300));
const redact = sh('pnpm -s vitest run src/server/redact.test.ts src/server/agents/quick.test.ts src/lib/rug.test.ts src/middleware.test.ts src/server/site.test.ts');
add('Nansen data', 'Redaction, label guard, public-site and budget tests pass', redact.ok, (/Tests\s+[^\n]+/.exec(redact.out) ?? [''])[0]);

// ---- Novelty ------------------------------------------------------------------
// Novelty is ultimately a judgment; what can be checked is that each feature
// no other Nansen surface offers is real: reachable from the nav and covered
// by a test that exercises it end to end.
const nav = fs.readFileSync(path.join(ROOT, 'src/components/shell/nav.ts'), 'utf8');
const has = (f: string) => fs.existsSync(path.join(ROOT, f));
const src = (f: string) => (has(f) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '');
const inNav = (r: string) => nav.includes(`href: '${r}'`);
// [feature, reachable?, how it is reached, test that exercises it]
const NOVEL: Array<[string, boolean, string, string]> = [
  ['Cross-chain capital map (wallet rotations for the owner; measured net flow with modeled arcs in public)', inNav('/flows'), 'nav: Capital Flows', 'e2e/flows.spec.ts'],
  ['Rug Checker: six measured checks and a model verdict on 25 networks', inNav('/rug'), 'nav: Rug Checker', 'e2e/rug.spec.ts'],
  ['Calls graded against real candles, with Trader DNA', inNav('/desk'), 'nav: Desk', 'e2e/desk.spec.ts'],
  ['Time Machine: lock a call on past data, then reveal', src('src/components/desk/CallForm.tsx').includes('/replay/'), 'token page → Make a call', 'e2e/replay.spec.ts'],
  ['Dump Risk model with a published out-of-sample backtest', inNav('/lab'), 'nav: Backtest Lab', 'src/lib/models/storm-score.test.ts'],
  ['Ask Nansen on any token, with a public label guard', src('src/components/token/TokenView.tsx').includes('TokenAskChat'), 'every token page', 'src/server/agents/quick.test.ts'],
  ['Public site on one key: no wallet, same-origin API, daily budget', has('src/middleware.ts'), 'TIDE_PUBLIC_SITE=1', 'src/middleware.test.ts'],
];
for (const [name, reach, how, test] of NOVEL) add('Novelty', name, reach && has(test), `${how} · ${test}${has(test) ? '' : ' (missing)'}`);

// ---- UI/UX (browser) -------------------------------------------------------
async function browser() {
  const b = await chromium.launch();
  let overflow = 0, errors = 0, axeSerious = 0;
  const overflowAt: string[] = [], errorAt: string[] = [], axeAt: string[] = [];
  for (const v of VIEWS) {
    const ctx = await b.newContext({ viewport: { width: v.w, height: v.h } });
    await ctx.addInitScript((t) => { try { localStorage.setItem('tide-theme', t); } catch { /* */ } }, v.theme);
    for (const r of ROUTES) {
      const p = await ctx.newPage();
      const errs: string[] = [];
      p.on('pageerror', (e) => errs.push(e.message));
      p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
      try {
        await p.goto(BASE + r, { waitUntil: 'load', timeout: 120_000 });
        await p.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await p.waitForTimeout(800);
        const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (ov > 1) { overflow++; overflowAt.push(`${r} (${v.name}, ${ov}px)`); }
        if (errs.length) { errors++; errorAt.push(`${r} (${v.name}): ${errs[0]}`); }
        const res = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        const bad = res.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical');
        if (bad.length) { axeSerious += bad.length; axeAt.push(`${r} (${v.name}): ${bad.map((x) => `${x.id}×${x.nodes.length}`).join(', ')}`); }
      } catch (e) { errors++; errorAt.push(`${r} (${v.name}): ${(e as Error).message.slice(0, 120)}`); }
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  const n = ROUTES.length * VIEWS.length;
  add('UI/UX', `No sideways scroll on ${ROUTES.length} routes × ${VIEWS.length} views`, overflow === 0, overflow ? overflowAt.slice(0, 8).join('; ') : `${n} pages`);
  add('UI/UX', 'No page or console errors', errors === 0, errors ? errorAt.slice(0, 8).join('; ') : `${n} pages`);
  add('UI/UX', 'No serious or critical WCAG 2.1 AA violations (axe)', axeSerious === 0, axeSerious ? `${axeSerious}: ${axeAt.slice(0, 10).join('; ')}` : `${n} pages`);
}

// Design consistency: legacy pre-P8 panel and heading classes left in pages.
const legacy = sh(`grep -rnE "className=\\"(glass|[^\\"]* glass)[ \\"]|text-base font-semibold text-ink\\"|rounded-md border border-border bg-raised" src/app src/components`);
const legacyHits = legacy.ok ? legacy.out.trim().split('\n').filter(Boolean) : [];
add('UI/UX', 'No legacy (pre-redesign) panel or heading styles', legacyHits.length === 0, `${legacyHits.length}${legacyHits.length ? `: ${legacyHits.slice(0, 5).map((l) => l.split(':').slice(0, 2).join(':')).join(', ')}` : ''}`);

// Bundle budget from the last production build's stdout, if saved.
const buildLog = path.join(ROOT, '.score-build.log');
if (fs.existsSync(buildLog)) {
  const over = fs.readFileSync(buildLog, 'utf8').split('\n').flatMap((l) => { const m = /^[├└┌]\s+ƒ\s+(\S+)\s+[\d.]+ k?B\s+([\d.]+) kB/.exec(l); return m && Number(m[2]) > 250 ? [`${m[1]} ${m[2]} kB`] : []; });
  add('UI/UX', 'First-load JS ≤ 250 kB on every route', over.length === 0, over.join(', ') || 'all within budget');
}

function report() {
// ---- Report -----------------------------------------------------------------
const metrics = [...new Set(checks.map((c) => c.metric))];
const score = (m: string) => { const cs = checks.filter((c) => c.metric === m); return Math.round((100 * cs.filter((c) => c.pass).length) / cs.length); };
const at = new Date().toISOString().replace('T', ' ').slice(0, 16);
const md = [`# Scorecard — ${at} UTC`, '', 'Each metric is the share of its checks that pass (scripts/scorecard.ts, run on the keyless demo).', '',
  '| Metric | Score |', '| --- | --- |', ...metrics.map((m) => `| ${m} | **${score(m)}** |`), '',
  ...metrics.flatMap((m) => [`## ${m}`, '', ...checks.filter((c) => c.metric === m).map((c) => `- ${c.pass ? '✅' : '❌'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`), ''])].join('\n');
fs.writeFileSync(path.join(ROOT, 'docs/SCORECARD.md'), md + '\n');
fs.writeFileSync(path.join(ROOT, 'docs/scorecard.json'), JSON.stringify({ at, scores: Object.fromEntries(metrics.map((m) => [m, score(m)])), checks }, null, 2));
console.log(md);
}

browser().then(report).catch((e) => { console.error(e); process.exit(1); });
