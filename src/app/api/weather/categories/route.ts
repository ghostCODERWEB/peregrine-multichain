import { contextFromRequest } from '@/server/context';
import { sameOrigin, fail } from '@/server/auth/http';
import { allow, clientId } from '@/server/rate';
import { loadPredictionCategories, CATEGORY_CREDITS } from '@/server/weather/category-refresh';

export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const body = await req.json().catch(() => null);
  if (body?.confirmCredits !== CATEGORY_CREDITS) return fail(`Confirm a maximum of ${CATEGORY_CREDITS} credit.`, 428);
  if (!allow('weather-categories', clientId(req), 3)) return fail('Please wait a minute before loading again.', 429);
  try {
    return Response.json(await loadPredictionCategories(contextFromRequest(req)), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail(`Nansen returned no category board: ${(e as Error).message.slice(0, 160)}`, 502); }
}
