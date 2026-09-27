// Copy Lab, cohorts: what every wallet group Nansen tracks is buying. Nansen
// has no leaderboard for KOLs (its "Public Figure" label), whales or its Top
// PnL cohort, but tgm/flow-intelligence splits each token's net flow by those
// groups. This reads it for today's busiest tokens (from the scanner's stored
// token pulse, no extra calls to pick them) and ranks, per cohort, where the
// money is going. One credit per token; kept 30 minutes.
import { traced, errText } from '@/server/nansen/traced';
import { getDb, getKv, setKv } from '@/server/nansen/db';
import { endpointUnavailable } from '@/lib/registry';
import type { NansenCallRef } from '@/lib/provenance';

export const COHORTS = ['public_figure', 'top_pnl', 'smart_trader', 'whale', 'fresh_wallets'] as const;
export type Cohort = (typeof COHORTS)[number];
export const COHORT_LABEL: Record<Cohort, string> = {
  public_figure: 'KOLs and public figures', top_pnl: 'Top PnL traders', smart_trader: 'Smart Traders', whale: 'Whales', fresh_wallets: 'Fresh wallets',
};
export const COHORT_NOTE: Record<Cohort, string> = {
  public_figure: 'Nansen "Public Figure" wallets: KOLs, founders, influencers',
  top_pnl: 'The most profitable traders of each token',
  smart_trader: 'Nansen Smart Trader labels (30, 90, 180 days)',
  whale: 'The largest holders',
  fresh_wallets: 'New wallets: often insiders or bots, a warning as much as a signal',
};
export const COHORT_TOKENS = 14;
const TTL = 30 * 60_000;
const KEY = 'copylab:cohorts:v1';

export interface CohortCell { netUsd: number; wallets: number | null }
export interface CohortToken { chain: string; token: string; symbol: string | null; volume: number | null; cells: Partial<Record<Cohort, CohortCell>> }
export interface Cohorts { at: number; tokens: CohortToken[]; calls: NansenCallRef[]; notes: string[] }

/** Today's busiest non-stable tokens from the stored token pulse. */
export function pulseTokens(limit = COHORT_TOKENS, now = Date.now()): Array<{ chain: string; token: string; symbol: string | null; volume: number | null }> {
  const db = getDb();
  const last = (db.prepare(`SELECT MAX(snapshot_at) t FROM token_pulse WHERE window = '24h' AND snapshot_at >= ?`).get(now - 2 * 86_400_000) as { t: number | null }).t;
  if (!last) return [];
  return db.prepare(`SELECT chain, token_address AS token, MAX(symbol) AS symbol, MAX(volume) AS volume FROM token_pulse
    WHERE window = '24h' AND snapshot_at = ? GROUP BY chain, token_address ORDER BY volume DESC LIMIT ?`)
    .all(last, limit * 2) as Array<{ chain: string; token: string; symbol: string | null; volume: number | null }>;
}

const MAJORS = /^(w?eth|w?btc|cbbtc|w?sol|w?bnb|w?avax|w?matic|pol|w?hype|steth|wsteth)$/i;

export function cachedCohorts(now = Date.now()): Cohorts | null {
  const v = getKv(KEY);
  if (!v || now - v.updatedAt > TTL) return null;
  try { return JSON.parse(v.value) as Cohorts; } catch { return null; }
}

export async function cohortFlows(extra: Array<{ chain: string; token: string; symbol: string | null }> = [], now = Date.now()): Promise<Cohorts | { unavailable: string }> {
  const hit = cachedCohorts(now);
  if (hit) return hit;
  const seen = new Set<string>();
  const pick = [...extra.map((x) => ({ ...x, volume: null as number | null })), ...pulseTokens()]
    .filter((x) => !MAJORS.test(x.symbol ?? '') && !endpointUnavailable('tgmFlowIntelligence', x.chain, 'Cohort flows'))
    .filter((x) => { const k = `${x.chain}|${x.token}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, COHORT_TOKENS);
  if (!pick.length) return { unavailable: 'No busy tokens stored yet: the scanner fills the token pulse as it runs.' };

  const calls: NansenCallRef[] = [], notes: string[] = [];
  const reads = await Promise.allSettled(pick.map(async (t) => {
    const r = await traced<{ data?: Array<Record<string, number | null>> }>('tgm/flow-intelligence', { chain: t.chain, token_address: t.token, timeframe: '1d' }, 1);
    calls.push(r.call);
    const row = r.data.data?.[0] ?? {};
    const cells: CohortToken['cells'] = {};
    for (const c of COHORTS) {
      const v = row[`${c}_net_flow_usd`];
      if (v != null && Number.isFinite(v)) cells[c] = { netUsd: v, wallets: row[`${c}_wallet_count`] ?? null };
    }
    return { ...t, cells };
  }));
  const tokens = reads.filter((x): x is PromiseFulfilledResult<CohortToken> => x.status === 'fulfilled').map((x) => x.value);
  const failed = reads.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
  if (!tokens.length) return { unavailable: errText(failed[0]?.reason ?? new Error('No cohort flows were returned.')) };
  if (failed.length) notes.push(`${failed.length} of ${pick.length} tokens could not be read.`);
  const out: Cohorts = { at: now, tokens, calls, notes };
  setKv(KEY, JSON.stringify(out));
  return out;
}

/** Per cohort: the tokens it bought most (net inflow) and sold most, last 24 hours. */
export function cohortBoards(c: Cohorts, top = 5): Record<Cohort, { buying: Array<CohortToken & { cell: CohortCell }>; selling: Array<CohortToken & { cell: CohortCell }> }> {
  return Object.fromEntries(COHORTS.map((k) => {
    const rows = c.tokens.filter((t) => t.cells[k]).map((t) => ({ ...t, cell: t.cells[k]! }));
    return [k, {
      buying: rows.filter((r) => r.cell.netUsd > 0).sort((a, b) => b.cell.netUsd - a.cell.netUsd).slice(0, top),
      selling: rows.filter((r) => r.cell.netUsd < 0).sort((a, b) => a.cell.netUsd - b.cell.netUsd).slice(0, top),
    }];
  })) as ReturnType<typeof cohortBoards>;
}
