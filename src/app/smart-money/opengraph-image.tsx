import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Smart money on Peregrine: What smart money is buying and selling';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'Smart money', title: 'What smart money is buying and selling', subtitle: 'Holdings, conviction, crowded exits, the PnL leaderboard, perp tilt and DCAs, from Nansen Smart Money.', chips: ['Holdings', 'Conviction', 'Crowded exits', 'PnL leaderboard', 'Perps and DCAs'] });
}
