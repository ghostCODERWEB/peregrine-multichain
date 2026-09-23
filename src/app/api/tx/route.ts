// GET /api/tx?chain=&hash=&ts= → one transaction with its token transfers
// (transaction-with-token-transfer-lookup, 1 credit, on click). Labels are
// stripped in public views.
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { txLookup } from '@/server/token/ondemand';
import { contextFromRequest, contextScope } from '@/server/context';
import { forMode } from '@/server/redact';
import { allow, clientId } from '@/server/rate';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!allow('tx', clientId(req), 30)) return Response.json({ error: 'Too many lookups; wait a minute.' }, { status: 429 });
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '', hash = q.get('hash') ?? '', ts = q.get('ts');
  if (!ALL_CHAIN_IDS.includes(chain) || !/^[A-Za-z0-9]{20,140}$/.test(hash)) return Response.json({ error: 'bad transaction' }, { status: 400 });
  const ctx = contextFromRequest(req);
  const r = await contextScope.run(ctx, () => txLookup(chain, hash, ts && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/.test(ts) ? ts : null));
  return Response.json(forMode(ctx.mode, r));
}
