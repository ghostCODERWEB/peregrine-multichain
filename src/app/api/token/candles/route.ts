import { NextResponse } from 'next/server';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { RANGES, tokenCandles, type Range } from '@/server/token/candles';

export const dynamic = 'force-dynamic';

/** Price candles for a token at a chosen range: ?chain=&address=&range=1H|4H|1D|1W|1M|3M|1Y */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '', address = q.get('address') ?? '', range = (q.get('range') ?? '1W') as Range;
  if (!/^[a-z0-9-]{2,20}$/.test(chain) || !address || address.length > 120 || !(range in RANGES)) return NextResponse.json({ error: 'Choose a token and range.' }, { status: 400 });
  if (!allow('candles', clientId(req), 30)) return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
  const ctx = contextFromRequest(req);
  try {
    const out = await contextScope.run(ctx, () => tokenCandles(chain, address, range));
    return NextResponse.json(out, { headers: { 'cache-control': 'private, max-age=60' } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 200) }, { status: 502 });
  }
}
