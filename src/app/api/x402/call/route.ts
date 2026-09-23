// POST /api/x402/call { endpoint, body, payment }
//   → forwards the request to Nansen with the PAYMENT-SIGNATURE the user's
//     wallet produced, and returns the data to that user only (never cached
//     or shown to anyone else) with the settlement receipt.
import { paidCall, X402Error } from '@/server/nansen/x402';
import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest } from '@/server/context';
import { allow, clientId } from '@/server/rate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('cross-origin request refused', 403);
  if (!allow('x402-call', clientId(req), 12)) return fail('Too many paid calls; wait a minute.', 429);
  const b = (await req.json().catch(() => null)) as { endpoint?: unknown; body?: unknown; payment?: unknown } | null;
  if (!b || typeof b.endpoint !== 'string' || typeof b.payment !== 'string') return fail('endpoint and payment required');
  try {
    const r = await paidCall(b.endpoint, b.body ?? {}, b.payment, contextFromRequest(req).user?.id ?? null);
    return Response.json(r, { headers: { 'cache-control': 'private, no-store' } });
  } catch (e) {
    return e instanceof X402Error ? fail(e.message, e.status) : fail('The paid call failed.', 502);
  }
}
