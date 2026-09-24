// Smart-money follow-through (L4): after smart money bought, did other wallets
// buy faster in the next 10 minutes than in the 10 before, and where was the
// price 24 hours later? Rates are per minute of tape actually covered, so a
// truncated window is measured on what Nansen returned, and says so.
import { closedBy, type CandlePoint } from './replay';

export const WINDOW_MS = 10 * 60_000;
export interface TapeTrade { t: number; wallet: string; side: 'buy' | 'sell'; usd: number | null }
export interface LeaderBuy { t: number; wallet: string; usd: number }
export interface LeaderEvent { t: number; wallets: string[]; usd: number; buys: number }
export interface WindowStats { buyers: number; buyUsd: number; sellUsd: number; coveredMin: number; truncated: boolean; perMin: number | null }
export type Verdict = 'followed' | 'ignored' | 'no change' | 'too little tape';
export interface EventResult { event: LeaderEvent; before: WindowStats; after: WindowStats; ratio: number | null; verdict: Verdict; outcome: { from: number; to: number; ret: number } | null; outcomePending: boolean }

const key = (w: string) => (/^0x[0-9a-f]+$/i.test(w) ? w.toLowerCase() : w);

/** Groups smart-money buys less than `gapMs` apart into one event (first time,
 *  summed USD), and keeps the largest `max` events by USD, newest first. */
export function clusterEvents(buys: LeaderBuy[], gapMs = 2 * WINDOW_MS, max = 5): LeaderEvent[] {
  const sorted = buys.filter((b) => Number.isFinite(b.t) && b.usd > 0).sort((a, b) => a.t - b.t);
  const out: LeaderEvent[] = [];
  for (const b of sorted) {
    const last = out.at(-1);
    if (last && b.t - last.t < gapMs) {
      last.usd += b.usd; last.buys++;
      if (!last.wallets.includes(key(b.wallet))) last.wallets.push(key(b.wallet));
    } else out.push({ t: b.t, wallets: [key(b.wallet)], usd: b.usd, buys: 1 });
  }
  return out.sort((a, b) => b.usd - a.usd).slice(0, max).sort((a, b) => b.t - a.t);
}

/** Buying in [from, to) by wallets other than the leaders. `lastSeen` is the
 *  latest trade Nansen returned when the page limit cut the window short. */
export function windowStats(trades: TapeTrade[], from: number, to: number, leaders: Set<string>, lastSeen: number | null): WindowStats {
  const end = lastSeen != null && lastSeen < to ? lastSeen : to;
  const inside = trades.filter((x) => x.t >= from && x.t < end && !leaders.has(key(x.wallet)));
  const buys = inside.filter((x) => x.side === 'buy');
  const coveredMin = Math.max(0, (end - from) / 60_000);
  const buyers = new Set(buys.map((x) => key(x.wallet))).size;
  return {
    buyers, coveredMin, truncated: end < to,
    buyUsd: buys.reduce((s, x) => s + (x.usd ?? 0), 0),
    sellUsd: inside.filter((x) => x.side === 'sell').reduce((s, x) => s + (x.usd ?? 0), 0),
    perMin: coveredMin >= 1 ? buyers / coveredMin : null,
  };
}

/** Followed: buyers per minute at least 1.5× the 10 minutes before, and 3+
 *  distinct buyers after. Ignored: at most 0.8×. Rates below 1 covered minute
 *  are too little tape to judge. */
export function verdictOf(before: WindowStats, after: WindowStats): { ratio: number | null; verdict: Verdict } {
  if (before.perMin == null || after.perMin == null) return { ratio: null, verdict: 'too little tape' };
  const ratio = (after.perMin + 0.1) / (before.perMin + 0.1);
  return { ratio, verdict: ratio >= 1.5 && after.buyers >= 3 ? 'followed' : ratio <= 0.8 ? 'ignored' : 'no change' };
}

/** Close known at t versus the close that finished at t + 24h; null until
 *  that candle has closed (the outcome is pending, not the last known price). */
export function outcome24h(candles: CandlePoint[], t: number, tfMs: number): { from: number; to: number; ret: number } | null {
  const end = t + 24 * 3_600_000;
  const a = closedBy(candles, t, tfMs).at(-1), b = closedBy(candles, end, tfMs).at(-1);
  // The later close must be the one that finished at the 24h mark, not an older one.
  if (!a || !b || b.t <= a.t || b.t + tfMs <= end - tfMs) return null;
  return { from: a.c, to: b.c, ret: b.c / a.c - 1 };
}

export function summarize(results: EventResult[]) {
  const judged = results.filter((r) => r.verdict !== 'too little tape');
  const med = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const out = (v: Verdict) => results.filter((r) => r.verdict === v && r.outcome).map((r) => r.outcome!.ret);
  return {
    events: results.length, judged: judged.length,
    followed: results.filter((r) => r.verdict === 'followed').length,
    ignored: results.filter((r) => r.verdict === 'ignored').length,
    medianAfterFollowed: med(out('followed')), medianAfterOthers: med([...out('ignored'), ...out('no change')]),
  };
}
