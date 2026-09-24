import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { viewOf } from '@/server/mode';
import { alphaRule } from '@/server/backtest/forward';
import { ALL_CHAIN_IDS } from '@/lib/registry';

export const dynamic = 'force-dynamic';
const Rule = z.object({ minScore: z.number().min(0).max(100), maxScore: z.number().min(0).max(100), chain: z.string().max(20).nullable(), horizonHours: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24)]) });

/** Strategy lab: a rule over TIDE's stored alpha history. No Nansen call. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const p = Rule.safeParse(await req.json().catch(() => null));
  if (!p.success || p.data.minScore > p.data.maxScore) return fail('Set a score range and a horizon.');
  if (p.data.chain && !ALL_CHAIN_IDS.includes(p.data.chain)) return fail('Unknown chain.');
  if (!allow('lab-rule', ctx.user ? `u${ctx.user.id}` : clientId(req), 20)) return fail('Please wait a minute.', 429);
  return Response.json(alphaRule(viewOf(ctx.mode), p.data));
}
