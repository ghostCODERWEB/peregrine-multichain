// Call cards and the Desk (L1). A call is saved with the price Nansen reported
// at that moment (and the exact request behind it), plus what TIDE read then;
// once its horizon passes it is graded from Nansen candles for exactly that
// window. Calls are private to a desk and can't be edited: a track record
// that can be rewritten isn't one.
import { callNansen } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import { fixtureMode, requestDay } from '@/server/nansen/demo';
import { chainWeather } from '@/server/weather/queries';
import { viewOf } from '@/server/mode';
import type { RequestContext } from '@/server/context';
import { addressKey } from '@/lib/address-family';
import { HORIZONS, gradeCall, invalidationProblem, traderDna, type Grade, type Horizon, type Setup, type Stance } from '@/lib/models/calls';
import type { TokenOHLCVResponse } from '@/types/nansen/api.gen';

export const DESK_COOKIE = 'tide_desk';
export const MAX_OPEN = 50;
export const ANON_DAILY_CAP = 300;
const GRADE_DELAY = 10 * 60_000; // let the last candles land

export interface Receipt { endpoint: string; body: unknown; at: number; served: 'live' | 'cache' | 'recorded'; credits: number; excerpt: string }
export interface CallContext { storm: { score: number; band: string } | null; chainCpi: number | null; chainSource: string | null }
export interface CallCard {
  id: number; source: 'live' | 'replay'; chain: string; token: string; symbol: string | null;
  stance: Stance; horizon: Horizon; setup: Setup; thesis: string | null;
  entry: number; entryAt: number; invalidation: number | null; createdAt: number; dueAt: number;
  context: CallContext | null; entryReceipt: Receipt;
  grade: Grade | null; exit: number | null; ret: number | null; gradedAt: number | null;
  gradeReceipt: Receipt | null; gradeDetail: { best: number; worst: number; candles: number; invalidatedAt: number | null; exitAt: number } | null; gradeNote: string | null;
}

/** The owner, a signed-in member, or an anonymous visitor's desk cookie. */
export function deskScope(ctx: RequestContext, deskId: string | null): string | null {
  if (ctx.user) return `user:${ctx.user.id}`;
  if (ctx.mode === 'owner') return 'owner';
  return deskId && /^[A-Za-z0-9_-]{16,40}$/.test(deskId) ? `desk:${deskId}` : null;
}

type Row = Record<string, unknown>;
const json = <T,>(v: unknown): T | null => { try { return typeof v === 'string' ? JSON.parse(v) as T : null; } catch { return null; } };
const toCard = (r: Row): CallCard => ({
  id: r.id as number, source: r.source as CallCard['source'], chain: r.chain as string, token: r.token as string, symbol: (r.symbol as string | null) ?? null,
  stance: r.stance as Stance, horizon: r.horizon as Horizon, setup: r.setup as Setup, thesis: (r.thesis as string | null) ?? null,
  entry: r.entry_price as number, entryAt: r.entry_at as number, invalidation: (r.invalidation as number | null) ?? null, createdAt: r.created_at as number, dueAt: r.due_at as number,
  context: json<CallContext>(r.context), entryReceipt: json<Receipt>(r.entry_receipt)!,
  grade: (r.grade as Grade | null) ?? null, exit: (r.exit_price as number | null) ?? null, ret: (r.ret as number | null) ?? null, gradedAt: (r.graded_at as number | null) ?? null,
  gradeReceipt: json<Receipt>(r.grade_receipt), gradeDetail: json<CallCard['gradeDetail']>(r.grade_detail), gradeNote: (r.grade_note as string | null) ?? null,
});

const candlesOf = (d: TokenOHLCVResponse | undefined) => (d?.data ?? [])
  .filter((x) => x.close != null && x.close > 0)
  .map((x) => ({ t: Date.parse(x.interval_start), c: x.close! }))
  .filter((x) => Number.isFinite(x.t)).sort((a, b) => a.t - b.t);
const served = (cacheHit: boolean): Receipt['served'] => (fixtureMode() === 'replay' ? 'recorded' : cacheHit ? 'cache' : 'live');

/** The latest close, from the same request the token page's price chart makes
 *  (so it is usually already cached and costs nothing). */
export async function entryPrice(chain: string, token: string, now = Date.now()): Promise<{ price: number; candleAt: number; receipt: Receipt }> {
  const body = { chain, token_address: token, timeframe: '4h', date: { from: requestDay(14), to: requestDay(-1) } };
  const r = await callNansen<TokenOHLCVResponse>('tgm/token-ohlcv', body);
  const last = candlesOf(r.data).at(-1);
  if (!last) throw new Error('Nansen returned no price for this token right now, so the call can’t be timestamped.');
  return { price: last.c, candleAt: last.t, receipt: { endpoint: 'tgm/token-ohlcv', body, at: now, served: served(r.meta.cacheHit), credits: r.meta.cacheHit ? 0 : r.meta.creditsCost, excerpt: `close ${last.c} in the candle starting ${new Date(last.t).toISOString()}` } };
}

function snapshot(chain: string, token: string, ctx: RequestContext, now: number): CallContext {
  const storm = getDb().prepare('SELECT score, band FROM storm_scores WHERE chain = ? AND token_address = ? ORDER BY id DESC LIMIT 1').get(chain, addressKey(token)) as { score: number; band: string } | undefined;
  let chainCpi: number | null = null, chainSource: string | null = null;
  try { const w = chainWeather(chain, now, viewOf(ctx.mode)); chainCpi = w.cpi == null ? null : Math.round(w.cpi); chainSource = w.source ?? null; } catch { /* no reading is not zero */ }
  return { storm: storm ? { score: Math.round(storm.score), band: storm.band } : null, chainCpi, chainSource };
}

