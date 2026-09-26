import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { explainView } from '@/server/agents/perps-analyst';
import { enrichSelection } from '@/server/analyze/enrich';

export const dynamic = 'force-dynamic';
const Body = z.object({ view: z.string().max(160), context: z.unknown(), question: z.string().max(600).nullish(), selections: z.array(z.object({ kind: z.string().max(20).optional(), chain: z.string().max(40).optional(), address: z.string().max(120).optional(), symbol: z.string().max(40).optional(), id: z.string().max(200).optional() }).passthrough()).max(4).optional() });

/** Streams an explanation of one page module (server-sent events). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Nothing to explain.');
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  if (!allow('explain', who, 12)) return fail('Please wait a minute before asking again.', 429);
  const { view, question, selections } = parsed.data;
  // Selected tokens, wallets and coins get their stored Nansen records alongside what the page sent.
  const context = selections?.length ? { page: parsed.data.context, selected: selections.map((s) => ({ ...s, records: enrichSelection(s) })) } : parsed.data.context;
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      await contextScope.run(ctx, async () => {
        for await (const e of explainView(ctx, view, context, question)) {
          try { controller.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)); } catch { /* client left */ }
        }
      });
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
