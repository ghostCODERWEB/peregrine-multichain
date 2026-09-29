// The share card every page's link preview uses: Peregrine's navy with the mint glow, the falcon mark, the
// section, a headline written from the page's own data, up to four figures and the address. 1200×630, the
// size every network crops from. Renders with satori (next/og): inline styles only, every box display:flex.
import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { OG } from '@/lib/viz/og-palette';
import { siteUrl } from '@/server/seo';

export const OG_SIZE = { width: 1200, height: 630 } as const;

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel));
let assets: { fonts: Array<{ name: string; data: Buffer; weight: 500 | 700 | 800; style: 'normal' }>; logo: string } | null = null;
/** The site's typeface (Manrope) and the falcon mark, read once per server. */
function load() {
  if (assets) return assets;
  const fonts = ([500, 700, 800] as const).map((weight) => ({ name: 'Manrope', data: read(`src/lib/og/fonts/manrope-${weight}.ttf`), weight, style: 'normal' as const }));
  const logo = `data:image/png;base64,${read('public/brand/peregrine-256.png').toString('base64')}`;
  assets = { fonts, logo };
  return assets;
}

export type Tone = 'up' | 'down' | 'warn' | 'plain';
const TONE: Record<Tone, string> = { up: OG.mint, down: OG.flare, warn: OG.amber, plain: OG.ink };

export interface OgStat { label: string; value: string; tone?: Tone }

/** Headlines shrink as they grow, so a long one still fits two or three lines. */
const headlineSize = (t: string) => (t.length > 110 ? 40 : t.length > 80 ? 46 : t.length > 50 ? 54 : 62);

export function ogCard(p: { section: string; title: string; subtitle?: string; stats?: OgStat[]; chips?: string[]; body?: React.ReactNode; accent?: string }) {
  const { fonts, logo } = load();
  const accent = p.accent ?? OG.mint;
  const host = siteUrl().replace(/^https?:\/\//, '');
  const stats = (p.stats ?? []).slice(0, 4);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '48px 60px 40px', color: OG.ink, fontFamily: 'Manrope',
          backgroundColor: OG.page,
          backgroundImage: `radial-gradient(900px 520px at 8% -10%, ${accent}26, transparent 70%), radial-gradient(700px 420px at 110% 120%, ${OG.signal}14, transparent 70%)`,
        }}
      >
        {/* Brand line: the falcon mark and wordmark, the section on the right. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain img */}
            <img src={logo} width={56} height={56} style={{ borderRadius: 16, border: `1px solid ${OG.hair}` }} alt="" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>Peregrine</div>
              <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, letterSpacing: 3, color: OG.muted, marginTop: 6 }}>ONCHAIN INTELLIGENCE</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderRadius: 999, border: `1.5px solid ${accent}66`, backgroundColor: `${accent}14`, color: accent, fontSize: 22, fontWeight: 700 }}>
            <div style={{ display: 'flex', width: 10, height: 10, borderRadius: 999, backgroundColor: accent }} />
            {p.section}
          </div>
        </div>

        {/* Headline and the line under it. */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, maxWidth: 1080 }}>
          <div style={{ display: 'flex', fontSize: headlineSize(p.title), fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.2 }}>{p.title}</div>
          {p.subtitle && <div style={{ display: 'flex', fontSize: 26, fontWeight: 500, color: OG.ink2, marginTop: 16, lineHeight: 1.35 }}>{p.subtitle}</div>}
        </div>

        {/* Figures, or the card's own body; a section card without figures names what the section holds. */}
        {!p.body && !stats.length && p.chips?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 'auto' }}>
            {p.chips.map((c) => (
              <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderRadius: 999, backgroundColor: OG.surface, border: `1px solid ${OG.hair}`, fontSize: 22, fontWeight: 700, color: OG.ink }}>
                <div style={{ display: 'flex', width: 8, height: 8, borderRadius: 999, backgroundColor: accent }} />
                {c}
              </div>
            ))}
          </div>
        ) : null}
        {p.body ?? (stats.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 'auto' }}>
            {stats.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '18px 22px', borderRadius: 22, backgroundColor: OG.surface, border: `1px solid ${OG.hair}` }}>
                <div style={{ display: 'flex', fontSize: 19, fontWeight: 500, color: OG.muted }}>{s.label}</div>
                <div style={{ display: 'flex', fontSize: 38, fontWeight: 800, letterSpacing: -0.8, marginTop: 6, color: TONE[s.tone ?? 'plain'] }}>{s.value}</div>
              </div>
            ))}
          </div>
        ))}

        {/* Footer: where it lives and whose data it is. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: stats.length || p.body || p.chips?.length ? 26 : 'auto', fontSize: 19, fontWeight: 500, color: OG.muted }}>
          <div style={{ display: 'flex' }}>{host}</div>
          <div style={{ display: 'flex' }}>Built on the Nansen API</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