export interface NewCall { chain: string; token: string; symbol: string | null; stance: Stance; horizon: Horizon; setup: Setup; thesis: string | null; invalidation: number | null }

export async function createCall(scope: string, ctx: RequestContext, c: NewCall, now = Date.now()): Promise<CallCard> {
  const db = getDb();
  const open = (db.prepare('SELECT COUNT(*) AS n FROM calls WHERE scope = ? AND grade IS NULL').get(scope) as { n: number }).n;
  if (open >= MAX_OPEN) throw new Error(`This desk already has ${MAX_OPEN} open calls; wait for some to be graded.`);
  if (scope.startsWith('desk:')) {
    const today = (db.prepare("SELECT COUNT(*) AS n FROM calls WHERE scope LIKE 'desk:%' AND created_at >= ?").get(now - 86_400_000) as { n: number }).n;
    if (today >= ANON_DAILY_CAP) throw new Error('Anonymous desks on this instance have reached today’s limit. Sign in with your own Nansen key to keep calling.');
  }
  const e = await entryPrice(c.chain, c.token, now);
  const problem = invalidationProblem(c.stance, e.price, c.invalidation);
  if (problem) throw new Error(`${problem} Entry is ${e.price}.`);
  const context = snapshot(c.chain, c.token, ctx, now);
  const symbol = c.symbol ?? (db.prepare('SELECT symbol FROM storm_scores WHERE chain = ? AND token_address = ? ORDER BY id DESC LIMIT 1').get(c.chain, addressKey(c.token)) as { symbol: string | null } | undefined)?.symbol ?? null;
  const id = db.prepare(`INSERT INTO calls (scope, source, chain, token, symbol, stance, horizon, setup, thesis, entry_price, entry_at, invalidation, created_at, due_at, context, entry_receipt)
    VALUES (?, 'live', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(scope, c.chain, c.token, symbol, c.stance, c.horizon, c.setup, c.thesis, e.price, e.candleAt, c.invalidation, now, now + HORIZONS[c.horizon].ms, JSON.stringify(context), JSON.stringify(e.receipt)).lastInsertRowid;
  return toCard(db.prepare('SELECT * FROM calls WHERE id = ?').get(id) as Row);
}

export function listCalls(scope: string, limit = 200): CallCard[] {
  return (getDb().prepare('SELECT * FROM calls WHERE scope = ? ORDER BY created_at DESC LIMIT ?').all(scope, limit) as Row[]).map(toCard);
}

/** Grades due calls from Nansen candles for exactly each call's window
 *  (1 credit each, at most `max` per request). No candles yet → left open with a note. */
export async function gradeDue(scope: string, now = Date.now(), max = 6): Promise<{ graded: number; pending: number }> {
  const db = getDb();
  const due = db.prepare("SELECT * FROM calls WHERE scope = ? AND grade IS NULL AND source = 'live' AND due_at + ? <= ? ORDER BY due_at LIMIT ?").all(scope, GRADE_DELAY, now, max) as Row[];
  let graded = 0;
  for (const r of due) {
    const c = toCard(r);
    const hz = HORIZONS[c.horizon];
    const body = { chain: c.chain, token_address: c.token, timeframe: hz.timeframe, date_range: { start: new Date(c.createdAt).toISOString(), end: new Date(c.dueAt).toISOString() } };
    try {
      const res = await callNansen<TokenOHLCVResponse>('tgm/token-ohlcv', body);
      const g = gradeCall({ stance: c.stance, entry: c.entry, invalidation: c.invalidation, createdAt: c.createdAt, dueAt: c.dueAt, band: hz.band }, candlesOf(res.data));
      if (!g) { db.prepare('UPDATE calls SET grade_note = ? WHERE id = ?').run(`Nansen returned no ${hz.timeframe} candles for this window yet (checked ${new Date(now).toISOString()}).`, c.id); continue; }
      const receipt: Receipt = { endpoint: 'tgm/token-ohlcv', body, at: now, served: served(res.meta.cacheHit), credits: res.meta.cacheHit ? 0 : res.meta.creditsCost, excerpt: `${g.candles} ${hz.timeframe} closes; last ${g.exit} at ${new Date(g.exitAt).toISOString()}${g.invalidatedAt ? `; invalidation crossed at ${new Date(g.invalidatedAt).toISOString()}` : ''}${res.data.truncated ? ' (Nansen truncated the window)' : ''}` };
      db.prepare('UPDATE calls SET grade = ?, exit_price = ?, ret = ?, graded_at = ?, grade_receipt = ?, grade_detail = ?, grade_note = NULL WHERE id = ?')
        .run(g.grade, g.exit, g.ret, now, JSON.stringify(receipt), JSON.stringify({ best: g.best, worst: g.worst, candles: g.candles, invalidatedAt: g.invalidatedAt, exitAt: g.exitAt }), c.id);
      graded++;
    } catch (e) {
      db.prepare('UPDATE calls SET grade_note = ? WHERE id = ?').run(`Grading waits: ${(e as Error).message.slice(0, 160)}`, c.id);
    }
  }
  const pending = (db.prepare("SELECT COUNT(*) AS n FROM calls WHERE scope = ? AND grade IS NULL AND source = 'live' AND due_at + ? <= ?").get(scope, GRADE_DELAY, now) as { n: number }).n;
  return { graded, pending };
}

export function deskSummary(scope: string) {
  const calls = listCalls(scope);
  return {
    calls,
    dna: {
      bySetup: traderDna(calls, (c) => c.setup),
      byHorizon: traderDna(calls, (c) => c.horizon),
      bySource: traderDna(calls, (c) => (c.source === 'replay' ? 'Time Machine replays' : 'live calls')),
    },
  };
}
