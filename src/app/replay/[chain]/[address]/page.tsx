import { notFound } from 'next/navigation';
import { TimeMachine } from '@/components/desk/TimeMachine';
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { pageMeta } from '@/server/seo';
import type { Metadata } from 'next';

export const metadata: Metadata = pageMeta({ title: 'Time Machine', description: 'Replay a token from a past moment: call it with the outcome hidden, then reveal what happened.', path: '/replay', noindex: true, image: '/opengraph-image' });
export default async function ReplayPage({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  if (!ALL_CHAIN_IDS.includes(chain) || !/^[A-Za-z0-9:._-]{20,160}$/.test(address)) notFound();
  return <TimeMachine chain={chain} token={address} />;
}
