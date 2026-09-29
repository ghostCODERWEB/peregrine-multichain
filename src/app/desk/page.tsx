import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { requestContext } from '@/server/context';
import { DESK_COOKIE, deskScope, deskSummary } from '@/server/desk/calls';
import { DeskView, type DeskData } from '@/components/desk/DeskView';
import { PageTitle } from '@/components/PageTitle';
import { WatchlistCard } from '@/components/desk/WatchlistCard';
import { pageMeta } from '@/server/seo';

export const metadata: Metadata = pageMeta({ title: 'Desk', description: 'Your calls, their receipts and your trader record.', path: '/desk', noindex: true, image: '/opengraph-image' });
export const dynamic = 'force-dynamic';

export default async function DeskPage() {
  const ctx = await requestContext();
  const scope = deskScope(ctx, (await cookies()).get(DESK_COOKIE)?.value ?? null);
  const initial: DeskData = scope ? { scope: scope.split(':')[0], ...deskSummary(scope) } : { scope: null, calls: [], dna: { bySetup: [], byHorizon: [], bySource: [] } };
  return (
    <div className="space-y-4">
      <PageTitle id="desk-title" title="Desk" pill="Calls graded on Nansen candles" />
      <WatchlistCard />
      <DeskView initial={initial} />
    </div>
  );
}
