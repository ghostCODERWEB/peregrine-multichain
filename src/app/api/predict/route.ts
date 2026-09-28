import { z } from 'zod';
import { sameOrigin, fail, failFrom } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { forMode } from '@/server/redact';
import { marketDetail, holderRecords, MARKET_ID_RE } from '@/server/predict/board';
import { marketPositions } from '@/server/predict/trader';

export const dynamic = 'force-dynamic';

const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('market'), id: z.string().regex(MARKET_ID_RE) }),
  z.object({ action: z.literal('records'), id: z.string().regex(MARKET_ID_RE), price: z.number().min(0).max(1).nullable() }),
  z.object({ action: z.literal('positions'), id: z.string().regex(MARKET_ID_RE) }),
]);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Choose a market.');
  const a = parsed.data;
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  // The records check spends ~15 credits: fewer per minute than a market.
  if (!allow(`predict-${a.action}`, who, a.action === 'market' ? 10 : 3)) return fail('Please wait a minute before running this again.', 429);
  try {
    const data = await contextScope.run(ctx, () => (a.action === 'market' ? marketDetail(a.id) : a.action === 'positions' ? marketPositions(a.id) : holderRecords(a.id, a.price)));
    return Response.json(forMode(ctx.mode, data), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return failFrom(e, 200); }
}
