// GET  /api/desk → this desk's calls and Trader DNA (free: local reads).
// POST /api/desk {action:'create', …} → saves a call with its entry receipt
//      (tgm/token-ohlcv, usually cached). {action:'grade'} → grades due calls
//      (1 credit each, at most six per request).
// A public visitor's desk lives behind an anonymous httpOnly cookie.
import crypto from 'node:crypto';
import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { cookieFrom } from '@/server/auth/session';
import { allow, clientId } from '@/server/rate';
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { SETUPS } from '@/lib/models/calls';
import { DESK_COOKIE, deskScope, createCall, deskSummary, gradeDue } from '@/server/desk/calls';

export const dynamic = 'force-dynamic';
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const Create = z.object({
  action: z.literal('create'),
  chain: z.string().refine((c) => ALL_CHAIN_IDS.includes(c), 'unknown chain'),
  token: z.string().regex(/^[A-Za-z0-9:._-]{20,160}$/),
  symbol: z.string().regex(/^[A-Za-z0-9$._-]{1,20}$/).nullish(),
  stance: z.enum(['bull', 'bear', 'pass']),
  horizon: z.enum(['1h', '24h', '7d']),
  setup: z.enum(SETUPS),
  thesis: z.string().max(200).transform(clean).nullish(),
  invalidation: z.number().positive().finite().nullish(),
  // What the three gauges read on the viewer's page when the call was saved (L2).
  gauges: z.object({ direction: z.number().int().min(-100).max(100).nullable(), confidence: z.number().int().min(0).max(100).nullable(), coordination: z.number().int().min(0).max(100).nullable() }).nullish(),
});
const Body = z.discriminatedUnion('action', [Create, z.object({ action: z.literal('grade') })]);
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request) {
  const scope = deskScope(contextFromRequest(req), cookieFrom(req.headers.get('cookie'), DESK_COOKIE));
  return Response.json(scope ? { scope: scope.split(':')[0], ...deskSummary(scope) } : { scope: null, calls: [], dna: { bySetup: [], byHorizon: [], bySource: [] } }, { headers });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Check the call: chain, token, stance, horizon and setup are required; the thesis is at most 200 characters.');
  const b = parsed.data;
  if (!allow(`desk-${b.action}`, ctx.user ? `u${ctx.user.id}` : clientId(req), b.action === 'create' ? 10 : 6)) return fail('Please wait a minute.', 429);
  let deskId = cookieFrom(req.headers.get('cookie'), DESK_COOKIE);
  let setCookie: string | null = null;
  if (!deskScope(ctx, deskId) && b.action === 'create') {
    deskId = crypto.randomBytes(18).toString('base64url');
    const secure = new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
    setCookie = `${DESK_COOKIE}=${deskId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}`;
  }
  const scope = deskScope(ctx, deskId);
  if (!scope) return fail('No desk yet: make a call first.', 404);
  try {
    const data = await contextScope.run(ctx, async () => b.action === 'create'
      ? { call: await createCall(scope, ctx, { chain: b.chain, token: b.token, symbol: b.symbol ?? null, stance: b.stance, horizon: b.horizon, setup: b.setup, thesis: b.thesis || null, invalidation: b.invalidation ?? null, gauges: b.gauges ?? null }) }
      : await gradeDue(scope));
    return Response.json(data, { headers: { ...headers, ...(setCookie ? { 'Set-Cookie': setCookie } : {}) } });
  } catch (e) { return fail((e as Error).message.slice(0, 240)); }
}
