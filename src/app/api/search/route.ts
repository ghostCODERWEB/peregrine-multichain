// GET /api/search?q= → omnibox results (tokens, entities, chains, sectors,
// wallets). Nansen's search is free; results carry no private data.
import { omnibox } from '@/server/search/omnibox';
import { allow, clientId } from '@/server/rate';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!allow('search', clientId(req), 90)) return Response.json({ error: 'Too many searches; wait a minute.' }, { status: 429 });
  const q = new URL(req.url).searchParams.get('q') ?? '';
  return Response.json(await omnibox(q), { headers: { 'cache-control': 'private, max-age=30' } });
}
