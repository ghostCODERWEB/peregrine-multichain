// GET /api/token/news?name=&symbol= → web results about a token from
// Nansen's hosted search (5 credits, cached six hours; on click).
import { newsSearch } from '@/server/token/ondemand';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!allow('news', clientId(req), 10)) return Response.json({ error: 'Too many news searches; wait a minute.' }, { status: 429 });
  const q = new URL(req.url).searchParams;
  const clip = (v: string | null) => (v ?? '').replace(/[^\p{L}\p{N} .&$_-]/gu, '').trim().slice(0, 60) || null;
  const ctx = contextFromRequest(req);
  return Response.json(await contextScope.run(ctx, () => newsSearch(clip(q.get('name')), clip(q.get('symbol')))));
}
