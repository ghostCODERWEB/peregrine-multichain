// Public-site guard (TIDE_PUBLIC_SITE=1; see src/server/site.ts). With the
// flag unset, requests pass through untouched.
//
//  1. Machine interfaces that would let another app spend the operator's
//     key are gone: public API, MCP, x402, sign-in, keys, trading, Smart
//     Alerts and the paid expert agent answer 404.
//  2. The remaining /api routes serve this site's own pages only: a browser
//     request must be same-origin (Sec-Fetch-Site), and a client without
//     fetch metadata must send an Origin or Referer on this host.
//  3. Per-visitor rate limits on /api and on the pages that fan out into
//     many Nansen calls (token, wallet, entity, replay, chain).
//  4. Security headers: no framing, a strict CSP (the browser only ever
//     talks to this origin; Nansen is called server-side), no sniffing.
//
// Headers can be forged by a script outside a browser, so (2) stops other
// websites and casual reuse, not a determined scraper. What bounds any
// caller is (3) plus the daily credit budget enforced in callNansen, and
// the key itself never leaves the server.
import { NextResponse, type NextRequest } from 'next/server';
import { OWNER_ONLY_PATHS } from '@/components/shell/nav';

export const config = {
  runtime: 'nodejs',
  // Everything except Next's own static assets and the bundled logos.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};

const CLOSED = [/^\/api\/public(\/|$)/, /^\/api\/mcp(\/|$)/, /^\/api\/x402(\/|$)/, /^\/api\/auth(\/|$)/, /^\/api\/keys(\/|$)/,
  /^\/api\/trade(\/|$)/, /^\/api\/alerts(\/|$)/, /^\/api\/agent(\/|$)/, /^\/api\/wallet\/labels(\/|$)/];
const HEAVY_PAGE = /^\/(token|wallet|entity|replay|chain|rug)\//;

// Generous enough for real browsing (a Radar load alone prefetches ~40
// links, and one visitor may reload it several times a minute); the daily
// credit budget, not these, is what bounds spend.
const LIMITS = { api: { max: 300, windowMs: 60_000 }, page: { max: 60, windowMs: 60_000 }, nav: { max: 600, windowMs: 60_000 } } as const;
const hits = new Map<string, { n: number; reset: number }>();

/** Fixed-window counter per visitor and bucket; true while under the limit. */
export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const h = hits.get(key);
  if (!h || now >= h.reset) {
    if (hits.size > 50_000) for (const [k, v] of hits) if (now >= v.reset) hits.delete(k);
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  h.n++;
  return h.n <= max;
}

/** The visitor's address as the reverse proxy in front of the site reports
 *  it (first X-Forwarded-For hop, else X-Real-IP). */
function visitor(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'direct';
}

/** Same-origin browser fetch, or a client whose Origin/Referer is this host. */
export function sameOrigin(req: { headers: Headers; nextUrl: { host: string } }): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const from = req.headers.get('origin') ?? req.headers.get('referer');
  if (!from) return false;
  try { return new URL(from).host === req.nextUrl.host; } catch { return false; }
}

const CSP = [
  "default-src 'self'",
  // Next's inline bootstrap and the theme script have no nonce here.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  // Token logos are Nansen-supplied URLs on arbitrary https hosts.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

function secure(res: NextResponse): NextResponse {
  res.headers.set('Content-Security-Policy', CSP);
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return res;
}

/** Shown instead of a page when one visitor opens pages very fast: styled
 *  like the app, and it retries by itself. */
const SLOW_DOWN = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="20"><title>One moment · Peregrine</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#040507;color:#fff;font:15px/1.5 system-ui,-apple-system,sans-serif"><main style="max-width:420px;padding:32px;text-align:center"><div style="font-size:12.5px;font-weight:700;color:#00FFA7">Peregrine</div><h1 style="margin:8px 0 6px;font-size:26px;letter-spacing:-.02em">One moment</h1><p style="margin:0;color:rgba(235,240,245,.72)">Lots of pages opened in a short time. This page reloads by itself in a few seconds.</p></main></body></html>`;

const deny = (status: number, error: string, extra: Record<string, string> = {}) =>
  secure(NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store', ...extra } }));

export function middleware(req: NextRequest) {
  if (process.env.TIDE_PUBLIC_SITE !== '1') return NextResponse.next();
  const path = req.nextUrl.pathname;

  if (path.startsWith('/api/')) {
    if (CLOSED.some((r) => r.test(path))) return deny(404, 'Not available on this site.');
    if (!sameOrigin(req)) return deny(403, 'This API serves the Peregrine website only.');
    // Reports from Nansen's agent cost 200 credits a run: read-only here.
    if (path === '/api/anchor' && req.method !== 'GET') return deny(403, 'Market briefs are read-only on this site.');
    if (!allow(`api:${visitor(req)}`, LIMITS.api.max, LIMITS.api.windowMs)) return deny(429, 'Too many requests. Try again in a minute.', { 'Retry-After': '60' });
    return secure(NextResponse.next());
  }

  // Accounts, and pages whose content is owner-only or needs a wallet or a
  // paid key action: nothing there for a visitor, so go home.
  if (/^\/(account|login)(\/|$)/.test(path) || OWNER_ONLY_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return secure(NextResponse.redirect(new URL('/', req.url)));
  // Next strips its router headers before middleware runs, so prefetches
  // are told apart by fetch metadata: in-app navigations and the Radar's
  // many link prefetches are fetch()es ('empty') and get a larger bucket;
  // full page loads, and clients that send no metadata, get the tight one.
  if (HEAVY_PAGE.test(path)) {
    const inApp = req.headers.get('sec-fetch-dest') === 'empty';
    const [bucket, lim] = inApp ? ['nav', LIMITS.nav] as const : ['page', LIMITS.page] as const;
    if (!allow(`${bucket}:${visitor(req)}`, lim.max, lim.windowMs)) {
      return secure(new NextResponse(SLOW_DOWN, { status: 429, headers: { 'Retry-After': '60', 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }));
    }
  }
  return secure(NextResponse.next());
}
