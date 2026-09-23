// The operator's half of /coverage: how much of the Nansen API the code
// uses (endpoint ledger), who is calling what (per user, per endpoint, per
// day), what is failing (error rates), where live responses drift from the
// contract, whether the worker's jobs are healthy, and x402 payments.
// Rendered for the instance owner only.
import { getDb, getKv } from '@/server/nansen/db';
import { ALL_LEDGER, coverageStats, type ModuleId } from '@/config/endpoint-ledger';
import { endpointHealth, driftLog } from '@/server/nansen/health';
import { jobHealth, recentJobs } from '@/server/jobs/queue';
import { paymentStats } from '@/server/nansen/x402';

const DAY = 86_400_000;

export function ledgerCoverage() {
  const stats = coverageStats();
  const byModule = new Map<string, number>();
  for (const l of ALL_LEDGER) for (const m of l.usedBy ?? []) byModule.set(m, (byModule.get(m) ?? 0) + 1);
  const byClass = new Map<string, { used: number; total: number }>();
  for (const l of ALL_LEDGER) {
    const c = byClass.get(l.class) ?? { used: 0, total: 0 };
    c.total++;
    if (l.usedBy?.length) c.used++;
    byClass.set(l.class, c);
  }
  return {
    ...stats,
    modules: [...byModule.entries()].map(([module, used]) => ({ module: module as ModuleId, used })).sort((a, b) => b.used - a.used),
    classes: [...byClass.entries()].map(([cls, v]) => ({ cls, ...v })),
    plannedList: ALL_LEDGER.filter((l) => !l.usedBy?.length && l.planned).map((l) => ({ key: l.key, module: l.planned! })),
  };
}

export function perUser(sinceMs: number) {
  return (getDb().prepare(`
    SELECT l.user_id AS userId, u.family, u.address,
      SUM(l.cache_hit = 0) AS live, SUM(l.cache_hit = 1) AS cached, SUM(l.credits) AS credits, MAX(l.called_at) AS lastAt
    FROM credit_ledger l LEFT JOIN users u ON u.id = l.user_id
    WHERE l.called_at >= ? GROUP BY l.user_id ORDER BY credits DESC
  `).all(sinceMs) as Array<{ userId: number | null; family: string | null; address: string | null; live: number; cached: number; credits: number; lastAt: number }>)
    .map((r) => ({ ...r, who: r.userId == null ? 'instance key (owner, scanner, public views)' : `${r.family} ${r.address!.slice(0, 6)}…${r.address!.slice(-4)}` }));
}

export function perDay(days: number, now = Date.now()) {
  const since = now - days * DAY;
  const db = getDb();
  const calls = db.prepare(`
    SELECT date(called_at / 1000, 'unixepoch') AS day, SUM(cache_hit = 0) AS live, SUM(credits) AS credits, COUNT(DISTINCT COALESCE(user_id, 0)) AS users
    FROM credit_ledger WHERE called_at >= ? GROUP BY day
  `).all(since) as Array<{ day: string; live: number; credits: number; users: number }>;
  const errors = new Map((db.prepare(`SELECT date(at / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM api_errors WHERE at >= ? GROUP BY day`).all(since) as Array<{ day: string; n: number }>).map((r) => [r.day, r.n]));
  return calls.map((c) => ({ ...c, errors: errors.get(c.day) ?? 0 })).sort((a, b) => a.day.localeCompare(b.day));
}

export function adminView(now = Date.now()) {
  return {
    ledger: ledgerCoverage(),
    /** Failures and drift are recorded from this moment on. */
    healthSince: Number(getKv('health_since')?.value ?? now),
    endpoints: endpointHealth(now - 7 * DAY),
    drift: driftLog(40),
    users: perUser(now - 30 * DAY),
    days: perDay(14, now),
    jobs: jobHealth(now),
    recentJobs: recentJobs(12),
    payments: paymentStats(now - 30 * DAY),
  };
}
export type AdminView = ReturnType<typeof adminView>;
