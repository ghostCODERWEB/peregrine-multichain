import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getKv } from '@/server/nansen/db';
import { callNansen } from '@/server/nansen/client';
import { fixtureMode } from '@/server/nansen/demo';
import type { RequestContext } from '@/server/context';
import { viewOf } from '@/server/mode';
import { addressKey } from '@/lib/address-family';
import { closedBy, entryAndPath, REPLAYS, type ReplayAt, type CandlePoint } from '@/lib/models/replay';
import { HORIZONS, gradeCall, invalidationProblem, type Setup, type Stance } from '@/lib/models/calls';
import type { TokenOHLCVResponse } from '@/types/nansen/api.gen';
import { candlesOf, served, toCard, ANON_DAILY_CAP, type CallContext, type Receipt } from './calls';

const TTL = 2 * 3_600_000;
const TF = { '1h': 300_000, '24h': 3_600_000, '7d': 4 * 3_600_000 };
export interface ReplayReading { name: string; value: number; at: number; source: string }
interface Payload {
  chain: string; token: string; horizon: ReplayAt; cut: number; due: number;
  entry: CandlePoint; history: CandlePoint[]; outcome: CandlePoint[];
  readings: ReplayReading[]; context: CallContext; receipt: Receipt;
}
interface Session { id: string; scope: string; view: string; prepared_at: number; payload: string; call_id: number | null }

/** No current gauges are reconstructed from today's waves. Missing past data
 * stays missing. Undo the demo importer clock shift before joining candles. */
export function replaySnapshot(chain: string, token: string, ctx: RequestContext, cut: number) {
  const db = getDb();
  const demo = fixtureMode() === 'replay' ? getKv('demo_recorded_at') : null;
  const shift = demo ? demo.updatedAt - Number(demo.value) : 0;
  const T = cut + shift, key = addressKey(token), source = viewOf(ctx.mode) === 'private' ? 'smart-money' : 'market-flow';
  const storm = db.prepare('SELECT score, band, computed_at AS at FROM storm_scores WHERE chain = ? AND token_address = ? AND computed_at <= ? ORDER BY computed_at DESC LIMIT 1').get(chain, key, T) as { score: number; band: string; at: number } | undefined;
  const cpi = db.prepare('SELECT cpi, snapshot_at AS at FROM chain_cpi WHERE chain = ? AND source = ? AND snapshot_at <= ? ORDER BY snapshot_at DESC LIMIT 1').get(chain, source, T) as { cpi: number; at: number } | undefined;
  const pulse = db.prepare("SELECT netflow, volume, snapshot_at AS at FROM token_pulse WHERE chain = ? AND token_address = ? AND source = ? AND window = '1h' AND snapshot_at <= ? ORDER BY snapshot_at DESC LIMIT 1").get(chain, key, source, T) as { netflow: number | null; volume: number | null; at: number } | undefined;
  const readings: ReplayReading[] = [];
  if (storm) readings.push({ name: 'Dump Risk', value: storm.score, at: storm.at - shift, source: 'stored Dump Risk model' });
  if (cpi) readings.push({ name: 'Chain flow', value: cpi.cpi, at: cpi.at - shift, source });
  if (pulse?.netflow != null) readings.push({ name: '1h net flow (USD)', value: pulse.netflow, at: pulse.at - shift, source });
  if (pulse?.volume != null) readings.push({ name: '1h volume (USD)', value: pulse.volume, at: pulse.at - shift, source });
  return { readings, context: { storm: storm ? { score: Math.round(storm.score), band: storm.band } : null, chainCpi: cpi ? Math.round(cpi.cpi) : null, chainSource: cpi ? source : null, replayAt: cut } satisfies CallContext };
}

function recordedWindow(chain: string, token: string, horizon: ReplayAt) {
  // Real, existing Nansen candles only. Never shift their prices/timestamps or
  // invent an unsupported demo window. A receipt names the original request.
  const entries = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'fixtures/tgm-token-ohlcv.json'), 'utf8')) as Array<{ request: Record<string, unknown>; response: TokenOHLCVResponse; recordedAt: number }>;
  const tf = TF[horizon];
  for (const e of entries.filter((x) => x.request.chain === chain && x.request.token_address === token && x.request.timeframe === HORIZONS[horizon].timeframe).sort((a, b) => b.recordedAt - a.recordedAt)) {
    const candles = closedBy(candlesOf(e.response), e.recordedAt, tf);
    const last = candles.at(-1);
    if (!last) continue;
    const due = last.t + tf, cut = due - REPLAYS[horizon];
    const split = entryAndPath(candles, cut, due, tf);
    if (split && complete(split.path, cut, due, tf) && cut - (split.entry.t + tf) <= tf) return { candles, cut, due, body: e.request, at: e.recordedAt };
  }
  throw new Error(`No complete recorded ${horizon} replay for this token. Choose a recorded window/token; no prices are fabricated.`);
}
const complete = (cs: CandlePoint[], cut: number, due: number, tf: number) => cs.length === (due - cut) / tf && cs.every((c, i) => c.t === cut + i * tf);

