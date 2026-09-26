import type { Metadata } from 'next';
import { PageTitle } from '@/components/PageTitle';
import { ProfilerTabs } from '@/components/research/ProfilerTabs';
import { WatchlistView } from '@/components/research/TraderViews';

export const metadata: Metadata = { title: 'Watchlist · Profiler · Peregrine' };

export default function WatchlistPage() {
  return (
    <div className="space-y-4">
      <PageTitle title="Profiler" pill="Watched Hyperliquid traders" />
      <ProfilerTabs />
      <WatchlistView />
    </div>
  );
}
