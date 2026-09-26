// Personal MCP tokens: an MCP client (an AI assistant, an IDE, an agent) acts as the
// account that created the token. Stored hashed; shown once; revocable.
import crypto from 'node:crypto';
import { getDb, audit } from '@/server/nansen/db';
import { contextFromRequest, contextForUser, type RequestContext } from '@/server/context';

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

export function tokenScope(ctx: RequestContext): string | null {
  return ctx.user && ctx.mode === 'member' ? `user:${ctx.user.id}` : ctx.mode === 'owner' ? 'owner' : null;
}

export function createToken(ctx: RequestContext): string {
  const scope = tokenScope(ctx);
  if (!scope) throw new Error('Sign in with your Nansen key to create an MCP token.');
  const token = `tide_mcp_${crypto.randomBytes(24).toString('base64url')}`;
  const db = getDb();
  db.transaction(() => {
    // One live token per account: a new one replaces the old.
    db.prepare('DELETE FROM mcp_tokens WHERE scope = ?').run(scope);
    db.prepare('INSERT INTO mcp_tokens (token_hash, scope, user_id, created_at) VALUES (?, ?, ?, ?)').run(hash(token), scope, ctx.user?.id ?? null, Date.now());
  })();
  audit(ctx.user?.id ?? null, 'mcp.token.create', scope);
  return token;
}

export function tokenInfo(ctx: RequestContext): { createdAt: number; lastUsedAt: number | null } | null {
  const scope = tokenScope(ctx);
  if (!scope) return null;
  const r = getDb().prepare('SELECT created_at, last_used_at FROM mcp_tokens WHERE scope = ?').get(scope) as { created_at: number; last_used_at: number | null } | undefined;
  return r ? { createdAt: r.created_at, lastUsedAt: r.last_used_at } : null;
}

export function revokeToken(ctx: RequestContext): void {
  const scope = tokenScope(ctx);
  if (!scope) return;
  getDb().prepare('DELETE FROM mcp_tokens WHERE scope = ?').run(scope);
  audit(ctx.user?.id ?? null, 'mcp.token.revoke', scope);
}

/** The context an MCP request acts in: its bearer token's account, else the
 *  request's own (cookie or the instance's display mode). A token that no
 *  longer matches anything is refused rather than silently downgraded. */
export function contextFromMcp(req: Request): RequestContext | { error: string } {
  const auth = req.headers.get('authorization');
  const m = auth ? /^Bearer\s+(tide_mcp_[A-Za-z0-9_-]{20,})$/.exec(auth.trim()) : null;
  if (!auth) return contextFromRequest(req);
  if (!m) return { error: 'Unrecognised authorization: use "Bearer tide_mcp_…" from your Peregrine account page.' };
  const row = getDb().prepare('SELECT scope, user_id FROM mcp_tokens WHERE token_hash = ?').get(hash(m[1])) as { scope: string; user_id: number | null } | undefined;
  if (!row) return { error: 'This MCP token was revoked or replaced.' };
  getDb().prepare('UPDATE mcp_tokens SET last_used_at = ? WHERE token_hash = ?').run(Date.now(), hash(m[1]));
  if (row.scope === 'owner') {
    // An owner token keeps working only while the instance is still private to its owner.
    const base = contextFromRequest(req);
    return process.env.TIDE_DISPLAY_MODE === 'private' && process.env.TIDE_PUBLIC_SITE !== '1' ? { ...base, mode: 'owner' } : { error: 'Owner tokens work only on a private instance (TIDE_DISPLAY_MODE=private).' };
  }
  return row.user_id != null ? contextForUser(row.user_id) : { error: 'Token has no account.' };
}
