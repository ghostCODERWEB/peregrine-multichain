import { notFound } from 'next/navigation';
import { plausibleTokenAddress } from '@/lib/address-family';
import type { Metadata } from 'next';
import { RugReportView } from '@/components/rug/RugReportView';
import { RUG_CHAINS } from '@/lib/rug';
import { chainName, shortAddress } from '@/lib/viz/format';
import { pageMeta } from '@/server/seo';
import { tokenSymbol } from '@/server/og-data';

type Params = { params: Promise<{ chain: string; address: string }> };
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { chain, address } = await params;
  const token = decodeURIComponent(address);
  const name = tokenSymbol(chain, token) ?? shortAddress(token);
  return pageMeta({ title: `Rug check: ${name} on ${chainName(chain)}`, description: `Is ${name} a rug? Holder concentration, insider clusters, exit liquidity and sell pressure on ${chainName(chain)}, from Nansen data.`, path: `/rug/${chain}/${encodeURIComponent(token)}` });
}

export default async function RugReportPage({ params }: Params) {
  const { chain, address } = await params;
  const token = decodeURIComponent(address);
  if (!RUG_CHAINS.includes(chain) || !plausibleTokenAddress(chain, token)) notFound();
  return <RugReportView chain={chain} address={token} />;
}
