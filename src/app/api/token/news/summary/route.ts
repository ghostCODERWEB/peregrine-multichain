// POST /api/token/news/summary { url, symbol } → Nansen fetches the page
// and says what it reports about the token (20 credits, cached a day).
// Owner and members only (a public click would spend the instance's
// credits), same-origin, and under WEB_FETCH_MAX_PER_HOUR.
import { newsSummary } from '@/server/token/ondemand';
import { contextFromRequest, contextScope } from '@/server/context';
import { sameOrigin, fail } from '@/server/auth/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('cross-origin request refused', 403);
  const ctx = contextFromRequest(req);
  if (ctx.mode === 'public') return fail('Article summaries are for the key owner or a signed-in member with their own key.', 403);
  const b = (await req.json().catch(() => null)) as { url?: unknown; symbol?: unknown } | null;
  if (!b || typeof b.url !== 'string' || b.url.length > 500) return fail('url required');
  const symbol = typeof b.symbol === 'string' ? b.symbol.slice(0, 20) : null;
  return Response.json(await contextScope.run(ctx, () => newsSummary(b.url as string, symbol)));
}
