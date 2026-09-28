import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { chainPage } from '@/server/weather/chain-page';
import { displayMode } from '@/server/mode';
import { ChainView } from '@/components/chain/ChainView';
import { ALL_CHAIN_IDS, chainCapability, unavailableReason } from '@/lib/registry';
import { chainName } from '@/lib/viz/format';
import { pageMeta } from '@/server/seo';
import { buildBulletin } from '@/server/weather/bulletin';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ chain: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { chain } = await params;
  const name = chainName(chain);
  const tile = buildBulletin('public').chains.find((c) => c.chain === chain);
  const reading = tile?.cpi != null ? `Flow Index ${Math.round(tile.cpi)} (${tile.band === 'high' ? 'accumulation' : tile.band === 'low' ? 'distribution' : 'neutral'}). ` : '';
  return pageMeta({ title: `${name} flows and Flow Index`, description: `${reading}Net flow, activity and the most-traded tokens on ${name}, measured against the chain's own history, from the Nansen API.`, path: `/chain/${chain}` });
}

export default async function ChainRoute({ params }: Params) {
  const { chain } = await params;
  if (!ALL_CHAIN_IDS.includes(chain)) notFound();
  const cap = chainCapability(chain)!;
  const data = await chainPage(chain, await displayMode());
  return (
    <ChainView
      d={data}
      gaps={{ tier: cap.tier, pressure: unavailableReason(chain, 'pressure'), trades: unavailableReason(chain, 'smartMoney') }}
    />
  );
}
