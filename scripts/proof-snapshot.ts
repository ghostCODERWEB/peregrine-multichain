// Writes fixtures/proof-ledger.json: this build's Nansen API usage during the buildathon window,
// read from the local credit ledger (real calls only; cache hits counted separately).
import fs from 'node:fs';
import Database from 'better-sqlite3';

const db = new Database(process.env.TIDE_DB_PATH ?? './data/site.db', { readonly: true });
const from = Date.parse('2026-09-14T00:00:00Z');
const rows = db.prepare(`SELECT endpoint, SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) AS calls, SUM(cache_hit) AS cached, SUM(credits) AS credits
  FROM credit_ledger WHERE called_at >= ? GROUP BY endpoint ORDER BY calls DESC`).all(from) as Array<{ endpoint: string; calls: number; cached: number; credits: number }>;
const days = db.prepare(`SELECT strftime('%Y-%m-%d', called_at / 1000, 'unixepoch') AS day, SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) AS calls
  FROM credit_ledger WHERE called_at >= ? GROUP BY day ORDER BY day`).all(from) as Array<{ day: string; calls: number }>;
const span = db.prepare('SELECT MIN(called_at) AS a, MAX(called_at) AS b FROM credit_ledger WHERE called_at >= ?').get(from) as { a: number; b: number };
const out = {
  generatedAt: new Date().toISOString(),
  window: { from: new Date(span.a).toISOString(), to: new Date(span.b).toISOString() },
  calls: rows.reduce((s, r) => s + r.calls, 0),
  cached: rows.reduce((s, r) => s + r.cached, 0),
  credits: rows.reduce((s, r) => s + (r.credits ?? 0), 0),
  endpoints: rows.filter((r) => r.calls > 0).map((r) => ({ endpoint: r.endpoint, calls: r.calls, cached: r.cached, credits: r.credits ?? 0 })),
  days,
};
fs.writeFileSync('fixtures/proof-ledger.json', JSON.stringify(out, null, 1));
console.log(`calls ${out.calls} · cached ${out.cached} · endpoints ${out.endpoints.length} · credits ${out.credits}`);
