import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';
import { timeMachine } from '@/server/history/time-machine';

export const dynamic = 'force-dynamic';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** GET ?then=YYYY-MM-DD&now=YYYY-MM-DD → Smart Money holdings on both dates (owner view; 25 credits per uncached date). */
export async function GET(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  if (ctx.mode === 'public') return fail('Smart Money holdings are shown only in the key owner\'s view (Nansen redistribution rules).', 403);
  const u = new URL(req.url);
  const then = u.searchParams.get('then') ?? '', now = u.searchParams.get('now') ?? '';
  if (!DAY.test(then) || !DAY.test(now) || then >= now) return fail('Choose an earlier date and a later date (YYYY-MM-DD).');
  if (now >= new Date().toISOString().slice(0, 10)) return fail('Today has no snapshot yet: the latest is yesterday.');
  const who = ctx.user ? `u${ctx.user.id}` : clientId(req);
  if (!allow('time-machine', who, 6)) return fail('Please wait a minute before another comparison.', 429);
  try {
    return Response.json(await contextScope.run(ctx, () => timeMachine(then, now)), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail((e as Error).message.slice(0, 200), 502); }
}
