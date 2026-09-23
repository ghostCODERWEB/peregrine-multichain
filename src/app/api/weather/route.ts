import { NextResponse } from 'next/server';
import { buildBulletin } from '@/server/weather/bulletin';
import { modeFromRequest } from '@/server/mode';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Served from TIDE's own scanner history — no Nansen call per request, so
// polling this costs nothing.
export async function GET(req: Request) {
  return NextResponse.json(buildBulletin(modeFromRequest(req)), { headers: { 'cache-control': 'no-store' } });
}