export async function prepareReplay(scope: string, ctx: RequestContext, chain: string, token: string, horizon: ReplayAt, now = Date.now()) {
  const db = getDb();
  // Reserve before IO; failed/abandoned previews still count toward the cap.
  const id = crypto.randomBytes(24).toString('base64url');
  db.transaction(() => {
    const count = (db.prepare('SELECT COUNT(*) AS n FROM replay_sessions WHERE scope = ? AND prepared_at > ?').get(scope, now - 3_600_000) as { n: number }).n;
    if (count >= 12) throw new Error('At most 12 replay previews per desk per hour.');
    if (scope.startsWith('desk:') && (db.prepare("SELECT COUNT(*) AS n FROM replay_sessions WHERE scope LIKE 'desk:%' AND prepared_at > ?").get(now - 86_400_000) as { n: number }).n >= ANON_DAILY_CAP) throw new Error('Anonymous replay previews have reached the instance daily cap.');
    db.prepare('INSERT INTO replay_sessions (id, scope, view, prepared_at, payload) VALUES (?, ?, ?, ?, ?)').run(id, scope, viewOf(ctx.mode), now, '{}');
  }).immediate();
  const tf = TF[horizon], demo = fixtureMode() === 'replay';
  let due = Math.floor((now - 10 * 60_000) / tf) * tf, cut = due - REPLAYS[horizon];
  let body: Record<string, unknown> = { chain, token_address: token, timeframe: HORIZONS[horizon].timeframe, date_range: { start: new Date(cut - 24 * tf).toISOString(), end: new Date(due).toISOString() } };
  let candles: CandlePoint[], receipt: Receipt;
  if (demo) {
    const r = recordedWindow(chain, token, horizon);
    candles = r.candles; cut = r.cut; due = r.due; body = r.body;
    receipt = { endpoint: 'tgm/token-ohlcv', body, at: r.at, served: 'recorded', credits: 0, excerpt: 'Recorded candle request, cut to fully closed historical intervals.' };
  } else {
    const r = await callNansen<TokenOHLCVResponse>('tgm/token-ohlcv', body);
    if (r.data.truncated) throw new Error('Nansen truncated this window; a complete replay cannot be graded.');
    candles = candlesOf(r.data);
    receipt = { endpoint: 'tgm/token-ohlcv', body, at: now, served: served(r.meta.cacheHit), credits: r.meta.cacheHit ? 0 : r.meta.creditsCost, excerpt: 'Historical candle request; only fully closed intervals are used.' };
  }
  const split = entryAndPath(candles, cut, due, tf);
  if (!split || cut - (split.entry.t + tf) > tf || !complete(split.path, cut, due, tf)) throw new Error('The historical window has missing or stale candles; no grade is invented.');
  const past = replaySnapshot(chain, token, ctx, cut);
  const payload: Payload = { chain, token, horizon, cut, due, entry: split.entry, history: closedBy(candles, cut, tf).slice(-24), outcome: split.path, ...past, receipt };
  db.prepare('UPDATE replay_sessions SET payload = ? WHERE id = ?').run(JSON.stringify(payload), id);
  // Explicit allowlist: outcome candles never reach the browser before lock.
  return { id, chain, token, horizon, cut, due, entry: payload.entry.c, history: payload.history, readings: payload.readings, receipt, expiresAt: now + TTL };
}

export function lockReplay(scope: string, ctx: RequestContext, id: string, stance: Stance, setup: Setup, thesis: string | null, invalidation: number | null, now = Date.now()) {
  const db = getDb();
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM replay_sessions WHERE id = ? AND scope = ? AND view = ?').get(id, scope, viewOf(ctx.mode)) as Session | undefined;
    if (!row || now - row.prepared_at > TTL) throw new Error('Replay expired or belongs to another desk. Prepare a new one.');
    const p = JSON.parse(row.payload) as Payload;
    if (!p.outcome) throw new Error('Replay is not ready. Prepare a new one.');
    if (row.call_id != null) {
      const saved = toCard(db.prepare('SELECT * FROM calls WHERE id = ? AND scope = ?').get(row.call_id, scope) as Record<string, unknown>);
      if (saved.stance !== stance) throw new Error('This replay decision is already locked.');
      return { call: saved, path: p.outcome };
    }
    const problem = invalidationProblem(stance, p.entry.c, invalidation);
    if (problem) throw new Error(problem);
    const g = gradeCall({ stance, entry: p.entry.c, invalidation, createdAt: p.cut, dueAt: p.due, band: HORIZONS[p.horizon].band }, p.outcome);
    if (!g) throw new Error('No outcome candles; no grade is invented.');
    const entryReceipt = { ...p.receipt, excerpt: `Entry close ${p.entry.c}, candle fully closed at ${new Date(p.entry.t + TF[p.horizon]).toISOString()}, no later than cutoff ${new Date(p.cut).toISOString()}.` };
    const gradeReceipt = { ...p.receipt, credits: 0, excerpt: `${g.candles} complete ${HORIZONS[p.horizon].timeframe} candles after the cutoff. Last close ${g.exit}. Outcome was held server-side until this decision was locked; no new call on reveal.` };
    const result = db.prepare("INSERT INTO calls (scope, source, chain, token, stance, horizon, setup, thesis, entry_price, entry_at, invalidation, created_at, due_at, context, entry_receipt, grade, exit_price, ret, graded_at, grade_receipt, grade_detail) VALUES (?, 'replay', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(scope, p.chain, p.token, stance, p.horizon, setup, thesis, p.entry.c, p.entry.t, invalidation, now, p.due, JSON.stringify(p.context), JSON.stringify(entryReceipt), g.grade, g.exit, g.ret, now, JSON.stringify(gradeReceipt), JSON.stringify({ best: g.best, worst: g.worst, candles: g.candles, invalidatedAt: g.invalidatedAt, exitAt: g.exitAt }));
    db.prepare('UPDATE replay_sessions SET call_id = ? WHERE id = ?').run(result.lastInsertRowid, id);
    return { call: toCard(db.prepare('SELECT * FROM calls WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>), path: p.outcome };
  }).immediate();
}
