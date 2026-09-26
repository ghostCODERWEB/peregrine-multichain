import { NextResponse } from 'next/server';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { forMode } from '@/server/redact';
import { traderWorkspace } from '@/server/research/hyperliquid';

export const dynamic = 'force-dynamic';

/** A public Hyperliquid trader's workspace: positions, account history, fills as position events, closed positions, analytics. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get('address') ?? '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: 'Enter a 0x address: Hyperliquid accounts are EVM addresses.' }, { status: 400 });
  if (!allow('research-trader', clientId(req), 20)) return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
  const ctx = contextFromRequest(req);
  const data = await contextScope.run(ctx, () => traderWorkspace(address));
  return NextResponse.json(forMode(ctx.mode, data), { headers: { 'cache-control': 'private, max-age=30' } });
}
