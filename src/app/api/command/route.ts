// GET  /api/command?q=&ctx= → parses a ⌘K command, resolves its token with
//      Nansen's free search, and says what it costs (nothing is run).
// POST /api/command {q, ctx, confirmCredits: 1} → runs the one priced inline
//      command (who bought/sold, related wallets). Labels are stripped for
//      public views, as everywhere else.
import { z } from 'zod';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { forMode } from '@/server/redact';
import { previewCommand, runCommand } from '@/server/search/commands';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
const Ctx = z.string().max(300).regex(/^\/[A-Za-z0-9/_.:%?=&#-]*$/).nullish();

export async function GET(req: Request) {
  if (!allow('command', clientId(req), 90)) return fail('Too many commands; wait a minute.', 429);
  const u = new URL(req.url).searchParams;
  const q = (u.get('q') ?? '').slice(0, 200);
  const ctx = Ctx.safeParse(u.get('ctx'));
  const preview = await contextScope.run(contextFromRequest(req), () => previewCommand(q, ctx.success ? ctx.data ?? null : null));
  return Response.json({ preview }, { headers });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const b = z.object({ q: z.string().max(200), ctx: Ctx, confirmCredits: z.literal(1) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return fail('Confirm the 1-credit price to run this command.', 428);
  const ctx = contextFromRequest(req);
  if (!allow('command-run', ctx.user ? `u${ctx.user.id}` : clientId(req), 10)) return fail('Please wait a minute.', 429);
  try {
    const answer = await contextScope.run(ctx, async () => {
      const p = await previewCommand(b.data.q, b.data.ctx ?? null);
      if (!p) throw new Error('That isn’t a command. Type / to see them.');
      return runCommand(p);
    });
    return Response.json({ answer: forMode(ctx.mode, answer) }, { headers });
  } catch (e) { return fail((e as Error).message.slice(0, 240), 422); }
}
