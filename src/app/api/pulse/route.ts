import { NextResponse } from 'next/server';
import { contextFromRequest, contextScope } from '@/server/context';
import { marketPulse } from '@/server/pulse';
import { pulseBrief } from '@/server/pulse-brief';

export const dynamic = 'force-dynamic';

/** The Market Pulse AI brief (shared, cached hourly). Owner view only: it reads Smart Money data. */
export async function GET(req: Request) {
  const ctx = contextFromRequest(req);
  if (ctx.mode !== 'owner') return NextResponse.json({ brief: null });
  const brief = await contextScope.run(ctx, () => pulseBrief(marketPulse(ctx.mode)));
  return NextResponse.json({ brief });
}
