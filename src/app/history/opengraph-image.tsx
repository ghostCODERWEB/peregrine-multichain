import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'History on Peregrine: What changed in the last 24 hours';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'History', title: 'What changed in the last 24 hours', subtitle: 'Flow Index moves, sector swings and the market as it was, from stored snapshots.', chips: ['Flow Index moves', 'Sector swings', '24 hours', '7 days'] });
}
