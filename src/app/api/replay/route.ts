import { cookie } from '@/server/auth/http';
import crypto from 'node:crypto';
import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { cookieFrom } from '@/server/auth/session';
import { allow, clientId } from '@/server/rate';
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { SETUPS } from '@/lib/models/calls';
import { DESK_COOKIE, deskScope } from '@/server/desk/calls';
import { prepareReplay, lockReplay } from '@/server/desk/replay';

export const dynamic = 'force-dynamic';
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('prepare'), chain: z.string().refine((c) => ALL_CHAIN_IDS.includes(c)), token: z.string().regex(/^[A-Za-z0-9:._-]{20,160}$/), horizon: z.enum(['1h', '24h', '7d']), confirmCredits: z.literal(1) }),
  z.object({ action: z.literal('lock'), id: z.string().regex(/^[A-Za-z0-9_-]{32}$/), stance: z.enum(['bull', 'bear', 'pass']), setup: z.enum(SETUPS), thesis: z.string().max(200).transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()).nullish(), invalidation: z.number().positive().finite().nullish() }),
]);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const input = Body.safeParse(await req.json().catch(() => null));
  if (!input.success) return fail('Choose a replay window and confirm its one-credit maximum, or lock a valid decision.');
  const ctx = contextFromRequest(req), b = input.data;
  if (!allow(`replay-${b.action}`, ctx.user ? `u${ctx.user.id}` : clientId(req), b.action === 'prepare' ? 4 : 12)) return fail('Please wait a minute.', 429);
  let deskId = cookieFrom(req.headers.get('cookie'), DESK_COOKIE), setCookie: string | null = null;
  if (!deskScope(ctx, deskId) && b.action === 'prepare') {
    deskId = crypto.randomBytes(18).toString('base64url');
    setCookie = cookie(req, DESK_COOKIE, deskId, 31_536_000);
  }
  const scope = deskScope(ctx, deskId);
  if (!scope) return fail('Prepare a replay in this browser first.', 404);
  const headers = { 'Cache-Control': 'private, no-store', ...(setCookie ? { 'Set-Cookie': setCookie } : {}) };
  try {
    const data = await contextScope.run(ctx, () => b.action === 'prepare'
      ? prepareReplay(scope, ctx, b.chain, b.token, b.horizon)
      : lockReplay(scope, ctx, b.id, b.stance, b.setup, b.thesis || null, b.invalidation ?? null));
    return Response.json(data, { headers });
  } catch (e) { return Response.json({ error: (e as Error).message.slice(0, 240) }, { status: 400, headers }); }
}
