import { NextResponse } from 'next/server';
import { tokenVerdict, verdictAi } from '@/server/token/verdict';

export const dynamic = 'force-dynamic';

/** GET ?chain=&address=[&ai=1] → the token's verdict from stored reads; ai=1 also writes (or returns the cached) AI sentence. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '', address = q.get('address') ?? '';
  if (!/^[a-z0-9-]{2,20}$/.test(chain) || !/^[A-Za-z0-9:._-]{20,160}$/.test(address)) return NextResponse.json({ error: 'bad token' }, { status: 400 });
  const v = tokenVerdict(chain, address);
  if (!v.pending && q.get('ai') === '1' && !v.ai) {
    const ai = await verdictAi(chain, address, v).catch(() => null);
    if (ai) v.ai = ai;
  }
  return NextResponse.json(v, { headers: { 'cache-control': 'no-store' } });
}
