// Per-request identity: who is asking, which display mode applies, and
// which Nansen key their calls use (their own for members, the instance's
// for owner and public). Server components read it through React's
// per-request cache; route handlers from the request's cookie header;
// callNansen from whichever is in scope.
import { cache } from 'react';
import { AsyncLocalStorage } from 'node:async_hooks';
import { cookieFrom, sessionUser, SESSION_COOKIE, type SessionUser } from './auth/session';
import { userApiKey, keyInfo } from './auth/keys';
import { resolveMode, type DisplayMode } from './mode';
import { getDb } from './nansen/db';

export interface RequestContext {
  mode: DisplayMode;
  user: SessionUser | null;
  /** The key this request's Nansen calls use; null = the instance key. */
  apiKey: string | null;
  keyLast4: string | null;
  keyPlan: string | null;
}

const PUBLIC_CTX: RequestContext = { mode: 'public', user: null, apiKey: null, keyLast4: null, keyPlan: null };

function build(sessionId: string | null): RequestContext {
  const user = sessionUser(sessionId);
  const info = user ? keyInfo(user.id) : null;
  const apiKey = user && info ? userApiKey(user.id) : null;
  const mode = resolveMode({
    demo: process.env.DEMO_MODE === '1',
    instancePrivate: process.env.TIDE_DISPLAY_MODE === 'private',
    userAddress: user?.address ?? null,
    ownerAddress: process.env.TIDE_OWNER_ADDRESS ?? null,
    userHasKey: !!apiKey,
  });
  // Owners use the instance key even when signed in; members use their own.
  return { mode, user, apiKey: mode === 'member' ? apiKey : null, keyLast4: info?.last4 ?? null, keyPlan: info?.plan ?? null };
}

/** Server components: memoized for the render. */
export const requestContext = cache(async (): Promise<RequestContext> => {
  try {
    const { cookies } = await import('next/headers');
    return build((await cookies()).get(SESSION_COOKIE)?.value ?? null);
  } catch {
    return { ...PUBLIC_CTX, mode: build(null).mode };
  }
});

/** A signed-in member's context without a session (their personal MCP token). */
export function contextForUser(userId: number): RequestContext {
  const user = getDb().prepare('SELECT id, family, address FROM users WHERE id = ?').get(userId) as SessionUser | undefined;
  if (!user) return { ...PUBLIC_CTX };
  const info = keyInfo(user.id);
  const apiKey = info ? userApiKey(user.id) : null;
  const mode = resolveMode({
    demo: process.env.DEMO_MODE === '1',
    instancePrivate: process.env.TIDE_DISPLAY_MODE === 'private',
    userAddress: user.address,
    ownerAddress: process.env.TIDE_OWNER_ADDRESS ?? null,
    userHasKey: !!apiKey,
  });
  return { mode, user, apiKey: mode === 'member' ? apiKey : null, keyLast4: info?.last4 ?? null, keyPlan: info?.plan ?? null };
}

/** Route handlers. */
export function contextFromRequest(req: Request): RequestContext {
  return build(cookieFrom(req.headers.get('cookie')));
}

/** Explicit scope for streams and background work started by a request. */
export const contextScope = new AsyncLocalStorage<RequestContext>();
