import type { Metadata } from 'next';
import { AlphaView } from '@/components/alpha/AlphaView';
import { alphaBoard } from '@/server/alpha/board';
import { displayMode, viewOf } from '@/server/mode';
import { chainName } from '@/lib/viz/format';
import { PageTitle } from '@/components/PageTitle';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Alpha — Peregrine' };

export default async function AlphaPage() {
  const mode = await displayMode();
  const board = alphaBoard(viewOf(mode));
  const lead = board.rows[0];
  return (
    <div className="space-y-5">
      <PageTitle title="Alpha" pill={lead ? `Leaning into ${lead.symbol ?? 'a token'} on ${chainName(lead.chain)}` : 'What to look at, across every chain'} />
      <AlphaView board={board} />
    </div>
  );
}
