import { ogCard, OG_SIZE } from '@/lib/og/card';
import { alphaBoard } from '@/server/alpha/board';
import { chainName } from '@/lib/viz/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Alpha on Peregrine: tokens with strong one-way buying, scored 0 to 100';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Alpha: the three highest-scoring tokens. */
export default function Image() {
  const rows = alphaBoard('public', Date.now(), 3).rows;
  const lead = rows[0];
  return ogCard({
    section: 'Alpha',
    title: lead ? `Top alpha: ${lead.symbol ?? 'a token'} on ${chainName(lead.chain)} (${Math.round(lead.score)})` : 'Tokens worth a look, scored 0 to 100',
    subtitle: 'Tokens with strong, persistent one-way buying across every chain, ranked by alpha score, with the reasons.',
    stats: rows.map((r, i) => ({ label: `#${i + 1} · ${chainName(r.chain)}`, value: `${r.symbol ?? 'Token'} ${Math.round(r.score)}`, tone: 'up' as const })),
  });
}
