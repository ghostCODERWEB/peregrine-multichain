import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertsList } from '@/components/AlertsList';
import { AlertBuilder } from '@/components/alerts/AlertBuilder';
import { displayMode } from '@/server/mode';
import { accountsEnabled } from '@/server/site';
import { PageTitle } from '@/components/PageTitle';

export const metadata: Metadata = { title: 'Alerts · Peregrine' };
export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const mode = await displayMode();
  return (
    <div className="space-y-4">
      <PageTitle id="alerts-title" title="Alerts" pill="Nansen Smart Alerts" />
      <section aria-labelledby="alerts-list" className="material rise p-5 sm:p-6">
        <h2 id="alerts-list" className="mb-3 text-[15px] font-semibold text-ink">Your Peregrine alerts</h2>
        {mode === 'public'
          ? <p className="text-sm text-ink-2">Smart Alerts live on a Nansen account: they are managed by this instance&apos;s owner{accountsEnabled() ? <>, or by you once you <Link prefetch={false} href="/account" className="text-ink underline underline-offset-2">sign in with your own Nansen key</Link></> : null}.</p>
          : <AlertsList />}
      </section>
      {mode !== 'public' && (
        <section aria-labelledby="alerts-new" className="material rise p-5 sm:p-6">
          <h2 id="alerts-new" className="text-[15px] font-semibold text-ink">New alert from a Peregrine signal</h2>
          <p className="mb-3 mt-1 text-[12.5px] text-ink-2">Pick a template, preview, create. Up to 20 alerts.</p>
          <AlertBuilder />
        </section>
      )}
    </div>
  );
}
