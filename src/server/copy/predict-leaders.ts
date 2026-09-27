// Copy Lab, prediction markets: who wins on Polymarket again and again?
// Nansen has no prediction-market trader leaderboard, so this builds one:
// the biggest winners in the busiest markets (prediction-market/pnl-by-market),
// then each winner's lifetime record (prediction-market/address-summary),
// so a single lucky bet does not rank. About 40 credits; the result is kept
// two hours.
import { traced, errText } from '@/server/nansen/traced';
import { getKv, setKv } from '@/server/nansen/db';
import type { PmMarket } from '@/server/predict/board';
import type { NansenCallRef } from '@/lib/provenance';

type Row = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const rows = (d: unknown): Row[] => (d && typeof d === 'object' && Array.isArray((d as { data?: unknown }).data) ? (d as { data: Row[] }).data : []);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export const PM_MARKETS = 6;
export const PM_TRADERS = 15;
const TTL = 2 * 3_600_000;
const KEY = 'copylab:pm:v1';

export interface PmWin { id: string; question: string; side: string | null; pnlUsd: number; resolved: boolean }
export interface PmLeader {
  address: string;
  totalPnl: number | null; realized: number | null; unrealized: number | null; marketsTraded: number | null; winRate: number | null;
  wins: PmWin[]; score: number; parts: Record<string, number>;
}
export interface PmLeaders { at: number; leaders: PmLeader[]; marketsRead: number; calls: NansenCallRef[]; notes: string[] }

/** Copy score 0 to 100 for a prediction trader: a lifetime record, not one market. */
export function pmScore(r: Pick<PmLeader, 'totalPnl' | 'marketsTraded' | 'winRate' | 'wins'>): { score: number; parts: Record<string, number> } {
  const parts: Record<string, number> = {};
  const pnl = r.totalPnl ?? 0, m = r.marketsTraded ?? 0;
  parts.profit = pnl > 0 ? Math.round(clamp(6 * Math.log10(pnl / 10_000) + 6, 0, 18)) : -15;
  if (r.winRate != null) { const k = m / (m + 15); parts.winRate = Math.round((k * r.winRate + (1 - k) * 0.5 - 0.5) * 50); }
  parts.record = m >= 50 ? 8 : m >= 20 ? 4 : m >= 10 ? 0 : -12;
  // One market carrying the lifetime profit is a lucky bet, not a trader.
  const best = Math.max(0, ...r.wins.map((w) => w.pnlUsd));
  if (pnl > 0 && best > 0) parts.concentration = best / pnl > 0.8 ? -10 : best / pnl > 0.5 ? -4 : 3;
  return { score: Math.round(clamp(50 + Object.values(parts).reduce((a, b) => a + b, 0), 0, 100)), parts };
}

export function cachedPmLeaders(now = Date.now()): PmLeaders | null {
  const v = getKv(KEY);
  if (!v || now - v.updatedAt > TTL) return null;
  try { return JSON.parse(v.value) as PmLeaders; } catch { return null; }
}

/** The busiest markets' winners, rated by their lifetime record. */
export async function pmLeaders(markets: PmMarket[], now = Date.now()): Promise<PmLeaders | { unavailable: string }> {
  const hit = cachedPmLeaders(now);
  if (hit) return hit;
  const calls: NansenCallRef[] = [], notes: string[] = [];
  const busiest = [...markets].sort((a, b) => (b.volume1w ?? b.volume24h ?? 0) - (a.volume1w ?? a.volume24h ?? 0)).slice(0, PM_MARKETS);
  if (!busiest.length) return { unavailable: 'No Polymarket markets were read to find winners in.' };

  const wins = new Map<string, PmWin[]>();
  const reads = await Promise.allSettled(busiest.map(async (m) => {
    const r = await traced<unknown>('prediction-market/pnl-by-market', { market_id: m.id, pagination: { page: 1, per_page: 25 }, order_by: [{ field: 'total_pnl_usd', direction: 'DESC' }] }, 5);
    calls.push(r.call);
    for (const x of rows(r.data)) {
      const address = s(x.address), pnl = n(x.total_pnl_usd);
      if (!address || pnl == null || pnl <= 0) continue;
      const key = address.toLowerCase();
      wins.set(key, [...(wins.get(key) ?? []), { id: m.id, question: m.question, side: s(x.side_held), pnlUsd: pnl, resolved: x.market_resolved === true }]);
    }
  }));
  const failed = reads.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
  if (failed.length === reads.length) return { unavailable: errText(failed[0].reason) };
  if (failed.length) notes.push(`${failed.length} of ${busiest.length} markets could not be read.`);

  // The largest winners across these markets get their lifetime record read.
  const top = [...wins.entries()].map(([address, w]) => ({ address, w, sum: w.reduce((a, b) => a + b.pnlUsd, 0) }))
    .sort((a, b) => b.sum - a.sum).slice(0, PM_TRADERS);
  const leaders = await Promise.all(top.map(async ({ address, w }) => {
    let row: Row | null = null;
    try {
      const r = await traced<unknown>('prediction-market/address-summary', { address }, 1);
      calls.push(r.call);
      row = rows(r.data)[0] ?? null;
    } catch { /* the record stays unknown and the score says so */ }
    const realized = n(row?.realized_pnl_usd), unrealized = n(row?.unrealized_pnl_usd);
    const base = {
      address, wins: w.sort((a, b) => b.pnlUsd - a.pnlUsd),
      totalPnl: n(row?.total_pnl_usd) ?? (realized != null || unrealized != null ? (realized ?? 0) + (unrealized ?? 0) : null),
      realized, unrealized, marketsTraded: n(row?.markets_traded), winRate: n(row?.win_rate),
    };
    const sc = pmScore(base);
    return { ...base, score: sc.score, parts: sc.parts };
  }));
  leaders.sort((a, b) => b.score - a.score || (b.totalPnl ?? 0) - (a.totalPnl ?? 0));
  const out: PmLeaders = { at: now, leaders, marketsRead: busiest.length - failed.length, calls, notes };
  setKv(KEY, JSON.stringify(out));
  return out;
}
