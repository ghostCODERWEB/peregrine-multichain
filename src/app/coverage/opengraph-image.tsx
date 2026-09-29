import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Coverage on Peregrine: Every chain the Nansen API covers';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'Coverage', title: 'Every chain the Nansen API covers', subtitle: 'Which chains and data sets Peregrine reads, and what each view is built from.', chips: ['Chains', 'Data sets', 'Nansen API', 'Methods'] });
}
