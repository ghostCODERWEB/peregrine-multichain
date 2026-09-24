import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { validated } from '@/server/portfolio/portfolio';
import { S_ProfilerAddressLabelsResponse } from '@/types/nansen/api.gen';
import { contractSupports } from '@/server/nansen/support';
import { walletAddresses } from '@/lib/models/portfolio';
import { audit } from '@/server/nansen/db';

export const dynamic = 'force-dynamic';
const input = z.object({ address: z.string().max(120), chain: z.string(), premium: z.boolean(), confirmCredits: z.number() });
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  if (ctx.mode === 'public') return fail('Labels are available only with your own Nansen key.', 403);
  const r = input.safeParse(await req.json().catch(() => null));
  if (!r.success) return fail('Choose an address and explicitly confirm the displayed credit price.');
  const { address, chain, premium, confirmCredits } = r.data;
  const price = premium ? 500 : 100;
  if (confirmCredits !== price) return fail(`Confirm the ${price}-credit lookup.`, 428);
  if (!contractSupports('POST /api/v1/profiler/address/labels', chain)) return fail('Labels are not available on this chain.');
  if (!allow('labels', ctx.user ? `u${ctx.user.id}` : clientId(req), 2)) return fail('Wait a minute before another label lookup.', 429);
  try {
    if (!walletAddresses([address]).length) return fail('Enter a wallet address.');
    const endpoint = `profiler/address/${premium ? 'premium-labels' : 'labels'}`;
    audit(ctx.user?.id ?? null, 'wallet.labels.request', JSON.stringify({ address, chain, price }));
    const result = await contextScope.run(ctx, () => validated(endpoint, { address, chain, pagination: { page: 1, per_page: 100 } }, S_ProfilerAddressLabelsResponse));
    return Response.json({ labels: result.data.data, call: result.call, limited: result.data.pagination.is_last_page === false }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail((e as Error).message.slice(0, 200)); }
}
