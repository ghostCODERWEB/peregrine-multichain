// The Perps Intelligence Terminal's data: observed positions for one coin
// across Nansen's cohorts, recent trades, and stored snapshots for What
// Changed. Aggregation lives in src/lib/perps (pure, tested); this module
// only fetches, merges, stores and compares.
//
// Credits per terminal load (all cached per endpoint TTL, 5 min for positions):
//   tgm/perp-positions  all_traders                 5
//   + owner view: smart_money, whale, public_figure 15
//   tgm/perp-trades     24h, largest 200             1
//   + owner view: smart-money/perp-trades 24h        1
import { traced, errText } from '@/server/nansen/traced';
import { callScope, type CallTally } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import { requestDay } from '@/server/nansen/demo';
import type { NansenCallRef } from '@/lib/provenance';
import { COHORTS, markOf, mergeCohorts, normalizeRow, type Cohort, type Position, type RawPositionRow } from '@/lib/perps/positions';
import { convictionShift, diffSnapshots, observedEdge, type PositionChange, type ShiftSummary } from '@/lib/perps/changes';

export const PAGE = 1000;
const KEEP_MS = 8 * 86_400_000;

export interface PerpTrade {
  at: string;
  address: string;
  label: string | null;
  side: string | null;
  action: string | null;
  amount: number | null;
  priceUsd: number | null;
  valueUsd: number | null;
  type: string | null;
  tx: string | null;
  smartMoney: boolean;
}

export interface TerminalData {
  symbol: string;
  at: number;
  mark: number | null;
  positions: Position[];
  /** Which cohort pages were read; public views read all traders only. */
  cohorts: Cohort[];
  observedEdgeUsd: number;
  trades: PerpTrade[] | { unavailable: string };
  smTrades: PerpTrade[] | { unavailable: string } | null;
  snapshots: number[];
  calls: NansenCallRef[];
  tally: CallTally;
  errors: string[];
}

const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function toTrade(r: Record<string, unknown>, smartMoney: boolean): PerpTrade {
  return {
    at: s(r.block_timestamp) ?? '', address: s(r.trader_address) ?? '', label: s(r.trader_address_label),
    side: s(r.side), action: s(r.action), amount: n(r.token_amount), priceUsd: n(r.price_usd), valueUsd: n(r.value_usd),
    type: s(r.type), tx: s(r.transaction_hash), smartMoney,
  };
}

async function positionsPage(symbol: string, label: 'all_traders' | Cohort) {
  const body = { token_symbol: symbol, label_type: label, pagination: { page: 1, per_page: PAGE }, order_by: [{ field: 'position_value_usd', direction: 'DESC' }] };
  const r = await traced<{ data: RawPositionRow[] }>('tgm/perp-positions', body, 5, label === 'all_traders' ? { publicSafe: true } : {});
  return { rows: (r.data.data ?? []).map(normalizeRow).filter((p): p is Position => !!p), call: r.call };
}

function storeSnapshot(symbol: string, at: number, cohorts: Cohort[], mark: number | null, positions: Position[]) {
  const db = getDb();
  // One snapshot per 4 minutes at most: cached reloads are not new observations.
  const last = db.prepare('SELECT at FROM perp_position_snapshots WHERE symbol = ? ORDER BY at DESC LIMIT 1').get(symbol) as { at: number } | undefined;
  if (last && at - last.at < 4 * 60_000) return;
  const compact = positions.map((p) => [p.address, p.label, p.side === 'long' ? 1 : 0, p.valueUsd, p.size, p.leverage, p.entry, p.liq, p.upnlUsd, p.cohorts.join(',')]);
  db.prepare('INSERT INTO perp_position_snapshots (symbol, at, cohorts, mark, positions) VALUES (?, ?, ?, ?, ?)').run(symbol, at, cohorts.join(','), mark, JSON.stringify(compact));
  db.prepare('DELETE FROM perp_position_snapshots WHERE at < ?').run(at - KEEP_MS);
}

function readSnapshot(row: { at: number; cohorts: string; mark: number | null; positions: string }) {
  const positions: Position[] = (JSON.parse(row.positions) as Array<[string, string | null, number, number, number | null, number | null, number | null, number | null, number | null, string]>).map(
    ([address, label, long, valueUsd, size, leverage, entry, liq, upnlUsd, cohorts]) => ({
      address, label, side: long ? 'long' : 'short', valueUsd, size, leverage, leverageType: null, entry, mark: row.mark, liq,
      fundingUsd: null, upnlUsd, cohorts: cohorts ? (cohorts.split(',') as Cohort[]) : [],
    }),
  );
  return { at: row.at, cohorts: row.cohorts ? (row.cohorts.split(',') as Cohort[]) : [], mark: row.mark, positions };
}

export function snapshotTimes(symbol: string): number[] {
  return (getDb().prepare('SELECT at FROM perp_position_snapshots WHERE symbol = ? ORDER BY at').all(symbol) as Array<{ at: number }>).map((r) => r.at);
}

