import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Profiler on Peregrine: Profile any wallet';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'Profiler', title: 'Profile any wallet', subtitle: 'Trader score, holdings, PnL and counterparties for any address, and side-by-side comparisons.', chips: ['Trader score', 'Holdings', 'PnL', 'Counterparties', 'Compare'] });
}
