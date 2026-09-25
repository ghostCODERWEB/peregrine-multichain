import { sameOrigin, fail } from '@/server/auth/http';
import { contextFromRequest } from '@/server/context';
import { createToken, revokeToken, tokenInfo, tokenScope } from '@/server/mcp/tokens';
import { accountsEnabled } from '@/server/site';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request) {
  if (!accountsEnabled()) return Response.json({ error: 'Accounts are off on this site.' }, { status: 404 });
  const ctx = contextFromRequest(req);
  return Response.json({ canCreate: !!tokenScope(ctx), token: tokenInfo(ctx) }, { headers });
}

/** Creates (or replaces) this account's MCP token; the only time it is shown. */
export async function POST(req: Request) {
  if (!accountsEnabled()) return Response.json({ error: 'Accounts are off on this site.' }, { status: 404 });
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  try { return Response.json({ token: createToken(contextFromRequest(req)) }, { headers }); } catch (e) { return fail((e as Error).message, 403); }
}

export async function DELETE(req: Request) {
  if (!accountsEnabled()) return Response.json({ error: 'Accounts are off on this site.' }, { status: 404 });
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  revokeToken(contextFromRequest(req));
  return Response.json({ ok: true }, { headers });
}
