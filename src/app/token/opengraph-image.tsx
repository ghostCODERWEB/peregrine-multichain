import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Token Checker on Peregrine: Check any token before you buy';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'Token Checker', title: 'Check any token before you buy', subtitle: 'A 0–100 dump-risk score from six Nansen-derived inputs, with smart-money flow and holder concentration.', chips: ['Token Score', 'Smart-money flow', 'Holders', 'Liquidity', 'Insider clusters'] });
}
