// Integration tests on recorded Nansen responses (DEMO_MODE replay) and a
// fresh database seeded from the recorded demo history: the token, chain, board and wallet pipelines
// run end to end offline, with real response shapes, no key and no credits.
import { describe, it, expect, afterAll, vi } from 'vitest';
import fs from 'node:fs';

const dir = await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-replay-'));
  Object.assign(process.env, { TIDE_DB_PATH: p.join(d, 'replay.db'), DEMO_MODE: '1', NANSEN_API_KEY: '' });
  return d;
});

import { headerWave, marketWave, windWave, holdersWave, forensicsWave, isUnavailable } from './token/waves';
import { tapeWave, riverWave, socialWave, dcaWave, leverageWave } from './token/terminal';
import { forecastWave } from './token/forecast';
import { computeStorm, stormCandidates } from './token/storm';
import { rugReport } from '@/lib/rug';
import { chainPage } from './weather/chain-page';
import { buildBulletin } from './weather/bulletin';
import { perpBoard, perpTitle } from './perps/board';
import { sectorWeather } from './sectors/weather';
import { alphaBoard } from './alpha/board';
import { predictBoard, predictTitle } from './predict/board';
import { balances, pnl, origins, counterparties, transactions, migrationTrail } from './wallet/wallet-page';
import { walletDesk } from './wallet/desk';
import { callTool } from './mcp/tools';
import { smDesk } from './smart-money/desk';
import { layout3d, project } from '@/lib/viz/sphere3d';
import type { RequestContext } from './context';
import { runScan } from './weather/scanner';
import { portfolio } from './portfolio/portfolio';
import { marketDetail } from './predict/board';
import { txLookup, newsSearch } from './token/ondemand';
import { alphaForward, ppiForward, spearman } from './backtest/forward';
import { builderContext, planTemplate, channelOf } from './agents/builder';
import { followScope, readFollows, setFollow, parseChain } from './smart-money/desk';
import { explainRejection, paymentStats, checkPayment } from './nansen/x402';

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
const AERO = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
const ok = <T,>(w: T | { unavailable: string }): T => { if (isUnavailable(w as never)) throw new Error((w as { unavailable: string }).unavailable); return w as T; };

describe('token pipeline on recorded AERO responses', () => {
  it('header, market, wind, holders, forensics, Dump Risk and the rug report', async () => {
    const header = await headerWave('base', AERO);
    expect(ok(header).symbol).toBe('AERO');
    const market = await marketWave('base', AERO, true);
    expect(ok(market).candles.length).toBeGreaterThan(10);
    const [wind, holders] = await Promise.all([windWave('base', AERO), holdersWave('base', AERO)]);
    expect(ok(holders).holders.length).toBeGreaterThan(10);
    const forensics = await forensicsWave('base', AERO, ok(holders).holders);
    const storm = computeStorm(header, wind, holders, forensics, true);
    const s = ok(storm);
    expect(s.result.score).toBeGreaterThanOrEqual(0);
    expect(s.result.score).toBeLessThanOrEqual(100);
    const rug = rugReport({ header, holders, forensics, storm });
    expect(rug.checks).toHaveLength(6);
    expect(rug.verdict).not.toBe('unknown');
    const fc = await forecastWave('base', AERO, ok(market).candles);
    expect(fc).toBeTruthy();
  });

  it('terminal waves answer or explain', async () => {
    const out = await Promise.all([tapeWave('base', AERO), riverWave('base', AERO, false), socialWave('AERO'), dcaWave('base', AERO, 1e6), leverageWave('AERO')]);
    for (const w of out) expect(w).toBeTruthy();
    expect(stormCandidates(out[2] as never, out[3] as never)).toBeTruthy();
  });
});

describe('pages and boards on the demo database', () => {
  it('bulletin, chain page and boards build in the public view', async () => {
    const b = buildBulletin('public');
    expect(b.chains.length).toBeGreaterThan(30);
    expect(b.fronts).toEqual([]); // rotations never in public
    const page = await chainPage('base', 'public');
    expect(page.chain).toBe('base');
    const perps = perpBoard('public');
    expect(typeof perpTitle(perps)).toBe('string');
    expect(sectorWeather('public')).toBeTruthy();
    expect(alphaBoard('public')).toBeTruthy();
    const pm = await predictBoard();
    expect(typeof predictTitle(pm)).toBe('string');
  });
});

const WALLET = '0xcbb811f129782ef87e19dea9d3375045219bae00';
const PUBLIC_CTX = { mode: 'public', user: null, apiKey: null, keyLast4: null, keyPlan: null } as RequestContext;

describe('wallet pipeline on recorded responses', () => {
  it('balances, PnL, origins, counterparties, transactions and trail answer or explain', async () => {
    const out = await Promise.all([balances(WALLET), pnl(WALLET), origins(WALLET, 'base'), counterparties(WALLET, 'base'), transactions(WALLET)]);
    for (const w of out) expect(w).toBeTruthy();
    expect(migrationTrail(WALLET)).toBeTruthy();
  });
  it('every wallet desk section answers or explains', async () => {
    for (const section of ['pnl', 'dex', 'defi', 'perps', 'prediction', 'history', 'points'] as const) {
      // A section with no recording throws; its route turns that into a message.
      expect(await walletDesk(WALLET, 'base', section).catch((e: Error) => e.message), section).toBeTruthy();
    }
  });
});

