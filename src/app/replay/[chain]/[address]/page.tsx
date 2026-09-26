import { notFound } from 'next/navigation';
import { TimeMachine } from '@/components/desk/TimeMachine';
import { ALL_CHAIN_IDS } from '@/lib/registry';

export const metadata = { title: 'Time Machine · Peregrine' };
export default async function ReplayPage({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  if (!ALL_CHAIN_IDS.includes(chain) || !/^[A-Za-z0-9:._-]{20,160}$/.test(address)) notFound();
  return <TimeMachine chain={chain} token={address} />;
}
