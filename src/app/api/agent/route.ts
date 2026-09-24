// The research agent (agent/expert, 750 credits a question): owner or a
// signed-in member only, the price acknowledged on every question, a daily
// cap per account. Streams the answer as server-sent events.
import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { expertStream, expertScope, listReports, questionsToday, expertDailyCap, EXPERT_CREDITS } from '@/server/agents/expert';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = contextFromRequest(req);
  const scope = expertScope(ctx);
  if (!scope) return fail('The research agent runs on a Nansen key: the instance owner’s, or yours once you sign in with it.', 403);
  return Response.json({ reports: listReports(scope), usedToday: questionsToday(scope), cap: expertDailyCap(), price: EXPERT_CREDITS }, { headers: { 'Cache-Control': 'private, no-store' } });
}

const Ask = z.object({ question: z.string().min(1).max(4000), acknowledgedCredits: z.number().optional(), conversationId: z.string().max(120).nullable().optional() });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const parsed = Ask.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Ask a question.');
  const { question, acknowledgedCredits, conversationId } = parsed.data;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => { try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { /* closed */ } };
      try {
        await contextScope.run(ctx, async () => {
          for await (const e of expertStream(ctx, question, acknowledgedCredits, conversationId ?? null)) send(e.type, e);
        });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
