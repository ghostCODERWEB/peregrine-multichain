import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { forMode } from '@/server/redact';
import { SYMBOL_RE } from '@/server/perps/detail';
import { perpChanges, perpTerminal } from '@/server/perps/terminal';

export const dynamic = 'force-dynamic';

const WINDOWS: Record<string, number> = { '15m': 15 * 60_000, '1h': 3_600_000, '4h': 4 * 3_600_000, '24h': 86_400_000, '7d': 7 * 86_400_000 };

/** GET ?symbol=BTC            → observed positions, trades, snapshot times
 *  GET ?symbol=BTC&changes=1h → What Changed against the stored snapshot ~1h earlier (no Nansen call) */
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') ?? '').toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return fail('Choose a coin symbol.');
  const windowKey = url.searchParams.get('changes');
  const priv = ctx.mode !== 'public';
  const headers = { 'Cache-Control': 'private, no-store' };
  if (windowKey) {
    const ms = WINDOWS[windowKey];
    if (!ms) return fail(`Window must be one of ${Object.keys(WINDOWS).join(', ')}.`);
    return Response.json(forMode(ctx.mode, perpChanges(symbol, ms)), { headers });
  }
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  if (!allow('perps-terminal', who, 20)) return fail('Please wait a minute before loading more coins.', 429);
  try {
    const data = await contextScope.run(ctx, () => perpTerminal(symbol, priv));
    return Response.json(forMode(ctx.mode, data), { headers });
  } catch (e) {
    return fail((e as Error).message.slice(0, 200), 502);
  }
}
