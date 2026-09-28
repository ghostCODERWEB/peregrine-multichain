import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Rug check on Peregrine: Is this token a rug?';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'Rug check', title: 'Is this token a rug?', subtitle: 'Holder concentration, insider clusters, exit liquidity and sell pressure in one reading.', chips: ['Concentration', 'Insider clusters', 'Exit liquidity', 'Sell pressure'] });
}
