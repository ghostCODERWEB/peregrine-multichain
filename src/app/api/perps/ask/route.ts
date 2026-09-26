import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { SYMBOL_RE } from '@/server/perps/detail';
import { perpsAnalyst, savedAnswers } from '@/server/agents/perps-analyst';

export const dynamic = 'force-dynamic';

const Ask = z.object({
  symbol: z.string().regex(SYMBOL_RE),
  question: z.string().min(1).max(2000),
  context: z.unknown(),
  depth: z.enum(['quick', 'deep']),
  conversationId: z.string().max(120).nullable().optional(),
  acknowledgedCredits: z.number().optional(),
});

/** GET ?symbol=BTC → the analyst's saved answers for this coin (owner and members). */
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  if (ctx.mode === 'public') return Response.json({ answers: [] });
  const symbol = (new URL(req.url).searchParams.get('symbol') ?? '').toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return fail('Choose a coin symbol.');
  return Response.json({ answers: savedAnswers(symbol) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

/** Streams the analyst's answer as server-sent events: tool, delta, done, error. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const parsed = Ask.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Ask a question about this coin.');
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  if (!allow('perps-ask', who, 4)) return fail('Please wait a minute before asking again.', 429);
  const a = parsed.data;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* client went away */ }
      };
      await contextScope.run(ctx, async () => {
        for await (const e of perpsAnalyst(ctx, { symbol: a.symbol.toUpperCase(), question: a.question, context: a.context, depth: a.depth, conversationId: a.conversationId ?? null, acknowledged: a.acknowledgedCredits })) send(e.type, e);
      });
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
