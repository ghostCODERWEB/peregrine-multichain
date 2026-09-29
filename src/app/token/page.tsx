import type { Metadata } from 'next';
import { RugSearch } from '@/components/rug/RugSearch';
import { RUG_CHAINS } from '@/lib/rug';
import { PageTitle } from '@/components/PageTitle';
import { TokenCheckerView } from '@/components/rug/TokenCheckerView';
import { MobileTokens } from '@/components/mobile/MobileTokens';
import { tokenChecker } from '@/server/token/checker';
import { displayMode } from '@/server/mode';
import { isPhone } from '@/server/device';
import { pageMeta } from '@/server/seo';

export const metadata: Metadata = pageMeta({ title: 'Token Checker: dump risk for any token', description: 'Check any token before you buy: a 0–100 dump-risk score from six Nansen-derived inputs, with smart-money flow, holders and liquidity.', path: '/token' });

export const dynamic = 'force-dynamic';

export default async function TokenCheckerPage() {
  const d = tokenChecker((await displayMode()) === 'owner');
  if (await isPhone()) return <MobileTokens d={d} />;
  return (
    <>
      <div className="lg:hidden"><MobileTokens d={d} /></div>
      <div className="space-y-5 max-lg:hidden">
        <PageTitle title="Token Checker" pill={`${RUG_CHAINS.length} networks · Nansen data`} />
        <section aria-label="Check a token" className="material p-5 sm:p-7">
          <RugSearch chains={RUG_CHAINS} />
        </section>
        <TokenCheckerView d={d} />
      </div>
    </>
  );
}
