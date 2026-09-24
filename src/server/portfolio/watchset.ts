import { getDb, audit } from '@/server/nansen/db';
import type { RequestContext } from '@/server/context';
import { walletAddresses } from '@/lib/models/portfolio';

export function watchScope(ctx: RequestContext): string | null {
  return ctx.user ? `user:${ctx.user.id}` : ctx.mode === 'owner' ? 'owner' : null;
}

export function readWatchset(scope: string): string[] {
  return (getDb().prepare('SELECT address FROM portfolio_wallets WHERE scope = ? ORDER BY created_at, address').all(scope) as Array<{ address: string }>).map((r) => r.address);
}

export function saveWatchset(scope: string, input: string[], userId: number | null): string[] {
  const addresses = walletAddresses(input);
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM portfolio_wallets WHERE scope = ?').run(scope);
    const put = db.prepare('INSERT INTO portfolio_wallets (scope, address, created_at) VALUES (?, ?, ?)');
    addresses.forEach((address, i) => put.run(scope, address, Date.now() + i));
    audit(userId, 'portfolio.watchset', `${addresses.length} wallets`);
  })();
  return addresses;
}
