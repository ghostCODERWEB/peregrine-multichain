import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requestContext } from '@/server/context';
import { keyInfo } from '@/server/auth/keys';
import { vaultReady } from '@/server/auth/vault';
import { AccountPanel } from '@/components/auth/AccountPanel';
import { x402Enabled, x402Resources } from '@/server/nansen/x402';
import { McpAccess } from '@/components/account/McpAccess';
import { accountsEnabled } from '@/server/site';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account — Peregrine' };

export default async function AccountPage() {
  // No accounts on a public site (the middleware redirects too).
  if (!accountsEnabled()) redirect('/');
  const ctx = await requestContext();
  const info = ctx.user ? keyInfo(ctx.user.id) : null;
  const resources = x402Enabled() ? await x402Resources().then((r) => r.size).catch(() => null) : null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="t-headline text-ink">{ctx.user ? 'Your Peregrine account' : 'Sign in to use your own Nansen key'}</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-2">
          Bring your own Nansen key: calls run as you, so the full data, labels and credits are yours.
        </p>
      </div>
      <section className="material p-5 sm:p-6">
        <AccountPanel user={ctx.user ? { family: ctx.user.family, address: ctx.user.address } : null} keyInfo={info ? { last4: info.last4, plan: info.plan } : null} vault={vaultReady()} mode={ctx.mode} />
      </section>
      <section aria-labelledby="mcp" className="material p-5 sm:p-6">
        <h2 id="mcp" className="mb-2 font-medium text-ink">MCP access</h2>
        <McpAccess />
      </section>
      {x402Enabled() && (
        <section className="material p-5 text-sm text-ink-2">
          <h2 className="mb-1 font-medium text-ink">No key? Pay per call</h2>
          <p>
            Some sections offer a priced button instead: Nansen sells {resources ?? 'most of its'} endpoints per call through x402, paid in USDC on Base or
            Monad straight from your wallet to Nansen (usually $0.01–$0.05). You see the price first, then exactly what your wallet will sign; nothing is signed
            without your click, Peregrine never holds funds, and what you buy is shown to you only.
          </p>
        </section>
      )}
    </div>
  );
}
