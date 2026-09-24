import { z } from 'zod';
import { walletAddresses } from '@/lib/models/portfolio';
import { walletDesk } from '@/server/wallet/desk';
import { contextFromRequest, contextScope } from '@/server/context';
import { callScope } from '@/server/nansen/client';
import { forMode } from '@/server/redact';
import { sameOrigin, fail } from '@/server/auth/http';
import { allow, clientId } from '@/server/rate';
import { ALL_CHAIN_IDS } from '@/lib/registry';

export const dynamic = 'force-dynamic';
const input = z.object({ address: z.string().max(120), chain: z.string(), section: z.enum(['pnl', 'dex', 'defi', 'perps', 'prediction', 'history', 'points']) });
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  if (!allow('wallet-desk', ctx.user ? `u${ctx.user.id}` : clientId(req), 12)) return fail('Wait a minute before loading another section.', 429);
  const r = input.safeParse(await req.json().catch(() => null));
  if (!r.success || !ALL_CHAIN_IDS.includes(r.data.chain)) return fail('Choose a wallet, supported chain and section.');
  try {
    const [address] = walletAddresses([r.data.address]);
    if (!address) return fail('Enter a wallet address.');
    const tally = { calls: 0, credits: 0, cached: 0 };
    const data = await contextScope.run(ctx, () => callScope.run(tally, () => walletDesk(address, r.data.chain, r.data.section)));
    return Response.json({ ...forMode(ctx.mode, data), tally }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail((e as Error).message.slice(0, 240)); }
}
