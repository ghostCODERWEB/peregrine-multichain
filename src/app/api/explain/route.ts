import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { explainView } from '@/server/agents/perps-analyst';

export const dynamic = 'force-dynamic';
const Body = z.object({ view: z.string().regex(/^[a-z0-9:_-]{2,60}$/i), context: z.unknown() });

/** Streams an explanation of one page module (server-sent events). */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('Nothing to explain.');
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  if (!allow('explain', who, 4)) return fail('Please wait a minute before asking again.', 429);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      await contextScope.run(ctx, async () => {
        for await (const e of explainView(ctx, parsed.data.view, parsed.data.context)) {
          try { controller.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`)); } catch { /* client left */ }
        }
      });
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
