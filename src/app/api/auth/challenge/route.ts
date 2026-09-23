// POST {family, address} -> { message }: the text the wallet signs, with a
// one-time nonce and this site's domain in it.
import { buildMessage, type Family } from '@/server/auth/wallet-sig';
import { newNonce } from '@/server/auth/session';
import { sameOrigin, fail } from '@/server/auth/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const b = (await req.json().catch(() => ({}))) as { family?: Family; address?: string };
  if ((b.family !== 'evm' && b.family !== 'solana') || !b.address || b.address.length > 64) return fail('Need family and address.');
  const url = new URL(req.url);
  const message = buildMessage({ family: b.family, domain: url.host, uri: url.origin, address: b.address, nonce: newNonce(), issuedAt: new Date().toISOString() });
  return Response.json({ message });
}
