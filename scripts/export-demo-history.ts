// `pnpm export-demo`: writes TIDE's own accumulated history (scanner
// snapshots, smart-money trades, storm scores, anchor reports, the credit
// ledger) to fixtures/scan-history.json. With DEMO_MODE=1 and an empty
// database, TIDE imports it on startup, so a fresh clone with no key shows
// the real map, fronts, forecasts and ticker this instance recorded.
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/server/nansen/db';
import { DEMO_TABLES } from '@/server/nansen/demo-history';

const db = getDb();
const now = Date.now();
const tables: Record<string, { columns: string[]; rows: unknown[][] }> = {};
for (const t of DEMO_TABLES) {
  const stmt = db.prepare(`SELECT * FROM ${t.name}${t.where ? ` WHERE ${t.where}` : ''} ORDER BY id`);
  const rows = (t.where ? stmt.all(now - 7 * 86_400_000) : stmt.all()) as Array<Record<string, unknown>>;
  const columns = rows[0] ? Object.keys(rows[0]).filter((c) => c !== 'id') : [];
  tables[t.name] = { columns, rows: rows.map((r) => columns.map((c) => r[c])) };
  console.log(`${t.name}: ${rows.length} rows`);
}
const out = path.resolve('fixtures/scan-history.json');
fs.writeFileSync(out, JSON.stringify({ exportedAt: now, tables }));
console.log(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
