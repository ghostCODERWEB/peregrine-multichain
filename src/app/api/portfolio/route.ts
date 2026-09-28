import { z } from 'zod';
import { sameOrigin, fail, failFrom } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { portfolio, portfolioStress } from '@/server/portfolio/portfolio';
import { readWatchset, saveWatchset, watchScope } from '@/server/portfolio/watchset';
import { forMode } from '@/server/redact';
import { portfolioCounterparties } from '@/server/portfolio/counterparties';
import { detectAddress } from '@/lib/address-family';

export const dynamic = 'force-dynamic';
const input = z.object({ action: z.enum(['analyze', 'stress', 'save', 'counterparties']), addresses: z.array(z.string().max(120)).max(5) });
const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request) {
  const ctx = contextFromRequest(req), scope = watchScope(ctx);
  return Response.json({ addresses: scope ? readWatchset(scope) : [], canSave: !!scope }, { headers: privateHeaders });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Choose an action and up to five wallet addresses.');
  const { action, addresses } = parsed.data;
  try {
    if (action === 'save') {
      const scope = watchScope(ctx);
      if (!scope) return fail('Sign in to save a private watch set.', 401);
      return Response.json({ addresses: saveWatchset(scope, addresses, ctx.user?.id ?? null) }, { headers: privateHeaders });
    }
    // Only requests that will spend Nansen credits count against the limit,
    // each action on its own budget, and only once the input is valid.
    if (!addresses.length || addresses.some((a) => !detectAddress(a).length)) return fail('Every line must be a wallet address.');
    if (!allow(`portfolio-${action}`, ctx.user ? `u${ctx.user.id}` : clientId(req), 6)) return fail('Please wait a minute before running this again.', 429);
    const data = await contextScope.run(ctx, async () => action === 'stress' ? portfolioStress(addresses) : action === 'counterparties' ? portfolioCounterparties(addresses) : portfolio(addresses));
    return Response.json(forMode(ctx.mode, data), { headers: privateHeaders });
  } catch (e) { return failFrom(e, 200); }
}
