import { z } from 'zod';
import { sameOrigin, fail, failFrom } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { smDesk, smPerpTrades, smDcas, smHistory, parseChain, followScope, readFollows, setFollow, followedMoves } from '@/server/smart-money/desk';

export const dynamic = 'force-dynamic';

const privateHeaders = { 'Cache-Control': 'private, no-store' };
const WITHHELD = 'The smart-money desk is shown to the API key owner or a signed-in member with their own Nansen key: Nansen does not allow smart-money holdings, leaderboards, perp trades or DCAs in public views.';

const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('desk'), chain: z.string().max(20) }),
  z.object({ action: z.literal('perps') }),
  z.object({ action: z.literal('dcas') }),
  z.object({ action: z.literal('history'), chain: z.string().max(20), token: z.string().min(3).max(120) }),
  z.object({ action: z.literal('moves') }),
  z.object({ action: z.enum(['follow', 'unfollow']), address: z.string().min(3).max(120) }),
]);

export async function GET(req: Request) {
  const ctx = contextFromRequest(req);
  if (ctx.mode === 'public') return fail(WITHHELD, 403);
  const scope = followScope(ctx);
  return Response.json({ follows: scope ? readFollows(scope) : [], canFollow: !!scope }, { headers: privateHeaders });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  if (ctx.mode === 'public') return fail(WITHHELD, 403);
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Unknown desk action.');
  const a = parsed.data;
  try {
    if (a.action === 'follow' || a.action === 'unfollow') {
      const scope = followScope(ctx);
      if (!scope) return fail('Sign in to keep a follow list.', 401);
      return Response.json({ follows: setFollow(scope, a.address, a.action === 'follow', ctx.user?.id ?? null) }, { headers: privateHeaders });
    }
    // Only actions that can spend credits count against the limit.
    const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
    if (!allow(`sm-${a.action}`, who, 10)) return fail('Please wait a minute before running this again.', 429);
    const data = await contextScope.run(ctx, async () => {
      switch (a.action) {
        case 'desk': return smDesk(parseChain(a.chain));
        case 'perps': return smPerpTrades();
        case 'dcas': return smDcas();
        case 'history': return smHistory(a.chain, a.token.trim());
        case 'moves': {
          const scope = followScope(ctx);
          return followedMoves(ctx, scope ? readFollows(scope) : []);
        }
      }
    });
    return Response.json(data, { headers: privateHeaders });
  } catch (e) { return failFrom(e, 200); }
}