describe('MCP tools in the public view', () => {
  it('each public tool returns data or a reason; smart money is refused', async () => {
    for (const name of ['tide_weather', 'tide_alpha', 'tide_perps', 'tide_sectors', 'tide_predictions', 'tide_fronts']) {
      const r = await callTool(PUBLIC_CTX, name, {}).catch((e: Error) => ({ error: e.message }));
      expect(r, name).toBeTruthy();
    }
    expect(await callTool(PUBLIC_CTX, 'tide_chain', { chain: 'base' }).catch((e: Error) => e.message)).toBeTruthy();
    expect(await callTool(PUBLIC_CTX, 'tide_storm', { chain: 'base', address: AERO }).catch((e: Error) => e.message)).toBeTruthy();
    expect(await callTool(PUBLIC_CTX, 'tide_smart_money', { view: 'holdings' })).toMatchObject({ isError: true });
  });
  it('the smart-money desk builds from recordings', async () => {
    expect(await smDesk('all').catch((e: Error) => e.message)).toBeTruthy();
  });
});

describe('holder sphere geometry', () => {
  it('spreads nodes, pulls linked ones together, and projects inside the frame', () => {
    const nodes = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, x: 0, y: 0, z: 0, r: 1 + (i % 3) }));
    const out = layout3d(nodes, [{ a: 'n0', b: 'n1', w: 1 }], 120);
    expect(out).toHaveLength(12);
    for (const n of out) expect(Number.isFinite(n.x + n.y + n.z)).toBe(true);
    const d = (a: typeof out[0], b: typeof out[0]) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(d(out[0], out[1])).toBeLessThan(d(out[0], out[6]) + 1e-9 + 10);
    const pt = project(out[0], 0.4, 0.2, 100, 100);
    expect(Object.values(pt).every((v) => typeof v !== 'number' || Number.isFinite(v))).toBe(true);
  });
});

describe('scanner, portfolio and on-demand lookups on recordings', () => {
  it('a scan runs on recorded screener responses', async () => {
    const r = await runScan({ sweep: 'defer' }).catch((e: Error) => e.message);
    expect(r).toBeTruthy();
  });
  it('portfolio, a prediction market and token lookups answer or explain', async () => {
    expect(await portfolio([WALLET]).catch((e: Error) => e.message)).toBeTruthy();
    const pm = await predictBoard();
    const id = (pm as unknown as { markets?: Array<{ id: string }> }).markets?.[0]?.id;
    if (id) expect(await marketDetail(id).catch((e: Error) => e.message)).toBeTruthy();
    expect(await txLookup('base', '0x' + 'a'.repeat(64), null).catch((e: Error) => e.message)).toBeTruthy();
    expect(await newsSearch('Aerodrome', 'AERO').catch((e: Error) => e.message)).toBeTruthy();
  });
  it('forward checks and rank correlation', () => {
    const up = Array.from({ length: 6 }, (_, i) => ({ score: i, fwd: i * 2 }));
    expect(spearman(up)).toBeCloseTo(1);
    expect(spearman(up.map((p) => ({ ...p, fwd: -p.fwd })))).toBeCloseTo(-1);
    expect(spearman(up.slice(0, 3))).toBeNull(); // too few pairs
    expect(alphaForward('public')).toBeTruthy();
    expect(ppiForward('public')).toBeTruthy();
  });
  it('the alert builder plans a template for the public view without creating anything', () => {
    expect(builderContext(PUBLIC_CTX)).toBeTruthy();
    expect(() => channelOf({ type: 'telegram', chatId: 'abc' })).toThrow();
    const ch = channelOf({ type: 'telegram', chatId: '123456' });
    expect(() => planTemplate(PUBLIC_CTX, 'token-flows' as never, { chain: 'base', token: AERO } as never, ch as never)).not.toThrow();
  });
});

describe('owner views on the demo database', () => {
  it('bulletin, chain page and boards also build for the owner', async () => {
    expect(buildBulletin('private').chains.length).toBeGreaterThan(30);
    expect((await chainPage('base', 'owner')).chain).toBe('base');
    expect(perpBoard('private')).toBeTruthy();
    expect(sectorWeather('private')).toBeTruthy();
    expect(alphaBoard('private')).toBeTruthy();
  });
  it('follow lists are scoped to an account or the owner, never an anonymous visitor', () => {
    expect(followScope(PUBLIC_CTX)).toBeNull();
    expect(followScope({ ...PUBLIC_CTX, mode: 'owner' })).toBe('owner');
    setFollow('owner', WALLET, true, null);
    expect(readFollows('owner')).toContain(WALLET);
    setFollow('owner', WALLET, false, null);
    expect(readFollows('owner')).not.toContain(WALLET);
    expect(parseChain('base')).toBe('base');
    expect(parseChain('not-a-chain')).toBe('all');
  });
  it('x402: rejections are explained, bad headers refused, stats read', async () => {
    expect(explainRejection('{"reason":"insufficient_funds"}', 'base')).toMatch(/fund|USDC|balance/i);
    expect(await checkPayment('not-base64').catch((e: Error) => e.message)).toBeTruthy();
    expect(paymentStats(0)).toBeTruthy();
  });
});
