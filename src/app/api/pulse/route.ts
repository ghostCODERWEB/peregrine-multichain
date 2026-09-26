import { NextResponse } from 'next/server';
import { contextFromRequest, contextScope } from '@/server/context';
import { insightsFor, briefSubject, type InsightKey } from '@/server/insights';
import { aiBrief } from '@/server/pulse-brief';

export const dynamic = 'force-dynamic';

/** A page's AI brief (shared, cached hourly): ?key=pulse|perps|sectors|predict|flows|pm-<market id>. Owner view only: it reads Smart Money data. */
export async function GET(req: Request) {
  const ctx = contextFromRequest(req);
  if (ctx.mode !== 'owner') return NextResponse.json({ brief: null });
  const key = (new URL(req.url).searchParams.get('key') ?? 'pulse') as InsightKey;
  const brief = await contextScope.run(ctx, async () => {
    const subject = await briefSubject(key);
    return subject ? aiBrief(key, await insightsFor(key, ctx.mode), subject) : null;
  });
  return NextResponse.json({ brief });
}
