// DEMO_MODE's time machine: fixtures/scan-history.json holds history this
// TIDE instance recorded live (see scripts/export-demo-history.ts). On an
// empty database in DEMO_MODE it is imported with every timestamp shifted
// by (now − exportedAt), so the recorded run replays as if it were
// current. The header says so; nothing is invented — every row is a real
// reading from a real Nansen response, only its clock is moved.
import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

export const DEMO_TABLES: Array<{ name: string; where?: string }> = [
  { name: 'chain_pressure_snapshots' },
  { name: 'chain_cpi' },
  { name: 'smart_money_trades', where: 'traded_at >= ?' },
  { name: 'storm_scores' },
  { name: 'anchor_reports' },
  { name: 'scan_runs' },
  { name: 'credit_ledger' },
];

const TIME_COLUMNS = new Set(['snapshot_at', 'traded_at', 'captured_at', 'computed_at', 'created_at', 'started_at', 'finished_at', 'called_at']);

interface Export { exportedAt: number; tables: Record<string, { columns: string[]; rows: unknown[][] }> }

export function demoHistoryFile(): string {
  return path.resolve(process.cwd(), 'fixtures/scan-history.json');
}

/** Returns the recording time of the imported history, or null. */
export function importDemoHistory(db: Database.Database, now = Date.now()): number | null {
  const file = demoHistoryFile();
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as Export;
  const shift = now - data.exportedAt;
  db.transaction(() => {
    for (const t of DEMO_TABLES) {
      const tbl = data.tables[t.name];
      if (!tbl || !tbl.rows.length) continue;
      const stmt = db.prepare(`INSERT OR IGNORE INTO ${t.name} (${tbl.columns.join(', ')}) VALUES (${tbl.columns.map(() => '?').join(', ')})`);
      const timeIdx = tbl.columns.map((c, i) => (TIME_COLUMNS.has(c) ? i : -1)).filter((i) => i >= 0);
      for (const row of tbl.rows) {
        const r = [...row];
        for (const i of timeIdx) if (typeof r[i] === 'number') r[i] = (r[i] as number) + shift;
        stmt.run(...r);
      }
    }
    db.prepare("INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES ('demo_recorded_at', ?, ?)").run(String(data.exportedAt), now);
  })();
  return data.exportedAt;
}
