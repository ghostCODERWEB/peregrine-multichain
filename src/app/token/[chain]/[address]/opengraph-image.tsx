// Share card for a token: its verdict (Low risk / Watch / Danger), the Token Score dial and the sub-scores,
// from the latest stored score (never a Nansen call: crawlers fetch this).
import { ogCard, OG_SIZE } from '@/lib/og/card';
import { getDb } from '@/server/nansen/db';
import { STORM_CLASS, STORM_LABEL } from '@/lib/viz/scales';
import { chainName, shortAddress } from '@/lib/viz/format';
import { OG } from '@/lib/viz/og-palette';
import type { StormScoreResult } from '@/lib/models/storm-score';
import { tokenVerdict } from '@/server/token/verdict';
import { tokenSymbol } from '@/server/og-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const alt = 'Peregrine Token Score for this token: dump risk from six Nansen-derived inputs';
export const size = OG_SIZE;
export const contentType = 'image/png';

const LABELS: Record<string, string> = { concentration: 'Concentration', insider: 'Insider clusters', windShear: 'Cohort shear', exitLiquidity: 'Exit liquidity', sellPressure: 'Sell pressure', nansenRisk: 'Nansen risk' };

export default async function Image({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  const token = decodeURIComponent(address);
  const r = getDb().prepare('SELECT symbol, score, band, confidence, sub_scores FROM storm_scores WHERE chain = ? AND token_address = ? ORDER BY id DESC LIMIT 1')
    .get(chain, token.toLowerCase()) as { symbol: string | null; score: number; band: StormScoreResult['band']; confidence: number; sub_scores: string } | undefined;
  // The verdict drives the headline, colour and score, so the card matches the page.
  const v = tokenVerdict(chain, token);
  const verdict = v.pending ? null : v;
  const cls = r ? STORM_CLASS[r.band] : 'mid';
  const color = verdict ? (verdict.level === 'danger' ? OG.flare : verdict.level === 'watch' ? OG.amber : OG.mint) : cls === 'mid' ? OG.axis : OG[cls as keyof typeof OG];
  const score = verdict ? verdict.score : r?.score ?? null;
  const word = verdict ? (verdict.level === 'danger' ? 'Danger' : verdict.level === 'watch' ? 'Watch' : 'Low risk') : r ? STORM_LABEL[r.band] : 'Not scored yet';
  const name = tokenSymbol(chain, token) ?? r?.symbol ?? shortAddress(token);
  // Dial: a 240° arc, filled to the score.
  const R = 118, cx = 140, cy = 142, a0 = (210 * Math.PI) / 180, span = (240 * Math.PI) / 180;
  const pt = (t: number) => `${cx + R * Math.cos(a0 - span * t)},${cy - R * Math.sin(a0 - span * t)}`;
  const arc = (t: number) => `M${pt(0)} A${R},${R} 0 ${span * t > Math.PI ? 1 : 0} 1 ${pt(t)}`;
  const sub = r ? (JSON.parse(r.sub_scores) as Record<string, number | null>) : {};
  return ogCard({
    section: 'Token Score',
    accent: color === OG.axis ? OG.mint : color,
    title: `${name} on ${chainName(chain)}: ${word}${score != null ? `, ${Math.round(score)} of 100` : ''}`,
    subtitle: verdict?.sm ? `Smart Money ${verdict.sm.net24h >= 0 ? 'net bought' : 'net sold'} $${Math.round(Math.abs(verdict.sm.net24h)).toLocaleString('en-US')} in 24h · 50% Nansen, 50% Peregrine` : 'Dump risk from six Nansen-derived inputs · 50% Nansen, 50% Peregrine',
    body: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 40, marginTop: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 280 }}>
          <svg width="280" height="230" viewBox="0 0 280 230">
            <path d={arc(1)} stroke={OG.surface2} strokeWidth="22" fill="none" strokeLinecap="round" />
            {score != null && <path d={arc(Math.max(0.01, score / 100))} stroke={color} strokeWidth="22" fill="none" strokeLinecap="round" />}
          </svg>
          <div style={{ display: 'flex', marginTop: -150, fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>{score != null ? Math.round(score) : 'n/a'}</div>
          <div style={{ display: 'flex', marginTop: 34, padding: '6px 20px', borderRadius: 999, backgroundColor: color, color: OG.onLight, fontSize: 22, fontWeight: 800 }}>{word}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          {Object.entries(LABELS).map(([k, label]) => {
            const x = sub[k];
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 21, fontWeight: 500 }}>
                <div style={{ display: 'flex', width: 200, color: OG.ink2 }}>{label}</div>
                <div style={{ display: 'flex', flex: 1, height: 12, borderRadius: 6, backgroundColor: OG.surface2 }}>
                  {x != null && <div style={{ display: 'flex', width: `${Math.max(2, x)}%`, height: 12, borderRadius: 6, backgroundColor: x >= 75 ? OG['storm-3'] : x >= 50 ? OG['storm-2'] : x >= 25 ? OG['storm-1'] : OG.axis }} />}
                </div>
                <div style={{ display: 'flex', width: 56, justifyContent: 'flex-end', fontWeight: 700 }}>{x == null ? 'n/a' : Math.round(x)}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
  });
}
