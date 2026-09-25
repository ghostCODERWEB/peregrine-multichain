import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertsList } from '@/components/AlertsList';
import { AlertBuilder } from '@/components/alerts/AlertBuilder';
import { displayMode } from '@/server/mode';
import { accountsEnabled } from '@/server/site';

export const metadata: Metadata = { title: 'Alerts — Peregrine' };
export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const mode = await displayMode();
  return (
    <div className="space-y-4">
      <section aria-labelledby="alerts-title" className="glass rise rounded-2xl p-4 sm:p-6">
        <div className="text-[12.5px] font-bold text-brand">Nansen Smart Alerts</div>
        <h1 id="alerts-title" className="mt-1 text-lg font-semibold text-ink sm:text-xl">Alerts that keep watching after you close the tab</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-2">
          Peregrine signals as Nansen Smart Alerts on your own account, delivered to Telegram, Discord, Slack or a webhook. Your other alerts stay untouched.
        </p>
      </section>
      <section aria-labelledby="alerts-list" className="glass rise rounded-2xl p-4 sm:p-5">
        <h2 id="alerts-list" className="mb-3 text-[15px] font-semibold text-ink">Your Peregrine alerts</h2>
        {mode === 'public'
          ? <p className="text-sm text-ink-2">Smart Alerts live on a Nansen account: they are managed by this instance&apos;s owner{accountsEnabled() ? <>, or by you once you <Link href="/account" className="text-ink underline-offset-2 hover:underline">sign in with your own Nansen key</Link></> : null}.</p>
          : <AlertsList />}
      </section>
      {mode !== 'public' && (
        <section aria-labelledby="alerts-new" className="glass rise rounded-2xl p-4 sm:p-5">
          <h2 id="alerts-new" className="text-[15px] font-semibold text-ink">New alert from a Peregrine signal</h2>
          <p className="mb-3 mt-1 text-[12.5px] text-ink-2">Pick a template, preview the exact request, then create it. Nothing is created until you click Create. Up to 20 Peregrine alerts per account.</p>
          <AlertBuilder />
        </section>
      )}
    </div>
  );
}
