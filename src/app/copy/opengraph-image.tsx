import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Copy Lab on Peregrine: Profitable traders worth following';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'Copy Lab', title: 'Profitable traders worth following', subtitle: 'Spot, perp and prediction-market traders ranked by a copy score, and whether copying them works when you are late.', chips: ['Spot traders', 'Perp traders', 'Prediction traders', 'Copy score', 'Followability'] });
}
