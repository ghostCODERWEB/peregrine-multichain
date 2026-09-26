import type { Metadata } from 'next';
import { RugSearch } from '@/components/rug/RugSearch';
import { RUG_CHAINS } from '@/lib/rug';
import { PageTitle } from '@/components/PageTitle';

export const metadata: Metadata = { title: 'Rug Checker · Peregrine' };

const CHECKS = [
  ['Exit liquidity', 'Can holders sell without crashing the price'],
  ['Top-10 holders', 'How much of the supply a few wallets control'],
  ['Insider clusters', 'Top holders funded by the same wallet, or by the deployer'],
  ['Token age', 'Most rugs happen in a token’s first days'],
  ['Sell pressure', 'Top sellers against top buyers, insider sells counted extra'],
  ['Nansen risk indicators', 'Nansen’s own risk signals for the token'],
];

export default function RugPage() {
  return (
    <div className="space-y-5">
      <PageTitle title="Rug Checker" pill={`${RUG_CHAINS.length} networks · Nansen data`} />
      <section aria-label="Check a token" className="material p-5 sm:p-7">
        <RugSearch chains={RUG_CHAINS} />
      </section>
      <section aria-labelledby="rug-how" className="material p-5 sm:p-6">
        <h2 id="rug-how" className="t-section">
          What it checks
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CHECKS.map(([t, d]) => (
            <li key={t} className="inset-well px-4 py-3">
              <div className="text-[14px] font-bold text-ink">{t}</div>
              <div className="mt-0.5 text-[12.5px] text-ink-muted">{d}</div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[12.5px] text-ink-muted">
          Verdict: the token&apos;s Dump Risk band, raised to at least Moderate when a check fails and at least High when two or more do.
         
        </p>
      </section>
    </div>
  );
}
