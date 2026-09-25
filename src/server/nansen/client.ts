// The one function every Nansen call in this app goes through. Handles
// auth, rate limiting, retry-on-429 honoring Retry-After, the response
// cache, the credit ledger, and DEMO_MODE record/replay — so every route,
// the scanner, and the backtest pipeline inherit all of it for free instead
// of each having to remember the rules.
import { z, type ZodType } from 'zod';
import { AsyncLocalStorage } from 'node:async_hooks';
import { getLimiter, type NansenPlan } from './limiter';
import { readCache, writeCache } from './cache';
import { recordCall, webCreditsToday } from './ledger';
import { inWebServer, publicSite, webDailyCreditCap, DailyBudgetExhausted } from '@/server/site';
import { recordError, checkDriftLater } from './health';
import { setKv } from './db';
import { recordFixture, replayFixture, replayLatest, fixtureMode } from './demo';
import { AgentStreamEvent, AGENT_STREAM_DONE_SENTINEL } from '@/types/nansen/agent';

const HOST = 'https://api.nansen.ai/api';

/** Nansen's public rewards API is keyless. Keep it in the same data layer
 * with a bounded URL, cache, demo replay and ledger; never attach API keys. */
export async function callNansenPoints(address: string): Promise<{ tier: string; points: number | null }> {
  if (!/^[A-Za-z0-9]{20,100}$/.test(address)) throw new Error('Points require an EVM or Solana wallet address.');
  const endpoint = 'points/tier',
    body = { address };
  const cached = readCache<{ tier: string; points?: number | null }>(endpoint, body);
  const tally = callScope.getStore();
  if (tally) tally.calls++;
  if (cached) {
    if (tally) tally.cached++;
    return { points: null, ...cached.value };
  }
  if (fixtureMode() === 'replay') {
    if (tally) tally.cached++;
    return { points: null, ...replayFixture<{ tier: string; points?: number | null }>(endpoint, body) };
  }
  await getLimiter(plan()).acquire();
  const response = await fetch(`https://app.nansen.ai/api/points-leaderboard/${encodeURIComponent(address)}`, {
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Nansen rewards lookup returned ${response.status}.`);
  const data: unknown = await response.json();
  const parsed = z
    .object({
      tier: z
        .string()
        .transform((s) => s.toLowerCase())
        .pipe(z.enum(['none', 'green', 'ice', 'north', 'star'])),
      points: z.number().finite().nonnegative().nullish(),
    })
    .safeParse(data);
  if (!parsed.success) throw new Error('Nansen rewards response could not be read.');
  const result = { tier: parsed.data.tier, points: parsed.data.points ?? null };
  writeCache(endpoint, body, result);
  if (!(await currentCaller()).userId && !publicSite()) recordFixture(endpoint, body, result);
  recordCall(endpoint, 0, false);
  return result;
}

export interface PointsPage {
  total: number;
  rows: Array<{ points: number; rank: number; tier: string; eligible: boolean }>;
}
export const POINTS_PAGE_SIZE = 1000;
const S_PointsPage = z.object({
  total: z.number().int().nonnegative(),
  results: z.array(
    z.object({ points: z.number().finite(), rank: z.number().int().positive(), tier: z.string().max(40), is_eligible: z.boolean() }),
  ),
});

/** One page of Nansen's public, keyless points leaderboard. Its offset is
 * page × recordsPerPage, so page 1 starts at rank 1,001 and the top 1,000 can't
 * be read (page 0 is refused). Wallet addresses are dropped before caching. */
export async function callNansenPointsPage(page: number): Promise<PointsPage> {
  if (!Number.isInteger(page) || page < 1 || page > 10_000) throw new Error('Leaderboard page out of range.');
  const endpoint = 'points/leaderboard',
    body = { page, per: POINTS_PAGE_SIZE };
  const cached = readCache<PointsPage>(endpoint, body);
  const tally = callScope.getStore();
  if (tally) tally.calls++;
  if (cached) {
    if (tally) tally.cached++;
    return cached.value;
  }
  if (fixtureMode() === 'replay') {
    if (tally) tally.cached++;
    return replayFixture<PointsPage>(endpoint, body);
  }
  await getLimiter(plan()).acquire();
  const response = await fetch(
    `https://app.nansen.ai/api/points-leaderboard/api?isEligible=all&page=${page}&recordsPerPage=${POINTS_PAGE_SIZE}`,
    { signal: AbortSignal.timeout(15_000), cache: 'no-store' },
  );
  if (!response.ok) throw new Error(`Nansen points leaderboard returned ${response.status}.`);
  const parsed = S_PointsPage.safeParse(await response.json());
  if (!parsed.success) throw new Error('Nansen points leaderboard could not be read.');
  const result: PointsPage = {
    total: parsed.data.total,
    rows: parsed.data.results.map((r) => ({ points: r.points, rank: r.rank, tier: r.tier, eligible: r.is_eligible })),
  };
  // Not recorded as a fixture: ~130 KB a page, and the demo doesn't need it.
  writeCache(endpoint, body, result);
  recordCall(endpoint, 0, false);
  return result;
}

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

async function raw<T>(endpoint: string, body: unknown, method: HttpMethod, apiKey: string | undefined): Promise<CallResult<T>> {
  if (!apiKey) {
    throw new Error(`NANSEN_API_KEY is not set. Set it in .env, or run with DEMO_MODE=1 to replay recorded fixtures instead.`);
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
    if (creditsRemainingHeader) {
      lastCreditsRemaining = Number(creditsRemainingHeader);
      try {
        setKv('credits_remaining', creditsRemainingHeader);
      } catch {
        /* db busy: next call will record it */
      }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* not json */
      }
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
  /** The caller vouches this response is public-class data even though the
   *  endpoint's class is restricted (e.g. tgm/perp-positions for all
   *  traders, without a smart-money filter): it may be recorded as a
   *  fixture, labels still stripped. */
  publicSafe?: boolean;
}

/** Per-request tally: run a page's work inside `callScope.run(tally, fn)`
 *  and every Nansen call it makes (cached or not) is counted — how the
 *  token page reports exactly what it cost. */
export interface CallTally {
  calls: number;
  credits: number;
  cached: number;
}
export const callScope = new AsyncLocalStorage<CallTally>();

/**
 * Whose key a call uses: an explicit context scope (streams), else the
 * current request's context (server components, route handlers), else —
 * outside any request (the scanner, scripts) — the instance key.
 */
async function currentCaller(): Promise<{ apiKey: string | undefined; userId: number | null }> {
  try {
    const { contextScope, requestContext } = await import('@/server/context');
    const ctx = contextScope.getStore() ?? (await requestContext());
    if (ctx.mode === 'member' && ctx.apiKey && ctx.user) return { apiKey: ctx.apiKey, userId: ctx.user.id };
  } catch {
    /* no request in scope */
  }
  return { apiKey: process.env.NANSEN_API_KEY, userId: null };
}

/** A visitor request in the web server (public site, or any instance with
 *  WEB_DAILY_CREDIT_CAP set), with today's visitor spend at or over the
 *  cap. The scanner worker and scripts keep their own budgets
 *  (SCAN_INTERVAL_MIN, *_CREDIT_CAP) and never hit this. */
function overWebBudget(reserve = 0): boolean {
  if (!inWebServer() || !(publicSite() || process.env.WEB_DAILY_CREDIT_CAP)) return false;
  // `reserve`: a known-expensive call (an agent run) must fit entirely, so
  // one call can't carry the day's spend past the cap.
  return webCreditsToday() + reserve >= webDailyCreditCap();
}

export async function callNansen<T>(endpoint: string, body: unknown = {}, options: CallOptions = {}): Promise<CallResult<T>> {
  const { method = 'POST', schema, skipCache = false } = options;
  const caller = await currentCaller();
  // A member's calls use their own key, their own cache partition and
  // ledger rows, and are never recorded into published fixtures.
  // A public site never writes demo fixtures: they live in the code
  // checkout, and a server should not rewrite its own repository.
  const record = (options.record ?? true) && !caller.userId && !publicSite();
  const scope = caller.userId ? `u${caller.userId}` : null;

  if (!skipCache) {
    const cached = readCache<T>(endpoint, body, scope);
    if (cached) {
      recordCall(endpoint, 0, true, caller.userId);
      const t = callScope.getStore();
      if (t) {
        t.calls++;
        t.cached++;
      }
      return { data: cached.value, meta: { creditsCost: 0, creditsUsed: null, creditsRemaining: null, cacheHit: true } };
    }
  }

  if (fixtureMode() === 'replay') {
    const data = replayFixture<T>(endpoint, body);
    const t = callScope.getStore();
    if (t) {
      t.calls++;
      t.cached++;
    }
    if (schema) schema.parse(data);
    return { data, meta: { creditsCost: 0, creditsUsed: null, creditsRemaining: null, cacheHit: true } };
  }

  // Visitor traffic on the instance key shares one daily budget. Past it,
  // serve the last known response if there is one, else say why.
  if (!caller.userId && overWebBudget()) {
    const stale = readCache<T>(endpoint, body, scope, { stale: true });
    if (stale) {
      recordCall(endpoint, 0, true, null);
      const t = callScope.getStore();
      if (t) {
        t.calls++;
        t.cached++;
      }
      return { data: stale.value, meta: { creditsCost: 0, creditsUsed: null, creditsRemaining: null, cacheHit: true } };
    }
    throw new DailyBudgetExhausted(webDailyCreditCap());
  }

  let result: CallResult<T>;
  try {
    result = await raw<T>(endpoint, body, method, caller.apiKey);
  } catch (e) {
    recordError(endpoint, e instanceof NansenApiError ? e.status : null, (e as Error).message ?? String(e), caller.userId);
    throw e;
  }
  checkDriftLater(endpoint, method, result.data);
  if (schema) schema.parse(result.data);

  if (!skipCache) writeCache(endpoint, body, result.data, scope);
  if (record) recordFixture(endpoint, body, result.data, options.publicSafe ?? false);
  recordCall(endpoint, result.meta.creditsCost, false, caller.userId);
  const tally = callScope.getStore();
  if (tally) {
    tally.calls++;
    tally.credits += result.meta.creditsCost;
  }

  return result;
}

/**
 * Streaming variant for the agent endpoints (text/event-stream): yields
 * each validated event as Nansen sends it, stops at the literal
 * `data: [DONE]`. Same auth, limiter, ledger and DEMO_MODE recording as
 * callNansen — the whole event list is recorded once the stream ends, and
 * replayed event by event without a key.
 */
export async function* streamNansen(endpoint: string, body: unknown, opts: { record?: boolean } = {}): AsyncGenerator<AgentStreamEvent> {
  if (fixtureMode() === 'replay') {
    const events = replayLatest<AgentStreamEvent[]>(endpoint);
    if (!events) throw new Error(`No recorded ${endpoint} stream to replay in DEMO_MODE.`);
    for (const e of events) yield e;
    return;
  }
  const caller = await currentCaller();
  const apiKey = caller.apiKey;
  if (!apiKey) throw new Error('NANSEN_API_KEY is not set. Set it in .env, or run with DEMO_MODE=1.');
  // Agent runs cost 200–750 credits: reserve the cheaper price up front.
  if (!caller.userId && overWebBudget(200)) throw new DailyBudgetExhausted(webDailyCreditCap());
  await getLimiter(plan()).acquire();
  const res = await fetch(urlFor(endpoint), {
    method: 'POST',
    headers: { apikey: apiKey, 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
    cache: 'no-store',
  });
  const cost = Number(res.headers.get('x-nansen-credits-cost') ?? 0);
  const remaining = res.headers.get('x-nansen-credits-remaining');
  if (remaining) {
    lastCreditsRemaining = Number(remaining);
    try {
      setKv('credits_remaining', remaining);
    } catch {
      /* next call */
    }
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    recordError(endpoint, res.status, text, caller.userId);
    throw new NansenApiError(endpoint, res.status, text);
  }
  recordCall(endpoint, cost, false, caller.userId);
  const tally = callScope.getStore();
  if (tally) {
    tally.calls++;
    tally.credits += cost;
  }

  const seen: AgentStreamEvent[] = [];
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === AGENT_STREAM_DONE_SENTINEL) return;
        let json: unknown;
        try {
          json = JSON.parse(payload);
        } catch {
          continue;
        }
        const parsed = AgentStreamEvent.safeParse(json);
        if (!parsed.success) continue; // an event shape the docs don't list: skip, never guess
        seen.push(parsed.data);
        yield parsed.data;
      }
    }
  } finally {
    if (seen.length && opts.record && !caller.userId && !publicSite()) recordFixture(endpoint, body, seen, true);
  }
}
