// One SQLite database for everything TIDE persists locally: the Nansen
// response cache, the credit ledger, and the scanner's own time series
// (CPI inputs and blended CPI, smart-money DEX trades for rotation fronts).
// A single file keeps `docker compose up` and a judge's local run simple —
// no separate cache service to stand up.
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { importDemoHistory } from './demo-history';

function dbPath(): string {
  return path.resolve(process.cwd(), process.env.TIDE_DB_PATH ?? './data/tide.db');
}

// Ordered, append-only. user_version records how many have run, so each
// runs exactly once per database file. Never edit a shipped migration —
// add a new one.
const MIGRATIONS: string[] = [
  // 1: cache, ledger, capability probes.
  `
  CREATE TABLE IF NOT EXISTS response_cache (
    cache_key   TEXT PRIMARY KEY,
    endpoint    TEXT NOT NULL,
    body        TEXT NOT NULL,
    fetched_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_response_cache_expires ON response_cache(expires_at);

  CREATE TABLE IF NOT EXISTS credit_ledger (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint    TEXT NOT NULL,
    credits     INTEGER NOT NULL,
    cache_hit   INTEGER NOT NULL DEFAULT 0,
    called_at   INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_credit_ledger_called_at ON credit_ledger(called_at);

  CREATE TABLE IF NOT EXISTS capability_probes (
    chain      TEXT NOT NULL,
    endpoint   TEXT NOT NULL,
    status     TEXT NOT NULL,
    detail     TEXT,
    probed_at  INTEGER NOT NULL,
    PRIMARY KEY (chain, endpoint)
  );
  `,
  // 2: the scanner's time series. Drops the placeholder versions of these
  // two tables from the first draft of migration 1 (never written to —
  // the scanner didn't exist yet) and recreates them with the columns
  // dedupe, drill-down and forecasting actually need.
  `
  DROP TABLE IF EXISTS chain_pressure_snapshots;
  DROP TABLE IF EXISTS smart_money_trades;

  -- One row per (chain, window, scan). Netflow and volume are stored raw
  -- alongside the derived ratio and CPI, so the z-score can always be
  -- recomputed from inputs rather than trusted as a black box.
  CREATE TABLE chain_pressure_snapshots (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    chain               TEXT NOT NULL,
    window              TEXT NOT NULL,        -- '1h' | '24h' | '7d'
    net_flow_usd        REAL NOT NULL,
    volume_usd          REAL NOT NULL,
    ratio               REAL NOT NULL,
    z                   REAL NOT NULL,
    cpi                 REAL NOT NULL,
    used_cross_section  INTEGER NOT NULL,     -- 1 if z came from peers, not this chain's own history
    nf_source           TEXT NOT NULL,        -- 'smart-money' | 'market-flow' (registry.ts PressureSource)
    token_count         INTEGER NOT NULL,     -- tokens summed into net_flow_usd
    snapshot_at         INTEGER NOT NULL
  );
  CREATE INDEX idx_cps_chain_window_time ON chain_pressure_snapshots(chain, window, snapshot_at);

  -- Blended CPI per chain per scan — the series the Holt forecast and the
  -- barometer's 7-day trend line read.
  CREATE TABLE chain_cpi (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    chain                TEXT NOT NULL,
    cpi                  REAL NOT NULL,
    any_cross_section    INTEGER NOT NULL,
    windows              TEXT NOT NULL,       -- JSON: which windows contributed
    snapshot_at          INTEGER NOT NULL
  );
  CREATE INDEX idx_chain_cpi_chain_time ON chain_cpi(chain, snapshot_at);

  -- Smart-money DEX trades, classified as capital leaving risk on a chain
  -- ('sell': risk token -> base asset) or entering it ('buy': base asset ->
  -- risk token). Risk-to-risk and base-to-base swaps aren't stored: they
  -- don't move capital into or out of a chain's risk assets.
  CREATE TABLE smart_money_trades (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    chain          TEXT NOT NULL,
    tx_hash        TEXT NOT NULL,
    wallet         TEXT NOT NULL,
    wallet_label   TEXT,
    side           TEXT NOT NULL,             -- 'buy' | 'sell'
    token_address  TEXT NOT NULL,             -- the risk token entered or exited
    token_symbol   TEXT,
    usd_value      REAL NOT NULL,
    traded_at      INTEGER NOT NULL,
    captured_at    INTEGER NOT NULL,
    UNIQUE (chain, tx_hash, wallet, token_address, side)
  );
  CREATE INDEX idx_smt_wallet_time ON smart_money_trades(wallet, traded_at);
  CREATE INDEX idx_smt_chain_time ON smart_money_trades(chain, traded_at);

  -- One row per scanner run, so /coverage can show the scan history and
  -- what each run cost.
  CREATE TABLE scan_runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at     INTEGER NOT NULL,
    finished_at    INTEGER,
    chains_scored  INTEGER,
    trades_added   INTEGER,
    credits        INTEGER,
    error          TEXT
  );
  `,
  // 3: every Storm Score TIDE computes (a token page view or the scanner's
  // storm sweep), so the home ticker ranks real computed scores and the
  // lab can later compare them with what the price did.
  `
  CREATE TABLE storm_scores (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    chain          TEXT NOT NULL,
    token_address  TEXT NOT NULL,
    symbol         TEXT,
    score          REAL NOT NULL,
    band           TEXT NOT NULL,
    confidence     REAL NOT NULL,
    sub_scores     TEXT NOT NULL,
    missing        TEXT NOT NULL,
    market_cap_usd REAL,
    price_usd      REAL,
    source         TEXT NOT NULL,
    computed_at    INTEGER NOT NULL
  );
  CREATE INDEX idx_storm_token_time ON storm_scores(chain, token_address, computed_at);
  CREATE INDEX idx_storm_time ON storm_scores(computed_at);
  `,
  // 4: the AI anchor's reports (Nansen agent/fast, 200 credits each), kept
  // so a report is reused for an hour and the hourly cap can be enforced.
  `
  CREATE TABLE anchor_reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    subject         TEXT NOT NULL,
    prompt          TEXT NOT NULL,
    text            TEXT NOT NULL,
    tool_calls      TEXT NOT NULL,
    conversation_id TEXT,
    credits         INTEGER NOT NULL,
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX idx_anchor_subject ON anchor_reports(subject, created_at);
  `,
  // 5: small shared facts between the scanner and web processes (e.g. the
  // last credits-remaining header either of them saw).
  `
  CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
  `,
  // 6: blended CPI per pressure source. Tier A chains now carry two
  // series — smart-money (private view) and all-trader market flow (the
  // public view Nansen's redistribution rules allow) — so each blended row
  // says which. Existing rows are rebuilt from snapshots by rescoreAll.
  `
  ALTER TABLE chain_cpi ADD COLUMN source TEXT NOT NULL DEFAULT 'smart-money';
  CREATE INDEX idx_chain_cpi_chain_source_time ON chain_cpi(chain, source, snapshot_at);
  `,
  // 7: accounts. Wallet sign-in (no email, no password), sessions, each
  // user's own Nansen key sealed with AES-256-GCM, per-user ledger rows,
  // and an audit log of key and alert actions.
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, family TEXT NOT NULL, address TEXT NOT NULL,
    created_at INTEGER NOT NULL, UNIQUE (family, address)
  );
  CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE auth_nonces (nonce TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
  CREATE TABLE api_keys (
    user_id INTEGER PRIMARY KEY, ciphertext TEXT NOT NULL, iv TEXT NOT NULL, tag TEXT NOT NULL,
    last4 TEXT NOT NULL, plan TEXT, verified_at INTEGER NOT NULL
  );
  CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, action TEXT NOT NULL, detail TEXT, at INTEGER NOT NULL);
  ALTER TABLE credit_ledger ADD COLUMN user_id INTEGER;
  `,
  // 8: x402 pay-per-call payments. One row per paid attempt: who paid
  // (the wallet that signed; user_id when also signed in), what for, how
  // much, and the settlement transaction Nansen reported. Never the data.
  `
  CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, payer TEXT NOT NULL, network TEXT NOT NULL,
    endpoint TEXT NOT NULL, amount TEXT NOT NULL, amount_usd REAL, status TEXT NOT NULL,
    tx TEXT, error TEXT, at INTEGER NOT NULL
  );
  CREATE INDEX idx_payments_at ON payments(at);
  `,
  // 9: the job queue the worker polls (scanner, storm sweeps, backtests).
  // dedupe_key makes enqueueing idempotent: at most one queued-or-running
  // job per key.
  `
  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    dedupe_key TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL,
    run_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    locked_by TEXT,
    locked_at INTEGER,
    last_error TEXT,
    result TEXT,
    created_at INTEGER NOT NULL,
    finished_at INTEGER
  );
  CREATE UNIQUE INDEX idx_jobs_active_key ON jobs(dedupe_key) WHERE status IN ('queued', 'running');
  CREATE INDEX idx_jobs_due ON jobs(status, run_at);
  CREATE INDEX idx_jobs_kind ON jobs(kind, finished_at);
  `,
];

export function audit(userId: number | null, action: string, detail?: string): void {
  getDb().prepare('INSERT INTO audit_log (user_id, action, detail, at) VALUES (?, ?, ?, ?)').run(userId, action, detail ?? null, Date.now());
}

export function setKv(key: string, value: string): void {
  getDb().prepare('INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').run(key, value, Date.now());
}

export function getKv(key: string): { value: string; updatedAt: number } | null {
  const r = getDb().prepare('SELECT value, updated_at FROM kv WHERE key = ?').get(key) as { value: string; updated_at: number } | undefined;
  return r ? { value: r.value, updatedAt: r.updated_at } : null;
}

function migrate(db: Database.Database) {
  const current = db.pragma('user_version', { simple: true }) as number;
  for (let i = current; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}

function open(): Database.Database {
  const resolved = dbPath();
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000'); // the scanner and the web server share this file
  migrate(db);
  // A fresh clone in DEMO_MODE has no history of its own: seed it from the
  // recorded export so the map, fronts and forecasts have something real.
  if (process.env.DEMO_MODE === '1') {
    const empty = (db.prepare('SELECT COUNT(*) AS n FROM chain_cpi').get() as { n: number }).n === 0;
    if (empty) importDemoHistory(db);
  }
  return db;
}

let singleton: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!singleton) singleton = open();
  return singleton;
}
