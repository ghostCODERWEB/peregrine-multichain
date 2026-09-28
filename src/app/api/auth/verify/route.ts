// POST {family, message, signature} -> sets the session cookie. Checks the
// signature, that the nonce is fresh and unused, and that the message was
// issued for this domain (a signature for another site can't be replayed).
import { parseMessage, verifyEvm, verifySolana, type Family } from '@/server/auth/wallet-sig';
import { consumeNonce, createSession, SESSION_COOKIE, SESSION_TTL_MS } from '@/server/auth/session';
import { sameOrigin, fail, cookie } from '@/server/auth/http';
import { audit } from '@/server/nansen/db';
import { accountsEnabled } from '@/server/site';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!accountsEnabled()) return Response.json({ error: 'Accounts are off on this site.' }, { status: 404 });
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const b = (await req.json().catch(() => ({}))) as { family?: Family; message?: string; signature?: string };
  if (!b.family || !b.message || !b.signature) return fail('Need family, message and signature.');
  const m = parseMessage(b.message);
  if (!m) return fail('Unrecognized sign-in message.');
  if (m.domain !== new URL(req.url).host) return fail('This message was issued for another site.');
  if (Date.now() - Date.parse(m.issuedAt) > 5 * 60_000) return fail('The sign-in message expired; try again.');
  const ok = b.family === 'evm' ? await verifyEvm(m.address, b.message, b.signature) : verifySolana(m.address, b.message, b.signature);
  if (!ok) return fail('The signature does not match the address.', 401);
  if (!consumeNonce(m.nonce)) return fail('This sign-in message was already used or expired.', 401);
  const { id, user } = createSession(b.family, m.address);
  audit(user.id, 'signin', b.family);
  return Response.json({ user: { family: user.family, address: user.address } }, {
    headers: { 'Set-Cookie': cookie(req, SESSION_COOKIE, id, SESSION_TTL_MS / 1000) },
  });
}