/** Observed positions for one coin. `priv` adds the cohort pages (owner view). */
export async function perpTerminal(symbol: string, priv: boolean): Promise<TerminalData> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const errors: string[] = [];
    const cohorts = priv ? COHORTS : [];
    const tradeBody = { token_symbol: symbol, date: { from: requestDay(1), to: requestDay(0) }, pagination: { page: 1, per_page: 200 }, order_by: [{ field: 'value_usd', direction: 'DESC' }] };
    const [all, byCohort, trades, smTrades] = await Promise.all([
      positionsPage(symbol, 'all_traders'),
      Promise.all(cohorts.map((c) => positionsPage(symbol, c).then((r) => [c, r] as const).catch((e) => { errors.push(`${c}: ${errText(e)}`); return null; }))),
      traced<{ data: Array<Record<string, unknown>> }>('tgm/perp-trades', tradeBody, 1)
        .then((r) => (r.data.data ?? []).map((t) => toTrade(t, false)))
        .catch((e) => ({ unavailable: errText(e) })),
      priv
        ? traced<{ data: Array<Record<string, unknown>> }>('smart-money/perp-trades', { filters: { token_symbol: symbol }, lookback_hours: 24, pagination: { page: 1, per_page: 200 }, order_by: [{ field: 'value_usd', direction: 'DESC' }] }, 1)
            .then((r) => (r.data.data ?? []).map((t) => toTrade(t, true)))
            .catch((e) => ({ unavailable: errText(e) }))
        : Promise.resolve(null),
    ]);
    const pages = Object.fromEntries(byCohort.filter((x) => !!x).map(([c, r]) => [c, r.rows])) as Partial<Record<Cohort, Position[]>>;
    const positions = mergeCohorts(all.rows, pages);
    const mark = markOf(positions);
    const at = Date.now();
    const read = byCohort.filter((x) => !!x).map(([c]) => c);
    if (positions.length) storeSnapshot(symbol, at, read, mark, positions);
    return {
      symbol, at, mark, positions, cohorts: read,
      observedEdgeUsd: observedEdge(all.rows),
      trades, smTrades,
      snapshots: snapshotTimes(symbol),
      calls: [all.call, ...byCohort.flatMap((x) => (x ? [x[1].call] : []))],
      tally, errors,
    };
  });
}

export interface ChangesData {
  symbol: string;
  from: number;
  to: number;
  requestedMs: number;
  changes: PositionChange[];
  shift: Record<'all' | Cohort, ShiftSummary>;
  /** Cohort pages both snapshots contain; a shift is only reported for those. */
  cohorts: Cohort[];
}

/** Compare the latest stored snapshot with the one closest to `windowMs` before it. */
export function perpChanges(symbol: string, windowMs: number): ChangesData | { unavailable: string } {
  const db = getDb();
  const latest = db.prepare('SELECT at, cohorts, mark, positions FROM perp_position_snapshots WHERE symbol = ? ORDER BY at DESC LIMIT 1').get(symbol) as Parameters<typeof readSnapshot>[0] | undefined;
  if (!latest) return { unavailable: `No stored ${symbol} snapshot yet. Each terminal load and scheduled scan stores one.` };
  const target = latest.at - windowMs;
  const prev = db.prepare(`
    SELECT at, cohorts, mark, positions FROM perp_position_snapshots
    WHERE symbol = ? AND at <= ? ORDER BY ABS(at - ?) LIMIT 1
  `).get(symbol, latest.at - Math.min(windowMs * 0.5, windowMs - 60_000), target) as Parameters<typeof readSnapshot>[0] | undefined;
  if (!prev) {
    const first = db.prepare('SELECT MIN(at) AS t FROM perp_position_snapshots WHERE symbol = ?').get(symbol) as { t: number };
    return { unavailable: `History for ${symbol} starts ${new Date(first.t).toISOString().slice(0, 16).replace('T', ' ')} UTC; this window needs an older snapshot.` };
  }
  const a = readSnapshot(prev), b = readSnapshot(latest);
  const cohorts = b.cohorts.filter((c) => a.cohorts.includes(c));
  const changes = diffSnapshots(a.positions, b.positions, Math.max(observedEdge(a.positions), observedEdge(b.positions)));
  const shift = { all: convictionShift(changes, 'all') } as ChangesData['shift'];
  for (const c of cohorts) shift[c] = convictionShift(changes, c);
  return { symbol, from: a.at, to: b.at, requestedMs: windowMs, changes, shift, cohorts };
}

/** Scheduled snapshots for the coins that matter most, so What Changed has
 *  history before anyone opens the terminal. PERP_SNAPSHOT_COINS, default
 *  BTC,ETH; set it empty to turn this off. Cost: 5 credits per coin for all
 *  traders + 5 for Smart Money, per scan. */
export async function snapshotScheduledCoins(log: (s: string) => void) {
  const coins = (process.env.PERP_SNAPSHOT_COINS ?? 'BTC,ETH').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
  for (const symbol of coins) {
    try {
      const [all, sm] = await Promise.all([positionsPage(symbol, 'all_traders'), positionsPage(symbol, 'smart_money')]);
      const positions = mergeCohorts(all.rows, { smart_money: sm.rows });
      storeSnapshot(symbol, Date.now(), ['smart_money'], markOf(positions), positions);
      log(`perp snapshot ${symbol}: ${positions.length} positions`);
    } catch (e) {
      log(`  ! perp snapshot ${symbol}: ${errText(e)}`);
    }
  }
}
