import type { Metadata } from 'next';
import Link from 'next/link';
import { displayMode } from '@/server/mode';
import { SmartMoneyDesk } from '@/components/smart-money/SmartMoneyDesk';
import { SmartMoneyState } from '@/components/smart-money/SmartMoneyState';
import { WalletOverlaps } from '@/components/smart-money/WalletOverlaps';
import { SmartMoneyCharts } from '@/components/smart-money/SmartMoneyCharts';
import { accountsEnabled } from '@/server/site';
import { pageMeta } from '@/server/seo';

export const metadata: Metadata = pageMeta({ title: 'Smart-money desk', description: 'What Nansen Smart Money holds and trades: conviction, crowded exits, the PnL leaderboard, perp tilt and DCAs.', path: '/smart-money' });
export const dynamic = 'force-dynamic';

const PANELS = [
  ['Conviction map', 'Every token smart money holds, by its 24h balance change and how many smart-money wallets hold it.'],
  ['Conviction score', 'The balance change, weighted up when the best-performing smart-money wallets hold the token too.'],
  ['Crowded exits', 'Tokens held by many smart-money wallets that the cohort is cutting.'],
  ['PnL leaderboard and follow list', 'The best smart-money wallets over 30 days, and the trades of the ones you follow.'],
  ['Perp tilt and DCAs', 'New Hyperliquid exposure by coin, and the Jupiter DCA orders smart money opened.'],
];

export default async function SmartMoneyPage() {
  const mode = await displayMode();
  if (mode === 'public') {
    return (
      <div className="space-y-4">
        <section aria-labelledby="sm-title" className="material rise p-5 sm:p-6">
          <h1 id="sm-title" className="t-headline text-ink">
            The smart-money desk is private
          </h1>
          <p className="mt-2 max-w-[68ch] text-[13px] text-ink-2">
            Nansen smart-money holdings, PnL leaderboard, perp trades and DCAs. Nansen&apos;s redistribution rules keep these out of public
            views: shown only to this instance&apos;s owner{accountsEnabled() ? <>, or to you with your own Nansen key</> : null}.
          </p>
          {accountsEnabled() && (
            <Link prefetch={false}
              href="/account"
              className="mt-4 inline-flex rounded bg-brand/15 px-3.5 py-1.5 text-[13px] text-ink ring-1 ring-brand/40 hover:bg-brand/25"
            >
              Sign in with your Nansen key
            </Link>
          )}
        </section>
        <section aria-labelledby="sm-what" className="material rise p-5 sm:p-6">
          <h2 id="sm-what" className="text-[15px] font-semibold text-ink">
            What the desk shows
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {PANELS.map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border/70 bg-raised/50 p-3">
                <dt className="text-[13px] font-medium text-ink">{k}</dt>
                <dd className="mt-0.5 text-[12.5px] text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {mode === 'owner' && <SmartMoneyState />}
      {mode === 'owner' && <SmartMoneyCharts />}
      {mode === 'owner' && <WalletOverlaps />}
      <SmartMoneyDesk mode={mode} />
    </div>
  );
}
