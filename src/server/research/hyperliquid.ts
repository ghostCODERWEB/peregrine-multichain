// Research data layer for Hyperliquid traders. Current positions come from
// Nansen (profiler/perp-positions, with labels and margin); account history,
// the full fill log and market candles come from Hyperliquid's public info API
// (keyless). Fills are classified into position events (open, add, reduce,
// close, flip), closed positions are reconstructed from them, and trader
// analytics are derived from those reconstructed positions only.
import { traced, errText } from '@/server/nansen/traced';
import { callScope, type CallTally } from '@/server/nansen/client';
import { requestDay } from '@/server/nansen/demo';
import { seenInSnapshots, type SeenIn } from '@/server/perps/trader';

const HL = 'https://api.hyperliquid.xyz/info';
const n = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// ---------------------------------------------------------------- fetching

const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

/** One Hyperliquid info request, cached per body for `ttl` ms and deduplicated while in flight. */
export async function hlInfo<T>(body: Record<string, unknown>, ttl: number): Promise<T> {
  const key = JSON.stringify(body);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const job = (async () => {
    const r = await fetch(HL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: key, signal: AbortSignal.timeout(12_000) });
    if (!r.ok) throw new Error(`Hyperliquid ${r.status}`);
    const value = (await r.json()) as T;
    cache.set(key, { at: Date.now(), value });
    if (cache.size > 500) cache.delete(cache.keys().next().value!);
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

/** 30 days of fills, partial fills of one order merged (aggregateByTime), paged forward up to 10,000. */
export async function hlFills30d(user: string, now = Date.now()): Promise<HlFill[]> {
  const out: HlFill[] = [];
  let start = now - 30 * 864e5;
  for (let page = 0; page < 5; page++) {
    const batch = await hlInfo<HlFill[]>({ type: 'userFillsByTime', user, startTime: Math.floor(start), aggregateByTime: true }, 60_000);
    out.push(...batch);
    if (batch.length < 2000) break;
    start = batch[batch.length - 1].time + 1;
  }
  return out;
}

export const hlMids = () => hlInfo<Record<string, string>>({ type: 'allMids' }, 15_000);

export interface HlCandle { t: number; o: number; h: number; l: number; c: number; v: number }
export async function hlCandles(coin: string, start: number, end: number): Promise<{ interval: string; candles: HlCandle[] }> {
  const span = end - start;
  // Keep the chart near 300 to 500 candles whatever the period.
  const interval = span <= 12 * 3.6e6 ? '5m' : span <= 2 * 864e5 ? '15m' : span <= 6 * 864e5 ? '1h' : span <= 30 * 864e5 ? '4h' : '1d';
  const raw = await hlInfo<Array<{ t: number; o: string; h: string; l: string; c: string; v: string }>>({ type: 'candleSnapshot', req: { coin, interval, startTime: Math.floor(start), endTime: Math.floor(end) } }, 60_000);
  return { interval, candles: raw.map((k) => ({ t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v })) };
}

// ---------------------------------------------------------------- models

export interface Position {
  coin: string; side: 'long' | 'short'; size: number; valueUsd: number | null; entry: number | null; mark: number | null; liq: number | null;
  leverage: number | null; leverageType: string | null; marginUsd: number | null; upnlUsd: number | null; roe: number | null;
  fundingSinceOpenUsd: number | null; distanceToLiq: number | null; openedAt: number | null;
}
export type EventKind = 'open' | 'add' | 'reduce' | 'close' | 'flip';
export interface PositionEvent { t: number; coin: string; kind: EventKind; side: 'long' | 'short'; price: number; size: number; sizeAfter: number; notional: number; closedPnl: number; fee: number; hash: string }
export interface ClosedPosition { coin: string; side: 'long' | 'short'; openedAt: number; closedAt: number; avgEntry: number; avgExit: number; maxSize: number; maxNotional: number; realizedPnl: number; fees: number; roi: number | null; fills: number }
export interface Series { t: number; v: number }

export interface TraderWorkspace {
  address: string;
  label: string | null;
  seenIn: SeenIn[];
  account: { valueUsd: number | null; marginUsedUsd: number | null; withdrawableUsd: number | null } | null;
  positions: Position[] | { unavailable: string };
  exposure: { longUsd: number; shortUsd: number; netUsd: number; grossUsd: number; marginUsage: number | null; upnlUsd: number };
  history: Record<'day' | 'week' | 'month' | 'allTime', { value: Series[]; pnl: Series[]; volume: number | null }> | { unavailable: string };
  events: PositionEvent[];
  closed: ClosedPosition[];
  stats: {
    fills: number; firstFill: number | null; closedTrades: number; winRate: number | null; avgWin: number | null; avgLoss: number | null;
    largestWin: number | null; largestLoss: number | null; profitFactor: number | null; avgHoldHours: number | null; realizedPnl: number; fees: number; volumeUsd: number;
  } | null;
  byAsset: Array<{ coin: string; trades: number; pnl: number; volume: number; winRate: number | null; roi: number | null }>;
  bySide: { long: { trades: number; pnl: number }; short: { trades: number; pnl: number } };
  daily: Array<{ day: string; pnl: number; volume: number; fills: number }>;
  hourly: number[];
  nansen30d: { realizedPnl: number | null; winRate: number | null; trades: number | null } | null;
  errors: string[];
  tally: CallTally;
  at: number;
}

interface HlFill { coin: string; px: string; sz: string; side: 'A' | 'B'; time: number; startPosition: string; dir: string; closedPnl: string; hash: string; fee: string }

/** Classifies each fill by the position before and after it. Fills are oldest first. */
export function classify(fills: HlFill[]): PositionEvent[] {
  return fills.filter((f) => !f.coin.startsWith('@') && !f.dir.includes('Spot')).map((f) => {
    const before = Number(f.startPosition), signed = (f.side === 'B' ? 1 : -1) * Number(f.sz), after = before + signed;
    const kind: EventKind = before === 0 ? 'open' : Math.abs(after) < 1e-12 ? 'close' : Math.sign(after) !== Math.sign(before) ? 'flip' : Math.abs(after) > Math.abs(before) ? 'add' : 'reduce';
    const ref = kind === 'open' || kind === 'add' || kind === 'flip' ? after : before;
    return { t: f.time, coin: f.coin, kind, side: ref >= 0 ? 'long' : 'short', price: Number(f.px), size: Number(f.sz), sizeAfter: after, notional: Number(f.px) * Number(f.sz), closedPnl: Number(f.closedPnl), fee: Number(f.fee), hash: f.hash };
  });
}

/** Rebuilds complete positions (flat to flat) from classified events. */
export function reconstruct(events: PositionEvent[]): ClosedPosition[] {
  const open = new Map<string, { side: 'long' | 'short'; openedAt: number; entryQty: number; entryCost: number; exitQty: number; exitValue: number; max: number; maxNotional: number; pnl: number; fees: number; fills: number }>();
  const out: ClosedPosition[] = [];
  const finish = (coin: string, t: number) => {
    const p = open.get(coin)!;
    const avgEntry = p.entryQty ? p.entryCost / p.entryQty : 0;
    out.push({ coin, side: p.side, openedAt: p.openedAt, closedAt: t, avgEntry, avgExit: p.exitQty ? p.exitValue / p.exitQty : 0, maxSize: p.max, maxNotional: p.maxNotional, realizedPnl: p.pnl, fees: p.fees, roi: p.maxNotional ? p.pnl / p.maxNotional : null, fills: p.fills });
    open.delete(coin);
  };
  for (const e of events) {
    let p = open.get(e.coin);
    if (e.kind === 'open' || (!p && e.kind !== 'reduce' && e.kind !== 'close')) {
      p = { side: e.side, openedAt: e.t, entryQty: 0, entryCost: 0, exitQty: 0, exitValue: 0, max: 0, maxNotional: 0, pnl: 0, fees: 0, fills: 0 };
      open.set(e.coin, p);
    }
    if (!p) continue; // a reduce or close for a position opened before the fill history starts
    p.fills++; p.fees += e.fee; p.pnl += e.closedPnl;
    if (e.kind === 'open' || e.kind === 'add') { p.entryQty += e.size; p.entryCost += e.size * e.price; }
    else { p.exitQty += e.size; p.exitValue += e.size * e.price; }
    p.max = Math.max(p.max, Math.abs(e.sizeAfter));
    p.maxNotional = Math.max(p.maxNotional, Math.abs(e.sizeAfter) * e.price);
    if (e.kind === 'close') finish(e.coin, e.t);
    else if (e.kind === 'flip') {
      finish(e.coin, e.t);
      open.set(e.coin, { side: e.side, openedAt: e.t, entryQty: Math.abs(e.sizeAfter), entryCost: Math.abs(e.sizeAfter) * e.price, exitQty: 0, exitValue: 0, max: Math.abs(e.sizeAfter), maxNotional: Math.abs(e.sizeAfter) * e.price, pnl: 0, fees: 0, fills: 0 });
    }
  }
  return out.sort((a, b) => b.closedAt - a.closedAt);
}

type PortfolioResp = Array<[string, { accountValueHistory: Array<[number, string]>; pnlHistory: Array<[number, string]>; vlm: string }]>;

export async function traderWorkspace(address: string): Promise<TraderWorkspace> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const errors: string[] = [];
    const date = { from: requestDay(30), to: requestDay(0) };
    // Independent sources in parallel; each can fail alone.
    const [pos, sum, port, fills, mids] = await Promise.allSettled([
      traced<unknown>('profiler/perp-positions', { address }, 1),
      traced<unknown>('profiler/perp-pnl-summary', { address, date }, 1),
      hlInfo<PortfolioResp>({ type: 'portfolio', user: address.toLowerCase() }, 120_000),
      hlFills30d(address.toLowerCase()),
      hlMids(),
    ]);
    const seenIn = seenInSnapshots(address);
    const label = seenIn.find((s) => s.label)?.label?.replace(/\s*\[[^\]]*\]$/, '') ?? null;
    const mid = mids.status === 'fulfilled' ? mids.value : {};
    const events = fills.status === 'fulfilled' ? classify([...fills.value].sort((a, b) => a.time - b.time)) : [];
    if (fills.status === 'rejected') errors.push(`Fills: ${errText(fills.reason)}`);

    let account: TraderWorkspace['account'] = null;
    let positions: TraderWorkspace['positions'] = { unavailable: 'Positions unavailable.' };
    if (pos.status === 'fulfilled') {
      const d = (pos.value.data as { data: Record<string, unknown> }).data ?? {};
      // Nansen returns asset_positions (older responses used assetPositions).
      const list = ((d.asset_positions ?? d.assetPositions) as Array<{ position?: Record<string, unknown> | null }> | undefined) ?? [];
      account = { valueUsd: n(d.margin_summary_account_value_usd), marginUsedUsd: n(d.margin_summary_total_margin_used_usd), withdrawableUsd: n(d.withdrawable) };
      positions = list.flatMap((a) => {
        const p = a.position;
        if (!p) return [];
        const coin = String(p.token_symbol ?? '');
        const size = n(p.size) ?? 0, liq = n(p.liquidation_price_usd), mark = n(mid[coin]);
        const side = size < 0 ? 'short' as const : 'long' as const;
        // When the current position was opened: the latest 'open' or 'flip' event for the coin.
        const opened = [...events].reverse().find((e) => e.coin === coin && (e.kind === 'open' || e.kind === 'flip'));
        return [{
          coin, side, size: Math.abs(size), valueUsd: n(p.position_value_usd), entry: n(p.entry_price_usd), mark, liq,
          leverage: n(p.leverage_value), leverageType: typeof p.leverage_type === 'string' ? p.leverage_type : null, marginUsd: n(p.margin_used_usd),
          upnlUsd: n(p.unrealized_pnl_usd), roe: n(p.return_on_equity), fundingSinceOpenUsd: n(p.cumulative_funding_since_open_usd),
          distanceToLiq: liq && mark ? (side === 'long' ? (mark - liq) / mark : (liq - mark) / mark) : null, openedAt: opened?.t ?? null,
        }];
      }).sort((x, y) => (y.valueUsd ?? 0) - (x.valueUsd ?? 0));
    } else { positions = { unavailable: errText(pos.reason) }; errors.push(`Positions: ${errText(pos.reason)}`); }

    const P = Array.isArray(positions) ? positions : [];
    const longUsd = P.filter((p) => p.side === 'long').reduce((a, p) => a + (p.valueUsd ?? 0), 0), shortUsd = P.filter((p) => p.side === 'short').reduce((a, p) => a + (p.valueUsd ?? 0), 0);
    const exposure = { longUsd, shortUsd, netUsd: longUsd - shortUsd, grossUsd: longUsd + shortUsd, marginUsage: account?.valueUsd && account.marginUsedUsd != null ? account.marginUsedUsd / account.valueUsd : null, upnlUsd: P.reduce((a, p) => a + (p.upnlUsd ?? 0), 0) };

    let history: TraderWorkspace['history'] = { unavailable: 'No Hyperliquid account history.' };
    if (port.status === 'fulfilled' && Array.isArray(port.value)) {
      const pick = (k: string) => { const x = port.value.find((e) => e[0] === k)?.[1]; return { value: (x?.accountValueHistory ?? []).map(([t, v]) => ({ t, v: +v })), pnl: (x?.pnlHistory ?? []).map(([t, v]) => ({ t, v: +v })), volume: n(x?.vlm) }; };
      history = { day: pick('day'), week: pick('week'), month: pick('month'), allTime: pick('allTime') };
    } else if (port.status === 'rejected') errors.push(`History: ${errText(port.reason)}`);

    const closed = reconstruct(events);
    const wins = closed.filter((c) => c.realizedPnl > 0), losses = closed.filter((c) => c.realizedPnl < 0);
    const gw = wins.reduce((a, c) => a + c.realizedPnl, 0), gl = -losses.reduce((a, c) => a + c.realizedPnl, 0);
    const stats = events.length ? {
      fills: events.length, firstFill: events[0]?.t ?? null, closedTrades: closed.length,
      winRate: closed.length ? wins.length / closed.length : null, avgWin: wins.length ? gw / wins.length : null, avgLoss: losses.length ? -gl / losses.length : null,
      largestWin: wins.length ? Math.max(...wins.map((c) => c.realizedPnl)) : null, largestLoss: losses.length ? Math.min(...losses.map((c) => c.realizedPnl)) : null,
      profitFactor: gl > 0 ? gw / gl : null, avgHoldHours: closed.length ? closed.reduce((a, c) => a + (c.closedAt - c.openedAt), 0) / closed.length / 3.6e6 : null,
      realizedPnl: events.reduce((a, e) => a + e.closedPnl, 0), fees: events.reduce((a, e) => a + e.fee, 0), volumeUsd: events.reduce((a, e) => a + e.notional, 0),
    } : null;
    const assets = new Map<string, { trades: number; pnl: number; volume: number; wins: number; notional: number }>();
    for (const c of closed) { const a = assets.get(c.coin) ?? { trades: 0, pnl: 0, volume: 0, wins: 0, notional: 0 }; a.trades++; a.pnl += c.realizedPnl; a.wins += c.realizedPnl > 0 ? 1 : 0; a.notional += c.maxNotional; assets.set(c.coin, a); }
    for (const e of events) { const a = assets.get(e.coin); if (a) a.volume += e.notional; }
    const byAsset = [...assets].map(([coin, a]) => ({ coin, trades: a.trades, pnl: a.pnl, volume: a.volume, winRate: a.trades ? a.wins / a.trades : null, roi: a.notional ? a.pnl / a.notional : null })).sort((x, y) => Math.abs(y.pnl) - Math.abs(x.pnl));
    const side = (s: 'long' | 'short') => ({ trades: closed.filter((c) => c.side === s).length, pnl: closed.filter((c) => c.side === s).reduce((a, c) => a + c.realizedPnl, 0) });
    const days = new Map<string, { pnl: number; volume: number; fills: number }>();
    const hourly = Array.from({ length: 24 }, () => 0);
    for (const e of events) { const k = new Date(e.t).toISOString().slice(0, 10); const d = days.get(k) ?? { pnl: 0, volume: 0, fills: 0 }; d.pnl += e.closedPnl - e.fee; d.volume += e.notional; d.fills++; days.set(k, d); hourly[new Date(e.t).getUTCHours()]++; }

    let nansen30d: TraderWorkspace['nansen30d'] = null;
    if (sum.status === 'fulfilled') { const d = (sum.value.data as { data: Record<string, unknown> }).data ?? {}; nansen30d = { realizedPnl: n(d.realized_pnl_usd), winRate: n(d.win_rate), trades: n(d.closed_trade_count) }; }
    return {
      address, label, seenIn, account, positions, exposure, history, events: events.slice(-4000), closed, stats, byAsset,
      bySide: { long: side('long'), short: side('short') }, daily: [...days].map(([day, d]) => ({ day, ...d })).sort((a, b) => a.day.localeCompare(b.day)), hourly,
      nansen30d, errors, tally, at: Date.now(),
    };
  });
}
