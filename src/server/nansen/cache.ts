// Response cache keyed by endpoint + request body. TTLs are per data
// family: fast-moving flow data expires in minutes, near-static profiler
// facts hold for days, and anything under backtesting-data/* is immutable
// (a historical snapshot from a fixed date never changes) so it's cached
// forever.
import { getDb } from './db';
import crypto from 'node:crypto';

const TTL_MS: Record<string, number> = {
  'smart-money/netflows': 10 * 60_000,
  'smart-money/dex-trades': 10 * 60_000,
  'smart-money/holdings': 10 * 60_000,
  'token-screener': 5 * 60_000,
  'token-god-mode/holders': 5 * 60_000,
  'token-god-mode/flow-intelligence': 5 * 60_000,
  'token-god-mode/flows': 5 * 60_000,
  'token-god-mode/who-bought-sold': 5 * 60_000,
  'token-god-mode/dex-trades': 5 * 60_000,
  'token-god-mode/token-information': 60 * 60_000,
  'token-god-mode/nansen-indicators': 6 * 60 * 60_000,
  'token-god-mode/price-ohlcv': 5 * 60_000,
  'token-god-mode/pnl-leaderboard': 15 * 60_000,
  'chain-rank': 30 * 60_000,
  'profiler/address-first-funder': 7 * 24 * 60 * 60_000,
  'profiler/address-related-wallets': 7 * 24 * 60 * 60_000,
  'profiler/address-current-balances': 60_000,
  'profiler/address-pnl-and-trade-performance': 10 * 60_000,
  'profiler/address-transactions': 5 * 60_000,
  'profiler/address-counterparties': 60 * 60_000,
  search: 60 * 60_000,
};

/** Every backtesting-data/* endpoint reads a fixed point in history, so the
 *  answer for a given request is immutable once observed. */
const FOREVER = Number.MAX_SAFE_INTEGER;

const DEFAULT_TTL = 5 * 60_000;

export function ttlFor(endpoint: string): number {
  if (endpoint.startsWith('backtesting-data/')) return FOREVER;
  return TTL_MS[endpoint] ?? DEFAULT_TTL;
}

export function cacheKey(endpoint: string, body: unknown): string {
  const hash = crypto.createHash('sha1').update(JSON.stringify(body ?? {})).digest('hex');
  return `${endpoint}:${hash}`;
}

export interface CacheHit<T> { value: T; fetchedAt: number; }

export function readCache<T>(endpoint: string, body: unknown): CacheHit<T> | null {
  const key = cacheKey(endpoint, body);
  const row = getDb()
    .prepare('SELECT body, fetched_at, expires_at FROM response_cache WHERE cache_key = ?')
    .get(key) as { body: string; fetched_at: number; expires_at: number } | undefined;
  if (!row) return null;
  if (Date.now() > row.expires_at) return null;
  return { value: JSON.parse(row.body) as T, fetchedAt: row.fetched_at };
}

export function writeCache(endpoint: string, body: unknown, value: unknown): void {
  const key = cacheKey(endpoint, body);
  const now = Date.now();
  const ttl = ttlFor(endpoint);
  const expiresAt = ttl === FOREVER ? FOREVER : now + ttl;
  getDb()
    .prepare(`
      INSERT INTO response_cache (cache_key, endpoint, body, fetched_at, expires_at)
      VALUES (@key, @endpoint, @body, @now, @expiresAt)
      ON CONFLICT(cache_key) DO UPDATE SET
        body = excluded.body, fetched_at = excluded.fetched_at, expires_at = excluded.expires_at
    `)
    .run({ key, endpoint, body: JSON.stringify(value), now, expiresAt });
}

/** Sweeps expired rows. Cheap enough to run on a schedule rather than per read. */
export function sweepExpired(): number {
  const result = getDb().prepare('DELETE FROM response_cache WHERE expires_at < ?').run(Date.now());
  return result.changes;
}
