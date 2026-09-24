// Smart-money follow-through (L4), owner only: the events come from this
// instance's own smart-money trade tape, which is restricted data. For each of
// the largest recent smart-money buys on a token, TIDE reads the all-trader DEX
// tape for the 10 minutes before and after (exact ISO windows, at most two
// pages each) and the hourly candles for the 24h outcome. Explicit and priced;
// cached an hour; never recorded as fixtures, since the windows would reveal
// when smart money traded.
import { callNansen } from '@/server/nansen/client';
import { getDb, getKv, setKv } from '@/server/nansen/db';
import { addressKey } from '@/lib/address-family';
import { clusterEvents, windowStats, verdictOf, outcome24h, summarize, WINDOW_MS, type EventResult, type LeaderEvent, type TapeTrade } from '@/lib/models/follow';
import type { NansenCallRef } from '@/lib/provenance';
import type { TGMDexTradesResponse, TokenOHLCVResponse } from '@/types/nansen/api.gen';

export const FOLLOW_MAX_EVENTS = 5;
export const FOLLOW_PAGES = 2;
/** Worst case: two windows × two pages per event, plus one candle read. */
export const FOLLOW_CREDITS = FOLLOW_MAX_EVENTS * 2 * FOLLOW_PAGES + 1;
const TTL = 3_600_000, DAY = 86_400_000, MIN_USD = 250;
const key = (chain: string, token: string) => `follow:v1:${chain}:${addressKey(token)}`;
const iso = (ms: number) => new Date(ms).toISOString();

export interface FollowReport {
  chain: string; token: string; at: number;
  results: Array<EventResult & { labels: string[] }>;
  summary: ReturnType<typeof summarize>;
  calls: NansenCallRef[]; credits: number; notes: string[];
}

/** Smart-money buys of this token from the stored tape: free, local. The
 *  after-window must be complete, so buys in the last 10 minutes wait. */
export function followCandidates(chain: string, token: string, now = Date.now()): { events: LeaderEvent[]; buys: number; labels: Map<string, string> } {
  const rows = getDb().prepare(`SELECT wallet, wallet_label AS label, usd_value AS usd, traded_at AS t FROM smart_money_trades
    WHERE chain = ? AND token_address = ? AND side = 'buy' AND usd_value >= ? AND traded_at >= ? AND traded_at <= ? ORDER BY traded_at`)
    .all(chain, addressKey(token), MIN_USD, now - 7 * DAY, now - WINDOW_MS) as Array<{ wallet: string; label: string | null; usd: number; t: number }>;
  const labels = new Map(rows.filter((r) => r.label).map((r) => [addressKey(r.wallet), r.label!]));
  return { events: clusterEvents(rows, 2 * WINDOW_MS, FOLLOW_MAX_EVENTS), buys: rows.length, labels };
}

export function cachedFollow(chain: string, token: string, now = Date.now()): FollowReport | null {
  const v = getKv(key(chain, token));
  if (!v || now - v.updatedAt > TTL) return null;
  try { return JSON.parse(v.value) as FollowReport; } catch { return null; }
}

async function tape(chain: string, token: string, from: number, to: number, calls: NansenCallRef[], spent: { credits: number }) {
  const trades: TapeTrade[] = [];
  let lastSeen: number | null = null;
  for (let page = 1; page <= FOLLOW_PAGES; page++) {
    const body = { chain, token_address: token, date: { from: iso(from), to: iso(to) }, pagination: { page, per_page: 100 }, order_by: [{ field: 'block_timestamp', direction: 'ASC' }] };
    const r = await callNansen<TGMDexTradesResponse>('tgm/dex-trades', body, { record: false });
    spent.credits += r.meta.cacheHit ? 0 : r.meta.creditsCost;
    calls.push({ endpoint: 'tgm/dex-trades', body, credits: 1, ref: `${r.meta.cacheHit ? 'cache' : 'live'} · page ${page}` });
    for (const x of r.data.data) {
      const t = Date.parse(x.block_timestamp);
      if (Number.isFinite(t) && x.trader_address) trades.push({ t, wallet: x.trader_address, side: x.action === 'BUY' ? 'buy' : 'sell', usd: Number.isFinite(x.estimated_value_usd) ? x.estimated_value_usd : null });
    }
    const pg = (r.data as { pagination?: { is_last_page?: boolean | null } }).pagination;
    if (pg?.is_last_page !== false || !r.data.data.length) { lastSeen = null; break; }
    lastSeen = trades.length ? trades[trades.length - 1].t : from;
  }
  return { trades, lastSeen };
}

/** Runs the study (owner only: callers check the mode). */
export async function runFollow(chain: string, token: string, now = Date.now()): Promise<FollowReport> {
  const { events, labels } = followCandidates(chain, token, now);
  const calls: NansenCallRef[] = [], spent = { credits: 0 }, notes: string[] = [];
  if (!events.length) throw new Error('No smart-money buys of this token (≥ $250) in the stored tape for the last 7 days.');
  const earliest = Math.min(...events.map((e) => e.t));
  const cBody = { chain, token_address: token, timeframe: '1h', date_range: { start: iso(earliest - 2 * 3_600_000), end: iso(now) } };
  const c = await callNansen<TokenOHLCVResponse>('tgm/token-ohlcv', cBody, { record: false });
  spent.credits += c.meta.cacheHit ? 0 : c.meta.creditsCost;
  calls.push({ endpoint: 'tgm/token-ohlcv', body: cBody, credits: 1, ref: c.meta.cacheHit ? 'cache' : 'live' });
  const candles = (c.data.data ?? []).filter((x) => x.close != null && x.close > 0).map((x) => ({ t: Date.parse(x.interval_start), c: x.close! })).filter((x) => Number.isFinite(x.t));
  if (c.data.truncated) notes.push('Nansen truncated the hourly candles; some 24h outcomes may be missing.');

  const results: FollowReport['results'] = [];
  for (const e of events) {
    const leaders = new Set(e.wallets);
    const b = await tape(chain, token, e.t - WINDOW_MS, e.t, calls, spent);
    const a = await tape(chain, token, e.t, e.t + WINDOW_MS, calls, spent);
    const before = windowStats(b.trades, e.t - WINDOW_MS, e.t, leaders, b.lastSeen);
    const after = windowStats(a.trades, e.t, e.t + WINDOW_MS, leaders, a.lastSeen);
    const outcome = outcome24h(candles, e.t, 3_600_000);
    results.push({ event: e, before, after, ...verdictOf(before, after), outcome, outcomePending: !outcome && now < e.t + DAY + 3_600_000, labels: e.wallets.map((w) => labels.get(w)).filter((x): x is string => !!x) });
  }
  if (results.some((r) => r.before.truncated || r.after.truncated)) notes.push(`Busy windows were cut at ${FOLLOW_PAGES * 100} trades; their rates use only the minutes Nansen returned.`);
  const report: FollowReport = { chain, token, at: now, results, summary: summarize(results), calls, credits: spent.credits, notes };
  setKv(key(chain, token), JSON.stringify(report));
  return report;
}
