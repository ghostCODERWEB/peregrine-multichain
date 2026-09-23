// POST /api/x402/quote { endpoint, body, payer? }
//   → Nansen's current price for this request, per payment network TIDE
//     can sign. Free: it is the unpaid request Nansen answers with 402.
import { quote, X402Error } from '@/server/nansen/x402';
import { sameOrigin, fail } from '@/server/auth/http';
import { allow, clientId } from '@/server/rate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('cross-origin request refused', 403);
  if (!allow('x402-quote', clientId(req), 30)) return fail('Too many price requests; wait a minute.', 429);
  const b = (await req.json().catch(() => null)) as { endpoint?: unknown; body?: unknown; payer?: unknown } | null;
  if (!b || typeof b.endpoint !== 'string') return fail('endpoint required');
  try {
    return Response.json(await quote(b.endpoint, b.body ?? {}, typeof b.payer === 'string' ? b.payer : null));
  } catch (e) {
    return e instanceof X402Error ? fail(e.message, e.status) : fail('Could not get a price from Nansen.', 502);
  }
}
