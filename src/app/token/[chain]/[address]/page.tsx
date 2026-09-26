import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TokenView } from '@/components/token/TokenView';
import { QuickRead } from '@/components/token/QuickRead';
import { ALL_CHAIN_IDS, chainCapability } from '@/lib/registry';
import { chainName, shortAddress } from '@/lib/viz/format';
import { displayMode } from '@/server/mode';

type Params = { params: Promise<{ chain: string; address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { chain, address } = await params;
  return { title: `${shortAddress(decodeURIComponent(address))} on ${chainName(chain)} · Peregrine` };
}

// The page is a shell; every module streams in from
// /api/token/[chain]/[address]/stream so the header shows while the
// forensics (50+ profiler calls) are still running.
export const dynamic = 'force-dynamic';

export default async function TokenRoute({ params }: Params) {
  const { chain, address } = await params;
  if (!ALL_CHAIN_IDS.includes(chain)) notFound();
  const mode = await displayMode();
  return <TokenView chain={chain} address={decodeURIComponent(address)} tier={chainCapability(chain)!.tier} mode={mode} quickRead={<QuickRead chain={chain} address={decodeURIComponent(address)} mode={mode} />} />;
}
