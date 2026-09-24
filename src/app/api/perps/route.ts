import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { forMode } from '@/server/redact';
import { coinDetail, perpLeaders, SYMBOL_RE } from '@/server/perps/detail';

export const dynamic = 'force-dynamic';

const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('coin'), symbol: z.string().regex(SYMBOL_RE) }),
  z.object({ action: z.literal('leaders') }),
]);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Choose a coin symbol.');
  const a = parsed.data;
  const priv = ctx.mode !== 'public';
  if (a.action === 'leaders' && !priv) return fail('The trader leaderboard is shown to the API key owner or a signed-in member with their own key: Nansen does not allow it in public views.', 403);
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  if (!allow(`perps-${a.action}`, who, a.action === 'coin' ? 12 : 4)) return fail('Please wait a minute before running this again.', 429);
  try {
    const data = await contextScope.run(ctx, () => (a.action === 'coin' ? coinDetail(a.symbol, priv) : perpLeaders()));
    return Response.json(forMode(ctx.mode, data), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail((e as Error).message.slice(0, 200)); }
}
