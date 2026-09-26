import type { Metadata } from 'next';
import { Discover } from '@/components/discover/Discover';
import { spotPerpBoard } from '@/server/spot-perp';
import { discoverUniverse } from '@/server/discover';
import { alphaBoard } from '@/server/alpha/board';
import { displayMode, viewOf } from '@/server/mode';
import { chainName } from '@/lib/viz/format';
import { PageTitle } from '@/components/PageTitle';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Discover · Peregrine' };

export default async function AlphaPage() {
  const mode = await displayMode();
  const board = alphaBoard(viewOf(mode));
  const lead = board.rows[0];
  return (
    <div className="space-y-5">
      <PageTitle title="Discover" pill={lead ? `Top alpha: ${lead.symbol ?? 'a token'} on ${chainName(lead.chain)}` : 'What to look at, across every chain'} />
      <Discover board={board} universe={discoverUniverse(viewOf(mode), new Map(board.rows.map((r) => [`${r.chain}:${r.tokenAddress.toLowerCase()}`, r])))} source={mode === 'owner' ? 'smart-money flow' : 'all-trader flow'} divergence={spotPerpBoard(viewOf(mode)).slice(0, 10)} />
    </div>
  );
}
