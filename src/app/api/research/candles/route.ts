import { NextResponse } from 'next/server';
import { allow, clientId } from '@/server/rate';
import { hlCandles } from '@/server/research/hyperliquid';

export const dynamic = 'force-dynamic';

/** Hyperliquid market candles for a period: ?coin=&start=&end= (ms). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const coin = q.get('coin') ?? '', start = Number(q.get('start')), end = Number(q.get('end') ?? Date.now());
  if (!/^[A-Za-z0-9:]{1,24}$/.test(coin) || !Number.isFinite(start) || !(end > start)) return NextResponse.json({ error: 'Choose a market and period.' }, { status: 400 });
  if (!allow('research-candles', clientId(req), 60)) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  try { return NextResponse.json(await hlCandles(coin, start, end), { headers: { 'cache-control': 'private, max-age=60' } }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 502 }); }
}
