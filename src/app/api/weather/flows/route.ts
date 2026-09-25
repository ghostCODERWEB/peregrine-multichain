import { NextResponse } from 'next/server';
import { capitalFlows } from '@/server/weather/bulletin';
import { modeFromRequest, viewOf } from '@/server/mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/weather/flows?hours=24|48|168 — chain-to-chain capital rotations
// for the Radar's flow map. Read from Peregrine's own stored trades: no
// Nansen call, no credits. Owner view only; everyone else gets 403.
export async function GET(req: Request) {
  const hours = Number(new URL(req.url).searchParams.get('hours') ?? 24);
  const flows = capitalFlows(viewOf(modeFromRequest(req)), hours);
  if (!flows) {
    return NextResponse.json(
      { error: 'Capital rotations are built from Nansen smart-money DEX trades, which stay out of public views. Use a Peregrine instance with your own Nansen key.' },
      { status: 403, headers: { 'cache-control': 'no-store' } },
    );
  }
  return NextResponse.json(flows, { headers: { 'cache-control': 'private, no-store' } });
}
