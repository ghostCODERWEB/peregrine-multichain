// Response cache keyed by endpoint + request body. TTLs are per data
// family: fast-moving flow data expires in minutes, near-static profiler
// facts hold for days, and anything under backtesting-data/* is immutable
// (a historical snapshot from a fixed date never changes) so it's cached
// forever.
import { getDb } from './db';
import crypto from 'node:crypto';

// Keyed by the real API path (as passed to callNansen), not the docs
// page slug — the two differ (docs say "token-god-mode/holders", the API
// path is "tgm/holders") and keying on the slug meant every entry
// silently fell through to DEFAULT_TTL.
const TTL_MS: Record<string, number> = {
  'points/tier': 24 * 60 * 60_000,
  'smart-money/netflow': 10 * 60_000,
  'smart-money/dex-trades': 10 * 60_000,
  'smart-money/holdings': 10 * 60_000,
  'smart-money/pnl-leaderboard': 30 * 60_000,
  'smart-money/perp-trades': 5 * 60_000,
  'smart-money/dcas': 15 * 60_000,
  // Daily snapshots: today's row can still move, earlier ones can't.
  'smart-money/historical-holdings': 6 * 60 * 60_000,
  'perp-screener': 10 * 60_000,
  'perp-leaderboard': 30 * 60_000,
  'tgm/perp-trades': 5 * 60_000,
  'tgm/perp-pnl-leaderboard': 30 * 60_000,
  'prediction-market/categories': 15 * 60_000,
  'prediction-market/market-screener': 10 * 60_000,
  'prediction-market/event-screener': 15 * 60_000,
  'prediction-market/ohlcv': 10 * 60_000,
  'prediction-market/orderbook': 2 * 60_000,
  'prediction-market/top-holders': 10 * 60_000,
  'prediction-market/trades-by-market': 5 * 60_000,
  'prediction-market/pnl-by-market': 30 * 60_000,
  'prediction-market/position-detail': 10 * 60_000,
  // A wallet's prediction record changes slowly.
  'prediction-market/address-summary': 24 * 60 * 60_000,
  'token-screener': 5 * 60_000,
  'tgm/holders': 5 * 60_000,
  'tgm/flow-intelligence': 5 * 60_000,
  'tgm/flows': 5 * 60_000,
  'tgm/who-bought-sold': 5 * 60_000,
  'tgm/dex-trades': 5 * 60_000,
  'tgm/token-ohlcv': 5 * 60_000,
  'tgm/token-information': 60 * 60_000,
  'tgm/indicators': 6 * 60 * 60_000,
  'tgm/pnl-leaderboard': 15 * 60_000,
  'chains/chain-rank': 30 * 60_000,
  'profiler/address/first-funder': 7 * 24 * 60 * 60_000,
  'profiler/address/related-wallets': 7 * 24 * 60 * 60_000,
  'profiler/address/current-balance': 60_000,
  'profiler/address/pnl-summary': 10 * 60_000,
  'profiler/address/transactions': 5 * 60_000,
  'profiler/address/counterparties': 60 * 60_000,
  'search/general': 60 * 60_000,
  'search/entity-name': 24 * 60 * 60_000,
  'search/token-sectors': 24 * 60 * 60_000,
  'search/web-search': 6 * 60 * 60_000,
  'search/web-fetch': 24 * 60 * 60_000,
  'ra-agent/posts-by-token': 30 * 60_000,
  'tgm/transfers': 5 * 60_000,
  'tgm/jup-dca': 10 * 60_000,
  'tgm/position-intelligence': 10 * 60_000,
  'tgm/perp-positions': 10 * 60_000,
  'transaction-with-token-transfer-lookup': 7 * 24 * 60 * 60_000,
  'profiler/address/historical-balances': 60 * 60_000,
  'smart-alert/list': 30_000,
  'trade/quote': 30_000,
};

/** Every v1beta1 backtesting endpoint reads a fixed point in history, so
 *  the answer for a given request is immutable once observed. */
const FOREVER = Number.MAX_SAFE_INTEGER;

const DEFAULT_TTL = 5 * 60_000;

export function ttlFor(endpoint: string): number {
  if (endpoint.startsWith('v1beta1/')) return FOREVER;
  return TTL_MS[endpoint] ?? DEFAULT_TTL;
}

/** `scope` partitions the cache per user: a member's responses (fetched
 *  with their own key) are never served to anyone else, and vice versa. */
export function cacheKey(endpoint: string, body: unknown, scope?: string | null): string {
  const hash = crypto.createHash('sha1').update(JSON.stringify(body ?? {})).digest('hex');
  return scope ? `${scope}|${endpoint}:${hash}` : `${endpoint}:${hash}`;
}

export interface CacheHit<T> { value: T; fetchedAt: number; }

export function readCache<T>(endpoint: string, body: unknown, scope?: string | null): CacheHit<T> | null {
  const key = cacheKey(endpoint, body, scope);
  const row = getDb()
    .prepare('SELECT body, fetched_at, expires_at FROM response_cache WHERE cache_key = ?')
    .get(key) as { body: string; fetched_at: number; expires_at: number } | undefined;
  if (!row) return null;
  if (Date.now() > row.expires_at) return null;
  return { value: JSON.parse(row.body) as T, fetchedAt: row.fetched_at };
}

export function writeCache(endpoint: string, body: unknown, value: unknown, scope?: string | null): void {
  const key = cacheKey(endpoint, body, scope);
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
