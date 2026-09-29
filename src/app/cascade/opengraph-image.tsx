import { ogCard, OG_SIZE } from '@/lib/og/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Cascades on Peregrine: Who bought first, and who followed';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return ogCard({ section: 'Cascades', title: 'Who bought first, and who followed', subtitle: 'Smart-money buying cascades: the wallets that moved first on a token and the ones that followed.', chips: ['First movers', 'Followers', 'Token cascades', 'Smart money'] });
}
