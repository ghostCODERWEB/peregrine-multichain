// The one function every Nansen call in this app goes through. Handles
// auth, rate limiting, retry-on-429 honoring Retry-After, the response
// cache, the credit ledger, and DEMO_MODE record/replay — so every route,
// the scanner, and the backtest pipeline inherit all of it for free instead
// of each having to remember the rules.
import type { ZodType } from 'zod';
import { getLimiter, type NansenPlan } from './limiter';
import { readCache, writeCache } from './cache';
import { recordCall } from './ledger';
import { recordFixture, replayFixture, fixtureMode } from './demo';

const HOST = 'https://api.nansen.ai/api';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Endpoints are passed without a version ("tgm/holders"), except the
 *  backtesting family, which lives under v1beta1 and is passed with its
 *  prefix ("v1beta1/tgm/historical-token-ohlcv"). */
function urlFor(endpoint: string): string {
  return endpoint.startsWith('v1beta1/') ? `${HOST}/${endpoint}` : `${HOST}/v1/${endpoint}`;
}

export class NansenApiError extends Error {
  constructor(
    public readonly endpoint: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`Nansen ${endpoint} responded ${status}: ${typeof body === 'string' ? body : JSON.stringify(body).slice(0, 300)}`);
    this.name = 'NansenApiError';
  }
}

export interface CallMeta {
  creditsCost: number;
  creditsUsed: number | null;
  creditsRemaining: number | null;
  cacheHit: boolean;
}

export interface CallResult<T> {
  data: T;
  meta: CallMeta;
}

function plan(): NansenPlan {
  const p = process.env.NANSEN_PLAN;
  return p === 'pro' ? 'pro' : 'free';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The actual network call, with retry on 429 honoring Retry-After and a
 *  couple of retries on transient 5xx. Never called directly outside this
 *  file — callNansen wraps it with cache/demo/ledger. */
/** Last X-Nansen-Credits-Remaining seen on any response this process made,
 *  so /coverage can show the account's live balance without a dedicated
 *  call to find it out. */
let lastCreditsRemaining: number | null = null;
export const lastKnownCreditsRemaining = () => lastCreditsRemaining;

async function raw<T>(endpoint: string, body: unknown, method: HttpMethod): Promise<CallResult<T>> {
  const apiKey = process.env.NANSEN_API_KEY;
  if (!apiKey) {
    throw new Error(
      `NANSEN_API_KEY is not set. Set it in .env, or run with DEMO_MODE=1 to replay recorded fixtures instead.`,
    );
  }

  const hasQuery = method === 'GET' && body && Object.keys(body as object).length > 0;
  const url = hasQuery
    ? `${urlFor(endpoint)}?${new URLSearchParams(
      Object.entries(body as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
    ).toString()}`
    : urlFor(endpoint);
  const sendsBody = method === 'POST' || method === 'PATCH' || (method === 'DELETE' && body && Object.keys(body as object).length > 0);

  const limiter = getLimiter(plan());
  const maxAttempts = 4;

  for (let attempt = 1; ; attempt++) {
    await limiter.acquire();

    const res = await fetch(url, {
      method,
      headers: {
        apikey: apiKey,
        'content-type': 'application/json',
      },
      body: sendsBody ? JSON.stringify(body ?? {}) : undefined,
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    });

    if (res.status === 429) {
      if (attempt >= maxAttempts) {
        const text = await res.text().catch(() => '');
        throw new NansenApiError(endpoint, 429, text);
      }
      const retryAfterHeader = res.headers.get('retry-after');
      const waitMs = retryAfterHeader ? Number(retryAfterHeader) * 1_000 : 1_000 * 2 ** attempt;
      await sleep(Number.isFinite(waitMs) && waitMs > 0 ? waitMs : 2_000);
      continue;
    }

    if (res.status >= 500 && attempt < maxAttempts) {
      await sleep(500 * 2 ** attempt);
      continue;
    }

    const creditsCost = Number(res.headers.get('x-nansen-credits-cost') ?? 0);
    const creditsUsedHeader = res.headers.get('x-nansen-credits-used');
    const creditsRemainingHeader = res.headers.get('x-nansen-credits-remaining');
    if (creditsRemainingHeader) lastCreditsRemaining = Number(creditsRemainingHeader);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let parsed: unknown = text;
      try { parsed = JSON.parse(text); } catch { /* not json */ }
      throw new NansenApiError(endpoint, res.status, parsed);
    }

    const json = (await res.json()) as T;
    return {
      data: json,
      meta: {
        creditsCost,
        creditsUsed: creditsUsedHeader ? Number(creditsUsedHeader) : null,
        creditsRemaining: creditsRemainingHeader ? Number(creditsRemainingHeader) : null,
        cacheHit: false,
      },
    };
  }
}

export interface CallOptions {
  method?: HttpMethod;
  /** Validates the response shape; a mismatch throws rather than silently
   *  passing through unknown data as if it were T. Optional so plumbing
   *  code can be written before every schema lands. */
  schema?: ZodType<unknown>;
  /** Bypasses the response cache for this one call (still respects DEMO_MODE). */
  skipCache?: boolean;
  /** Mirror the response into fixtures/ for DEMO_MODE. Default true. The
   *  scanner turns this off: it never runs in DEMO_MODE (its history ships
   *  as a compact export instead), and recording every scan's thousand-row
   *  pages grew the fixture files by ~5 MB per run. */
  record?: boolean;
}

export async function callNansen<T>(
  endpoint: string,
  body: unknown = {},
  options: CallOptions = {},
): Promise<CallResult<T>> {
  const { method = 'POST', schema, skipCache = false, record = true } = options;

  if (!skipCache) {
    const cached = readCache<T>(endpoint, body);
    if (cached) {
      recordCall(endpoint, 0, true);
      return { data: cached.value, meta: { creditsCost: 0, creditsUsed: null, creditsRemaining: null, cacheHit: true } };
    }
  }

  if (fixtureMode() === 'replay') {
    const data = replayFixture<T>(endpoint, body);
    if (schema) schema.parse(data);
    return { data, meta: { creditsCost: 0, creditsUsed: null, creditsRemaining: null, cacheHit: true } };
  }

  const result = await raw<T>(endpoint, body, method);
  if (schema) schema.parse(result.data);

  if (!skipCache) writeCache(endpoint, body, result.data);
  if (record) recordFixture(endpoint, body, result.data);
  recordCall(endpoint, result.meta.creditsCost, false);

  return result;
}
