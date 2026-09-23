// API health for the admin view: failed calls (the credit ledger only
// records successes) and schema drift — live responses checked against the
// contract generated from Nansen's OpenAPI (src/types/nansen/api.gen.ts).
// Drift checks run after the response has been handed back, so they never
// slow a page down, and one drift row is kept per distinct issue.
import type { ZodType } from 'zod';
import { ENDPOINTS } from '@/types/nansen/api.gen';
import { getDb } from './db';

let schemas: Map<string, ZodType> | null = null;
function responseSchema(method: string, endpoint: string): ZodType | null {
  if (!schemas) {
    schemas = new Map();
    for (const e of Object.values(ENDPOINTS)) if (e.response) schemas.set(`${e.method} ${e.endpoint}`, e.response as ZodType);
  }
  return schemas.get(`${method} ${endpoint}`) ?? null;
}

export function recordError(endpoint: string, status: number | null, message: string, userId: number | null = null): void {
  try {
    getDb().prepare('INSERT INTO api_errors (endpoint, status, message, user_id, at) VALUES (?, ?, ?, ?, ?)')
      .run(endpoint.replace(/^smart-alert\/[0-9a-f-]{20,}$/, 'smart-alert/{id}'), status, message.slice(0, 400), userId, Date.now());
  } catch { /* health logging never breaks a call */ }
}

/** Array indices collapse ("data.12.price" → "data[].price") so one
 *  drifting field is one row, not one per element. */
const normalizePath = (p: PropertyKey[]) => p.map((k) => (typeof k === 'number' ? '[]' : String(k))).join('.').replace(/\.\[\]/g, '[]') || '(root)';

/** Check a live response against the contract; returns the issues found
 *  (also stored). Endpoints without a generated schema are skipped. */
export function checkDrift(endpoint: string, method: string, data: unknown, now = Date.now()): Array<{ path: string; message: string }> {
  const schema = responseSchema(method, endpoint);
  if (!schema) return [];
  const r = schema.safeParse(data);
  if (r.success) return [];
  const seen = new Map<string, { path: string; message: string }>();
  for (const i of r.error.issues) {
    const issue = { path: normalizePath(i.path), message: i.message.slice(0, 200) };
    seen.set(`${issue.path} ${issue.message}`, issue);
    if (seen.size >= 10) break;
  }
  const upsert = getDb().prepare(`
    INSERT INTO schema_drift (endpoint, path, message, count, first_seen, last_seen) VALUES (?, ?, ?, 1, ?, ?)
    ON CONFLICT(endpoint, path, message) DO UPDATE SET count = count + 1, last_seen = excluded.last_seen
  `);
  for (const d of seen.values()) upsert.run(endpoint, d.path, d.message, now, now);
  return [...seen.values()];
}

/** checkDrift off the request's critical path. */
export function checkDriftLater(endpoint: string, method: string, data: unknown): void {
  setImmediate(() => { try { checkDrift(endpoint, method, data); } catch { /* never breaks a call */ } });
}

export interface EndpointHealth { endpoint: string; live: number; errors: number; errorRate: number; lastError: string | null; lastStatus: number | null }

/** Live calls and failures per endpoint over a window. */
export function endpointHealth(sinceMs: number): EndpointHealth[] {
  const db = getDb();
  const live = db.prepare('SELECT endpoint, COUNT(*) AS n FROM credit_ledger WHERE cache_hit = 0 AND called_at >= ? GROUP BY endpoint').all(sinceMs) as Array<{ endpoint: string; n: number }>;
  const errs = db.prepare(`
    SELECT endpoint, COUNT(*) AS n,
      (SELECT message FROM api_errors e2 WHERE e2.endpoint = e.endpoint ORDER BY at DESC LIMIT 1) AS lastError,
      (SELECT status FROM api_errors e2 WHERE e2.endpoint = e.endpoint ORDER BY at DESC LIMIT 1) AS lastStatus
    FROM api_errors e WHERE at >= ? GROUP BY endpoint
  `).all(sinceMs) as Array<{ endpoint: string; n: number; lastError: string | null; lastStatus: number | null }>;
  const byEp = new Map<string, EndpointHealth>();
  const norm = (e: string) => e.replace(/^smart-alert\/[0-9a-f-]{20,}$/, 'smart-alert/{id}');
  for (const l of live) {
    const k = norm(l.endpoint);
    const h = byEp.get(k) ?? { endpoint: k, live: 0, errors: 0, errorRate: 0, lastError: null, lastStatus: null };
    h.live += l.n;
    byEp.set(k, h);
  }
  for (const e of errs) {
    const h = byEp.get(e.endpoint) ?? { endpoint: e.endpoint, live: 0, errors: 0, errorRate: 0, lastError: null, lastStatus: null };
    h.errors = e.n; h.lastError = e.lastError; h.lastStatus = e.lastStatus;
    byEp.set(e.endpoint, h);
  }
  return [...byEp.values()]
    .map((h) => ({ ...h, errorRate: h.errors / Math.max(1, h.live + h.errors) }))
    .sort((a, b) => b.errors - a.errors || b.live - a.live);
}

export function driftLog(limit = 50) {
  return getDb().prepare('SELECT endpoint, path, message, count, first_seen AS firstSeen, last_seen AS lastSeen FROM schema_drift ORDER BY last_seen DESC LIMIT ?')
    .all(limit) as Array<{ endpoint: string; path: string; message: string; count: number; firstSeen: number; lastSeen: number }>;
}
