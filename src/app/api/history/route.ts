import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { forMode } from '@/server/redact';
import { DAY, TOKEN_PART_CREDITS, TX_LOOKUP_CHAINS, WALLET_ASOF_CHAINS, screenerAsOf, tokenAsOf, transactionAsOf, walletAsOf, type TokenPart } from '@/server/history/point-in-time';

export const dynamic = 'force-dynamic';
const ADDR = /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/;
const CHAIN = /^[a-z0-9-]{2,20}$/;

/**
 * Point-in-time Nansen reads (v1beta1 historical family), cached permanently.
 *   ?kind=token&part=flows|traders|trades|holders|pnl&chain=&address=&date=
 *   ?kind=wallet&address=&chain=all&date=
 *   ?kind=tx&chain=&hash=&at=<block ISO>&asOf=
 *   ?kind=screener&date=&chains=a,b&days=1
 */
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const u = new URL(req.url);
  const q = (k: string) => u.searchParams.get(k) ?? '';
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  if (!allow('history', who, 12)) return fail('Please wait a minute before more historical reads.', 429);
  const date = q('date') || q('asOf');
  if (date && (!DAY.test(date) || date >= new Date().toISOString().slice(0, 10))) return fail('Choose a past date (YYYY-MM-DD, before today).');
  const reply = async <T,>(fn: () => Promise<T>) => {
    try { return Response.json(forMode(ctx.mode, await contextScope.run(ctx, fn)), { headers: { 'Cache-Control': 'private, no-store' } }); }
    catch (e) { return fail((e as Error).message.slice(0, 220), 502); }
  };
  switch (q('kind')) {
    case 'token': {
      const part = q('part') as TokenPart;
      if (!(part in TOKEN_PART_CREDITS) || !CHAIN.test(q('chain')) || !ADDR.test(q('address')) || !date) return fail('Token history needs part, chain, address and date.');
      if (part === 'pnl' && ctx.mode === 'public') return fail('Nansen allows the PnL leaderboard only in the key owner\'s view.', 403);
      return reply(() => tokenAsOf(part, q('chain'), q('address'), date));
    }
    case 'wallet':
      if (!ADDR.test(q('address')) || !WALLET_ASOF_CHAINS.includes(q('chain') || 'all') || !date) return fail(`Wallet history needs an address, a date and a chain (${WALLET_ASOF_CHAINS.join(', ')}).`);
      return reply(() => walletAsOf(q('address'), q('chain') || 'all', date));
    case 'tx':
      if (!TX_LOOKUP_CHAINS.includes(q('chain'))) return fail(`Historical transaction lookup covers ${TX_LOOKUP_CHAINS.join(', ')}.`);
      if (!/^0x[a-fA-F0-9]{64}$/.test(q('hash'))) return fail('That is not a transaction hash.');
      return reply(() => transactionAsOf(q('chain'), q('hash'), q('at') || null, date || null));
    case 'screener': {
      const chains = q('chains').split(',').filter((c) => CHAIN.test(c));
      if (!date || !chains.length) return fail('Screener history needs a date and at least one chain.');
      return reply(() => screenerAsOf(date, chains.slice(0, 8), Math.min(30, Math.max(1, Number(q('days')) || 1)), q('sm') === '1' && ctx.mode !== 'public'));
    }
    default:
      return fail('Unknown history kind.');
  }
}
