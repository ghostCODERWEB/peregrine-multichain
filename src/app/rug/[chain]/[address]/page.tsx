import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { RugReportView } from '@/components/rug/RugReportView';
import { RUG_CHAINS } from '@/lib/rug';
import { chainName, shortAddress } from '@/lib/viz/format';

type Params = { params: Promise<{ chain: string; address: string }> };
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { chain, address } = await params;
  return { title: `Rug check: ${shortAddress(decodeURIComponent(address))} on ${chainName(chain)} — Peregrine` };
}

export default async function RugReportPage({ params }: Params) {
  const { chain, address } = await params;
  if (!RUG_CHAINS.includes(chain)) notFound();
  return <RugReportView chain={chain} address={decodeURIComponent(address)} />;
}
