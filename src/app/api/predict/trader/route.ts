import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { forMode } from '@/server/redact';
import { pmTrader } from '@/server/predict/trader';

export const dynamic = 'force-dynamic';

/** GET ?address=0x… → the wallet's Polymarket record (via Nansen). */
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const address = new URL(req.url).searchParams.get('address') ?? '';
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return fail('Polymarket profiles need an EVM address.');
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  if (!allow('pm-trader', who, 20)) return fail('Please wait a minute.', 429);
  try { return Response.json(forMode(ctx.mode, await contextScope.run(ctx, () => pmTrader(address))), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (e) { return fail((e as Error).message.slice(0, 200), 502); }
}
