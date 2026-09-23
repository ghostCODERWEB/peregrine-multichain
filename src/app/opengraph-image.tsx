// Share card for the weather map: the headline, the chains under the most
// pressure as tiles on the diverging scale, and the lead storm warning.
import { ImageResponse } from 'next/og';
import { buildBulletin } from '@/server/weather/bulletin';
import { mapHeadline, frontsHeadline } from '@/lib/insights';
import { pressureClass } from '@/lib/viz/scales';
import { chainName } from '@/lib/viz/format';
import { OG, ogInk } from '@/lib/viz/og-palette';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'TIDE — smart-money weather across every chain the Nansen API lists';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const b = buildBulletin('public'); // share images leave the app: always the public view
  const tiles = b.chains.filter((c) => c.cpi != null).sort((x, y) => Math.abs(y.cpi! - 50) - Math.abs(x.cpi! - 50)).slice(0, 12);
  const storm = b.storms[0];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: OG.page, color: OG.ink, padding: 56, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
          <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, letterSpacing: 10 }}>TIDE</div>
          <div style={{ display: 'flex', fontSize: 22, color: OG.muted }}>smart-money weather · {b.chains.length} chains · Nansen API</div>
        </div>
        <div style={{ display: 'flex', fontSize: 52, fontWeight: 700, marginTop: 28, lineHeight: 1.15, maxWidth: 1080 }}>{mapHeadline(b.chains, b.fronts)}</div>
        <div style={{ display: 'flex', fontSize: 26, color: OG.ink2, marginTop: 14 }}>{frontsHeadline(b.fronts)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 36 }}>
          {tiles.map((c) => {
            const cls = pressureClass(c.cpi!);
            const bg = cls === 'mid' ? OG.mid : OG[cls as keyof typeof OG];
            return (
              <div key={c.chain} style={{ display: 'flex', flexDirection: 'column', width: 168, padding: '12px 16px', borderRadius: 14, background: bg, color: ogInk(cls) }}>
                <div style={{ display: 'flex', fontSize: 22 }}>{chainName(c.chain)}</div>
                <div style={{ display: 'flex', fontSize: 38, fontWeight: 700 }}>{Math.round(c.cpi!)}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', justifyContent: 'space-between', fontSize: 22, color: OG.muted }}>
          <div style={{ display: 'flex' }}>{storm ? `Storm warning: ${storm.symbol ?? 'token'} on ${chainName(storm.chain)} — ${Math.round(storm.score)}/100` : 'No storm warnings'}</div>
          <div style={{ display: 'flex' }}>blue = smart money selling · amber = buying</div>
        </div>
      </div>
    ),
    size,
  );
}
