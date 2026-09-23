import type { Metadata } from 'next';
import { requestContext } from '@/server/context';
import { keyInfo } from '@/server/auth/keys';
import { vaultReady } from '@/server/auth/vault';
import { AccountPanel } from '@/components/auth/AccountPanel';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account — TIDE' };

export default async function AccountPage() {
  const ctx = await requestContext();
  const info = ctx.user ? keyInfo(ctx.user.id) : null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{ctx.user ? 'Your TIDE account' : 'Sign in to use your own Nansen key'}</h1>
        <p className="mt-1 text-sm text-ink-2">
          Nansen lets its data be shown in full only to the key owner. Bring your own key and TIDE calls Nansen as you: the smart-money data and labels those
          calls return are yours to see, and the credits are yours.
        </p>
      </div>
      <section className="rounded-xl border border-border bg-surface p-4">
        <AccountPanel user={ctx.user ? { family: ctx.user.family, address: ctx.user.address } : null} keyInfo={info ? { last4: info.last4, plan: info.plan } : null} vault={vaultReady()} mode={ctx.mode} />
      </section>
    </div>
  );
}
