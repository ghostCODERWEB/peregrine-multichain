import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Proof on Peregrine: Do the models work?';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'Proof', title: 'Do the models work?', subtitle: 'The out-of-sample record: how often dump-risk scores and projections were right, published with their errors.', chips: ['Out of sample', 'Dump-risk scores', 'Projections', 'Published errors'] });
}
