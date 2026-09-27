import type { Metadata } from 'next';
import { displayMode, viewOf } from '@/server/mode';
import { perpBoard, perpTitle } from '@/server/perps/board';
import { PerpsView } from '@/components/perps/PerpsView';
import { PerpsState } from '@/components/perps/PerpsState';
import { PerpsAnalytics } from '@/components/perps/PerpsAnalytics';

export const metadata: Metadata = { title: 'Perps · Peregrine' };
export const dynamic = 'force-dynamic';

export default async function PerpsPage() {
  // From TIDE's own hourly snapshots: no Nansen call per page view.
  const mode = await displayMode();
  const board = perpBoard(viewOf(mode));
  // The view draws only the price trend; the open-interest trend stays on the server.
  const sent = { ...board, coins: board.coins.map((c) => ({ ...c, trend: { price: c.trend.price, oi: [] } })) };
  return (
    <div className="space-y-4">
      <PerpsState mode={mode} />
      <PerpsView board={sent} title={perpTitle(board)} mode={mode} analytics={<PerpsAnalytics mode={mode} />} />
    </div>
  );
}
