// Share card for a token: its Storm Score dial, band, confidence and the
// six sub-scores — from the latest score TIDE stored for it.
import { ImageResponse } from 'next/og';
import { getDb } from '@/server/nansen/db';
import { STORM_CLASS, STORM_LABEL } from '@/lib/viz/scales';
import { chainName, shortAddress } from '@/lib/viz/format';
import { OG } from '@/lib/viz/og-palette';
import type { StormScoreResult } from '@/lib/models/storm-score';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Peregrine Dump Risk for this token';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const LABELS: Record<string, string> = { concentration: 'Concentration', insider: 'Insider clusters', windShear: 'Cohort shear', exitLiquidity: 'Exit liquidity', sellPressure: 'Sell pressure', nansenRisk: 'Nansen risk' };

export default async function Image({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  const token = decodeURIComponent(address);
  const r = getDb().prepare('SELECT symbol, score, band, confidence, sub_scores FROM storm_scores WHERE chain = ? AND token_address = ? ORDER BY id DESC LIMIT 1')
    .get(chain, token.toLowerCase()) as { symbol: string | null; score: number; band: StormScoreResult['band']; confidence: number; sub_scores: string } | undefined;
  const cls = r ? STORM_CLASS[r.band] : 'mid';
  const color = cls === 'mid' ? OG.axis : OG[cls as keyof typeof OG];
  // Dial: a 240° arc, filled to the score.
  const R = 150, cx = 180, cy = 190, a0 = (210 * Math.PI) / 180, span = (240 * Math.PI) / 180;
  const pt = (t: number) => `${cx + R * Math.cos(a0 - span * t)},${cy - R * Math.sin(a0 - span * t)}`;
  const arc = (t: number) => `M${pt(0)} A${R},${R} 0 ${span * t > Math.PI ? 1 : 0} 1 ${pt(t)}`;
  const sub = r ? (JSON.parse(r.sub_scores) as Record<string, number | null>) : {};
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: OG.page, color: OG.ink, padding: 56, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', width: 380, alignItems: 'center' }}>
          <svg width="360" height="300" viewBox="0 0 360 300">
            <path d={arc(1)} stroke={OG.axis} strokeWidth="26" fill="none" strokeLinecap="round" />
            {r && <path d={arc(Math.max(0.01, r.score / 100))} stroke={color} strokeWidth="26" fill="none" strokeLinecap="round" />}
          </svg>
          <div style={{ display: 'flex', marginTop: -170, fontSize: 96, fontWeight: 700 }}>{r ? Math.round(r.score) : 'n/a'}</div>
          <div style={{ display: 'flex', marginTop: 50, padding: '8px 22px', borderRadius: 999, background: color, color: OG.onLight, fontSize: 28, fontWeight: 700 }}>{r ? STORM_LABEL[r.band] : 'Not scored yet'}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 40, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>Peregrine</div>
            <div style={{ display: 'flex', fontSize: 22, color: OG.muted }}>Dump Risk · 7 days</div>
          </div>
          <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, marginTop: 18 }}>{r?.symbol ?? shortAddress(token)}</div>
          <div style={{ display: 'flex', fontSize: 26, color: OG.ink2 }}>{chainName(chain)}{r ? ` · confidence ${Math.round(r.confidence * 100)}%` : ''}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 30 }}>
            {Object.entries(LABELS).map(([k, label]) => {
              const v = sub[k];
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 22 }}>
                  <div style={{ display: 'flex', width: 210, color: OG.ink2 }}>{label}</div>
                  <div style={{ display: 'flex', width: 380, height: 14, borderRadius: 7, background: OG.surface2 }}>
                    {v != null && <div style={{ display: 'flex', width: `${Math.max(2, v)}%`, height: 14, borderRadius: 7, background: v >= 75 ? OG['storm-3'] : v >= 50 ? OG['storm-2'] : v >= 25 ? OG['storm-1'] : OG.axis }} />}
                  </div>
                  <div style={{ display: 'flex', width: 60, textAlign: 'right' }}>{v == null ? 'n/a' : Math.round(v)}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', marginTop: 'auto', fontSize: 20, color: OG.muted }}>Computed from Nansen API data · probabilistic, not financial advice</div>
        </div>
      </div>
    ),
    size,
  );
}
