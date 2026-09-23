// Shared bits for the auth and key routes.
import { contextFromRequest } from '@/server/context';

export function sameOrigin(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

export const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

export function requireUser(req: Request) {
  const ctx = contextFromRequest(req);
  return ctx.user ? ctx : null;
}
