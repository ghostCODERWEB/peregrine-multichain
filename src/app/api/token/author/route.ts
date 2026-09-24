// GET /api/token/author?username=&symbol= → one social account's week from
// Nansen (ra-agent/posts-by-user: 5 credits, cached an hour; on click).
import { authorPosts, HANDLE } from '@/server/token/ondemand';
import { contextFromRequest, contextScope } from '@/server/context';
import { allow, clientId } from '@/server/rate';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const username = q.get('username') ?? '';
  if (!HANDLE.test(username)) return Response.json({ error: 'Not a valid X handle.' }, { status: 400 });
  if (!allow('author', clientId(req), 6)) return Response.json({ error: 'Too many author lookups; wait a minute.' }, { status: 429 });
  const symbol = (q.get('symbol') ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20) || null;
  return Response.json(await contextScope.run(contextFromRequest(req), () => authorPosts(username, symbol)));
}
