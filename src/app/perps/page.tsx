import type { Metadata } from 'next';
import { displayMode, viewOf } from '@/server/mode';
import { perpBoard, perpTitle } from '@/server/perps/board';
import { PerpsView } from '@/components/perps/PerpsView';

export const metadata: Metadata = { title: 'Perps — Peregrine' };
export const dynamic = 'force-dynamic';

export default async function PerpsPage() {
  // From TIDE's own hourly snapshots: no Nansen call per page view.
  const mode = await displayMode();
  const board = perpBoard(viewOf(mode));
  return <PerpsView board={board} title={perpTitle(board)} mode={mode} />;
}
