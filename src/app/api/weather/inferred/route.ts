import { contextFromRequest, contextScope } from '@/server/context';
import { sameOrigin, fail } from '@/server/auth/http';
import { refreshInferredWeather, INFERENCE_CAP } from '@/server/weather/inferred';

export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = contextFromRequest(req);
  if (ctx.mode !== 'owner') return fail('Scanner relationships are available only to the instance owner.', 403);
  const body = await req.json().catch(() => null);
  if (body?.confirmCredits !== INFERENCE_CAP) return fail(`Confirm a maximum of ${INFERENCE_CAP} credits.`, 428);
  try {
    const result = await contextScope.run(ctx, () => refreshInferredWeather());
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return fail((e as Error).message, 429); }
}
