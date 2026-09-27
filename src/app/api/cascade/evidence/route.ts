import { NextResponse } from 'next/server';
import { cascades, cascadeView } from '@/server/cascade/cascades';
import { modeFromRequest } from '@/server/mode';
import { walletName } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';

/** One wallet's Cascade evidence (?wallet=), loaded when it is selected on the map. Owner view only: it reads Smart Money trades. */
export async function GET(req: Request) {
  if (modeFromRequest(req) !== 'owner') return NextResponse.json({ evidence: [] }, { status: 403 });
  const wallet = new URL(req.url).searchParams.get('wallet') ?? '';
  return NextResponse.json({ evidence: cascadeView(cascades(), walletName).evidence[wallet] ?? [] });
}
