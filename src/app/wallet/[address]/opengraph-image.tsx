import { ogCard, OG_SIZE } from '@/lib/og/card';
import { shortAddress } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'A wallet profile on Peregrine';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** A wallet: its address and what the profile holds (no wallet data leaves the app on a share card). */
export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const address = decodeURIComponent((await params).address);
  return ogCard({
    section: 'Wallet profile',
    title: `Wallet ${shortAddress(address)}`,
    subtitle: 'Trader score across spot, perps and prediction markets, holdings, PnL, counterparties and where its money came from.',
    chips: ['Trader score', 'Holdings', 'PnL', 'Counterparties', 'Origins'],
  });
}
