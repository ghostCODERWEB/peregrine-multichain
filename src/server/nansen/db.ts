// One SQLite database for everything TIDE persists locally: the Nansen
// response cache, the credit ledger, and the scanner's own time series
// (CPI inputs, smart-money DEX trades for rotation fronts). A single file
// keeps `docker compose up` and a judge's local run simple — no separate
// cache service to stand up.
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.TIDE_DB_PATH ?? './data/tide.db';

function open(): Database.Database {
  const resolved = path.resolve(process.cwd(), DB_PATH);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
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

    -- Chain Pressure Index inputs, one row per (chain, window, snapshot).
    -- The scanner writes these every 15 minutes; CPI's z-score needs this
    -- chain's own trailing history, which only exists once this table has
    -- rows, so the scanner has to start on day 1 for forecasts to work by
    -- submission day.
    CREATE TABLE IF NOT EXISTS chain_pressure_snapshots (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      chain          TEXT NOT NULL,
      window         TEXT NOT NULL, -- '1h' | '24h' | '7d'
      net_flow_usd   REAL NOT NULL,
      volume_usd     REAL NOT NULL,
      cpi            REAL,          -- filled in once enough history exists to z-score
      snapshot_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cps_chain_window_time
      ON chain_pressure_snapshots(chain, window, snapshot_at);

    -- Smart-money DEX trades captured for rotation-front detection: a sell
    -- on chain A followed by a buy on chain B by the same wallet within the
    -- front's time window.
    CREATE TABLE IF NOT EXISTS smart_money_trades (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      chain         TEXT NOT NULL,
      wallet        TEXT NOT NULL,
      token_address TEXT NOT NULL,
      side          TEXT NOT NULL, -- 'buy' | 'sell'
      usd_value     REAL NOT NULL,
      traded_at     INTEGER NOT NULL,
      captured_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_smt_wallet_time ON smart_money_trades(wallet, traded_at);
    CREATE INDEX IF NOT EXISTS idx_smt_chain_time ON smart_money_trades(chain, traded_at);

    -- Capability probe results: one row per (chain, endpoint) telling the
    -- registry whether that combination actually answers.
    CREATE TABLE IF NOT EXISTS capability_probes (
      chain      TEXT NOT NULL,
      endpoint   TEXT NOT NULL,
      status     TEXT NOT NULL, -- 'ok' | 'empty' | 'error'
      detail     TEXT,
      probed_at  INTEGER NOT NULL,
      PRIMARY KEY (chain, endpoint)
    );
  `);
}

let singleton: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!singleton) singleton = open();
  return singleton;
}
