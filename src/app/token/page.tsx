import type { Metadata } from 'next';
import { RugSearch } from '@/components/rug/RugSearch';
import { RUG_CHAINS } from '@/lib/rug';
import { PageTitle } from '@/components/PageTitle';
import { RiskBoard } from '@/components/rug/RiskBoard';

export const metadata: Metadata = { title: 'Token Checker · Peregrine' };

export const dynamic = 'force-dynamic';

export default function TokenCheckerPage() {
  return (
    <div className="space-y-5">
      <PageTitle title="Token Checker" pill={`${RUG_CHAINS.length} networks · Nansen data`} />
      <section aria-label="Check a token" className="material p-5 sm:p-7">
        <RugSearch chains={RUG_CHAINS} />
      </section>
      <RiskBoard />
    </div>
  );
}
