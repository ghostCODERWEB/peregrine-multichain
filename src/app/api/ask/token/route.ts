// GET  /api/ask/token?chain=&address= → this token's recent Ask Nansen answers
//      and how many public questions are left today (free: local reads).
// POST /api/ask/token { chain, address, question } → SSE: the answer streaming
//      in from Nansen's fast agent, or the cached one (see server/agents/quick).
import { z } from 'zod';
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { quickAsk, recentAnswers, quickSubject, publicQuestionsToday, quickDailyCap, QUICK_CREDITS } from '@/server/agents/quick';

export const dynamic = 'force-dynamic';
const Token = z.object({ chain: z.string().refine((c) => ALL_CHAIN_IDS.includes(c)), address: z.string().regex(/^[A-Za-z0-9:._-]{20,160}$/) });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const t = Token.safeParse({ chain: q.get('chain'), address: q.get('address') });
  if (!t.success) return fail('Unknown token.');
  const ctx = contextFromRequest(req);
  const pub = ctx.mode !== 'owner';
  return Response.json({
    answers: recentAnswers(quickSubject(t.data.chain, t.data.address, ctx.mode)),
    price: QUICK_CREDITS, left: pub ? Math.max(0, quickDailyCap() - publicQuestionsToday()) : null, cap: pub ? quickDailyCap() : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}

const Ask = Token.extend({ question: z.string().trim().min(3).max(300) });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const parsed = Ask.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Ask a question of 3 to 300 characters.');
  const { chain, address, question } = parsed.data;
  const ctx = contextFromRequest(req);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      void contextScope.run(ctx, async () => {
        try {
          for await (const e of quickAsk(chain, address, question, ctx.mode)) controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch (e) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'error', message: (e as Error).message.slice(0, 200) })}\n\n`));
        } finally { controller.close(); }
      });
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
