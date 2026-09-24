import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { audit } from '@/server/nansen/db';
import { tradeRefusal, spotQuote, spotPrepare, spotExecute, bridgeStatus, tradeSignals } from '@/server/trade/spot';
import { perpReads, perpPrepare, perpExecute, typedDataForWallet } from '@/server/trade/perp';

export const dynamic = 'force-dynamic';

const EVM = /^0x[0-9a-fA-F]{40}$/;
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('signals'), chain: z.literal('base'), token: z.string().regex(EVM) }),
  z.object({ action: z.literal('quote'), chain: z.literal('base'), side: z.enum(['buy', 'sell']), base: z.enum(['USDC', 'ETH']), token: z.string().regex(EVM), amount: z.string().regex(/^\d{1,30}$/), wallet: z.string().regex(EVM) }),
  z.object({ action: z.literal('prepare'), quoteId: z.string().min(8).max(40), wallet: z.string().regex(EVM) }),
  z.object({ action: z.literal('execute'), chain: z.literal('base'), signedTx: z.string().max(200_000), confirm: z.literal(true) }),
  z.object({ action: z.literal('bridge'), txHash: z.string().max(120), from: z.string().max(20), to: z.string().max(20), aggregator: z.string().max(20).optional() }),
  z.object({ action: z.literal('perp-state'), wallet: z.string().regex(EVM) }),
  z.object({ action: z.literal('perp-prepare'), kind: z.enum(['approve-builder-fee', 'order', 'close', 'cancel', 'leverage', 'transfer']), wallet: z.string().regex(EVM),
    order: z.object({ coin: z.string().regex(/^[A-Za-z0-9:]{1,20}$/), isBuy: z.boolean(), size: z.number().positive().max(1e9), price: z.number().positive(), slippage: z.number().min(0.001).max(0.1).optional() }).optional(),
    // Perp coins only: spot orders ("@156") share the orders list but not this venue's cancel.
    cancel: z.object({ coin: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:]{0,19}$/), orderId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).optional(),
    leverage: z.object({ coin: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:]{0,19}$/), leverage: z.number().int().min(1).max(200), isCross: z.boolean() }).optional(),
    transfer: z.object({ amount: z.number().positive().max(10_000_000), toPerp: z.boolean() }).optional() }),
  z.object({ action: z.literal('perp-execute'), id: z.string().min(8).max(40), wallet: z.string().regex(EVM), signature: z.string().max(200), confirm: z.literal(true) }),
]);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const refusal = tradeRefusal(ctx);
  if (refusal) return fail(refusal, 403);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Check the trade fields.');
  const b = parsed.data;
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  if (!allow(`trade-${b.action}`, who, b.action === 'execute' || b.action === 'perp-execute' ? 5 : 20)) return fail('Please wait a minute.', 429);
  try {
    const data = await contextScope.run(ctx, async () => {
      switch (b.action) {
        case 'signals': return tradeSignals(ctx, b.chain, b.token);
        case 'quote': return { quotes: await spotQuote(b) };
        case 'prepare': return spotPrepare(b.quoteId, b.wallet);
        case 'execute': {
          const r = await spotExecute(b.chain, b.signedTx);
          audit(ctx.user?.id ?? null, 'trade.execute', `${b.chain} ${r.txHash ?? '?'}`);
          return r;
        }
        case 'bridge': return bridgeStatus(b.txHash, b.from, b.to, b.aggregator);
        case 'perp-state': return perpReads(b.wallet);
        case 'perp-prepare': {
          if ((b.kind === 'order' || b.kind === 'close') && !b.order) throw new Error('An order needs a coin, side, size and price.');
          if (b.kind === 'cancel' && !b.cancel) throw new Error('A cancel needs the order’s coin and id.');
          if (b.kind === 'leverage' && !b.leverage) throw new Error('Leverage needs a coin, a whole number from 1 to 200, and a margin mode.');
          if (b.kind === 'transfer' && !b.transfer) throw new Error('A transfer needs an amount and a direction.');
          const account = b.kind === 'cancel' ? b.cancel : b.kind === 'leverage' ? b.leverage : b.kind === 'transfer' ? b.transfer : undefined;
          const p = await perpPrepare(b.kind, b.wallet, b.order, account);
          return { ...p, typedData: typedDataForWallet(p.eip712) };
        }
        case 'perp-execute': {
          const r = await perpExecute(b.id, b.wallet, b.signature);
          audit(ctx.user?.id ?? null, 'trade.perp', r.kind);
          return r;
        }
      }
    });
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail((e as Error).message.slice(0, 240)); }
}
