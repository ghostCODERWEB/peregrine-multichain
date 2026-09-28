// Shared bits for the auth and key routes.
import { UserInputError } from '@/server/errors';
import { DailyBudgetExhausted } from '@/server/site';
import { contextFromRequest } from '@/server/context';

export function sameOrigin(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

export const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

/** A handler's caught error as a response with the right status: the caller's mistake is 422, a spent daily
 *  Nansen budget is 503 (retry after the reset), anything else went wrong upstream (Nansen, a missing demo
 *  fixture) and is 502. A plain 400 would tell the browser its request was malformed when it was not. */
export function failFrom(e: unknown, max = 240): Response {
  const message = (e instanceof Error ? e.message : String(e)).slice(0, max);
  if (e instanceof UserInputError) return fail(message, 422);
  if (e instanceof DailyBudgetExhausted) return Response.json({ error: message }, { status: 503, headers: { 'Retry-After': '3600' } });
  return fail(message, 502);
}

/** Served over HTTPS: the request itself, or the TLS-terminating proxy in front (Railway, Fly, nginx) says so. */
function isHttps(req: Request): boolean {
  if (new URL(req.url).protocol === 'https:') return true;
  return (req.headers.get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase() === 'https';
}

/** One httpOnly, SameSite=Lax cookie, Secure whenever the site is served over HTTPS. `maxAge` 0 clears it. */
export function cookie(req: Request, name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}${isHttps(req) ? '; Secure' : ''}`;
}

export function requireUser(req: Request) {
  const ctx = contextFromRequest(req);
  return ctx.user ? ctx : null;
}
