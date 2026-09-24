// GET  /api/follow?chain=&token= → candidate events (free) and the last report (cached an hour).
// POST /api/follow {chain, token, confirmCredits} → runs the follow-through study
//      (up to FOLLOW_CREDITS credits). Owner only: the events are the instance's
//      restricted smart-money tape.
import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { FOLLOW_CREDITS, cachedFollow, followCandidates, runFollow } from '@/server/smart-money/follow';

export const dynamic = 'force-dynamic';
const Target = z.object({ chain: z.string().refine((c) => ALL_CHAIN_IDS.includes(c)), token: z.string().regex(/^[A-Za-z0-9:._-]{20,160}$/) });
const headers = { 'Cache-Control': 'private, no-store' };
const refusal = 'Follow-through reads this instance’s own smart-money tape, which Nansen’s rules keep private to its owner.';

export async function GET(req: Request) {
  if (contextFromRequest(req).mode !== 'owner') return fail(refusal, 403);
  const q = new URL(req.url).searchParams;
  const t = Target.safeParse({ chain: q.get('chain'), token: q.get('token') });
  if (!t.success) return fail('Choose a chain and token.');
  const c = followCandidates(t.data.chain, t.data.token);
  return Response.json({ candidates: { events: c.events.length, buys: c.buys }, report: cachedFollow(t.data.chain, t.data.token), maxCredits: FOLLOW_CREDITS }, { headers });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  if (ctx.mode !== 'owner') return fail(refusal, 403);
  const b = Target.extend({ confirmCredits: z.literal(FOLLOW_CREDITS) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return fail(`Confirm up to ${FOLLOW_CREDITS} credits for this study.`, 428);
  if (!allow('follow', clientId(req), 3)) return fail('Please wait a minute.', 429);
  try {
    return Response.json({ report: await contextScope.run(ctx, () => runFollow(b.data.chain, b.data.token)) }, { headers });
  } catch (e) { return fail((e as Error).message.slice(0, 240), 422); }
}
