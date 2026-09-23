import { NextResponse } from 'next/server';
import { buildBulletin } from '@/server/weather/bulletin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Served from TIDE's own scanner history — no Nansen call per request, so
// polling this costs nothing.
export async function GET() {
  return NextResponse.json(buildBulletin(), { headers: { 'cache-control': 'no-store' } });
}
