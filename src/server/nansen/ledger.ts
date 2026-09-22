// Credit ledger: every real (non-cached) Nansen call is recorded here from
// the X-Nansen-Credits-Cost response header, so /coverage can show the
// running total the buildathon submission needs (>= 1,000 calls) without
// trusting Nansen's own dashboard to be checked live.
import { getDb } from './db';

export function recordCall(endpoint: string, credits: number, cacheHit: boolean): void {
  getDb()
    .prepare('INSERT INTO credit_ledger (endpoint, credits, cache_hit, called_at) VALUES (?, ?, ?, ?)')
    .run(endpoint, credits, cacheHit ? 1 : 0, Date.now());
}

export interface LedgerSummary {
  totalCalls: number;
  realCalls: number;
  cacheHits: number;
  totalCredits: number;
  byEndpoint: Array<{ endpoint: string; calls: number; credits: number }>;
}

export function ledgerSummary(): LedgerSummary {
  const db = getDb();
  const totals = db
    .prepare(`
      SELECT
        COUNT(*) AS total_calls,
        SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) AS real_calls,
        SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) AS cache_hits,
        SUM(credits) AS total_credits
      FROM credit_ledger
    `)
    .get() as { total_calls: number; real_calls: number; cache_hits: number; total_credits: number | null };

  const byEndpoint = db
    .prepare(`
      SELECT endpoint, COUNT(*) AS calls, SUM(credits) AS credits
      FROM credit_ledger
      GROUP BY endpoint
      ORDER BY credits DESC
    `)
    .all() as Array<{ endpoint: string; calls: number; credits: number }>;

  return {
    totalCalls: totals.total_calls ?? 0,
    realCalls: totals.real_calls ?? 0,
    cacheHits: totals.cache_hits ?? 0,
    totalCredits: totals.total_credits ?? 0,
    byEndpoint,
  };
}

/** Credits spent by one prefix (e.g. "agent/" for the anchor's hourly cap)
 *  within the trailing window. */
export function creditsSince(endpointPrefix: string, sinceMs: number): number {
  const row = getDb()
    .prepare('SELECT SUM(credits) AS credits FROM credit_ledger WHERE endpoint LIKE ? AND called_at >= ?')
    .get(`${endpointPrefix}%`, sinceMs) as { credits: number | null };
  return row.credits ?? 0;
}

/** Calls to one exact endpoint within the trailing window — used for the
 *  anchor's "N calls per hour" cap, which counts calls, not credits. */
export function callsSince(endpoint: string, sinceMs: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS n FROM credit_ledger WHERE endpoint = ? AND called_at >= ? AND cache_hit = 0')
    .get(endpoint, sinceMs) as { n: number };
  return row.n;
}
