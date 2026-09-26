// Token Verdict: one answer to "should I be worried about this token?", from stored reads only.
// The level is a rule on the stored Token Score (50% Nansen, 50% Peregrine); every reason cites the number
// behind it. An optional one-sentence AI read comes from Nansen's agent, cached per token.
import { getDb } from '@/server/nansen/db';
import { tokenScore, type StormSubScores } from '@/lib/models/storm-score';
import { aiBrief, cachedBrief } from '@/server/pulse-brief';
import { usd } from '@/lib/viz/format';

export type VerdictLevel = 'safe' | 'watch' | 'danger';
export interface VerdictReason { text: string; tone: 'bad' | 'good' | 'neutral' }
export interface Verdict {
  pending: false;
  level: VerdictLevel;
  headline: string;
  score: number;
  nansen: number | null;
  peregrine: number | null;
  reasons: VerdictReason[];
  sm: { net24h: number; buyers: number; sellers: number } | null;
  ai: { text: string; at: number } | null;
  scoredAt: number;
  symbol: string | null;
}

const D = 86_400_000;
const tier = (v: number) => (v >= 60 ? 'high' : v >= 40 ? 'moderate' : 'low');
const toneOf = (v: number): VerdictReason['tone'] => (v >= 60 ? 'bad' : v >= 40 ? 'neutral' : 'good');
const SUB_TEXT: Record<string, (v: number) => VerdictReason> = {
  concentration: (v) => ({ text: `Holder concentration is ${tier(v)} (${Math.round(v)}/100)${v >= 60 ? ': a few wallets hold much of the supply' : ''}`, tone: toneOf(v) }),
  insider: (v) => ({ text: `Linked insider wallets: ${tier(v)} (${Math.round(v)}/100)${v >= 60 ? ', a coordinated position' : ''}`, tone: toneOf(v) }),
  exitLiquidity: (v) => ({ text: `Exit liquidity risk is ${tier(v)} (${Math.round(v)}/100)${v >= 60 ? ': thin pools for a large exit' : ''}`, tone: toneOf(v) }),
  sellPressure: (v) => ({ text: `Sell pressure from top traders is ${tier(v)} (${Math.round(v)}/100, 7 days)`, tone: toneOf(v) }),
  windShear: (v) => ({ text: v >= 60 ? `Fresh wallets are buying while Smart Money sells (momentum ${Math.round(v)}/100)` : `Momentum divergence is ${tier(v)} (${Math.round(v)}/100)`, tone: toneOf(v) }),
};

export function tokenVerdict(chain: string, address: string, now = Date.now()): Verdict | { pending: true } {
  const db = getDb();
  const row = db.prepare(`SELECT symbol, sub_scores AS sub, market_cap_usd AS mc, computed_at AS at FROM storm_scores
    WHERE chain = ? AND token_address = ? AND sub_scores LIKE '%"v":2%' ORDER BY computed_at DESC LIMIT 1`).get(chain, address.toLowerCase()) as { symbol: string | null; sub: string; mc: number | null; at: number } | undefined;
  if (!row) return { pending: true };
  const { v: _v, stable, ...sub } = JSON.parse(row.sub) as Record<string, number | null> & { v?: number; stable?: boolean };
  void _v;
  const ts = tokenScore(sub as unknown as StormSubScores, { marketCapUsd: row.mc, isStablecoin: stable === true, symbol: row.symbol });

  const smRow = db.prepare(`SELECT SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net,
      COUNT(DISTINCT CASE WHEN side='buy' THEN wallet END) AS buyers, COUNT(DISTINCT CASE WHEN side='sell' THEN wallet END) AS sellers
    FROM smart_money_trades WHERE chain = ? AND lower(token_address) = ? AND traded_at >= ?`).get(chain, address.toLowerCase(), now - D) as { net: number | null; buyers: number; sellers: number };
  const sm = smRow.buyers + smRow.sellers > 0 ? { net24h: smRow.net ?? 0, buyers: smRow.buyers, sellers: smRow.sellers } : null;

  const level: VerdictLevel = ts.score >= 55 ? 'danger' : ts.score >= 35 ? 'watch' : 'safe';
  // The drivers: the strongest sub-scores in the direction of the verdict first.
  const subs = Object.entries(SUB_TEXT).flatMap(([k, f]) => (typeof sub[k] === 'number' ? [{ k, v: sub[k] as number, r: f(sub[k] as number) }] : []));
  subs.sort((a, b) => (level === 'safe' ? a.v - b.v : b.v - a.v));
  const reasons: VerdictReason[] = subs.slice(0, 2).map((x) => x.r);
  if (ts.nansen != null) reasons.push({ text: `Nansen's own risk indicators read ${ts.nansen >= 60 ? 'high' : ts.nansen >= 35 ? 'medium' : 'low'} (${Math.round(ts.nansen)}/100)`, tone: ts.nansen >= 60 ? 'bad' : ts.nansen < 35 ? 'good' : 'neutral' });
  if (sm) {
    const buyingRisk = sm.net24h > 0 && level !== 'safe';
    reasons.unshift({ text: `Smart Money ${sm.net24h >= 0 ? 'net bought' : 'net sold'} ${usd(Math.abs(sm.net24h))} in 24h (${sm.buyers} buying, ${sm.sellers} selling)${buyingRisk ? ', buying into elevated risk' : ''}`, tone: sm.net24h >= 0 ? (buyingRisk ? 'neutral' : 'good') : 'bad' });
  }
  const headline = level === 'danger' ? 'Danger: several risk signals line up' : level === 'watch' ? 'Watch: some risk signals are elevated' : 'Low risk on the signals Peregrine measures';
  const ai = cachedBrief(`verdict:${chain}:${address.toLowerCase()}`);
  return { pending: false, level, headline, score: ts.score, nansen: ts.nansen, peregrine: ts.peregrine, reasons: reasons.slice(0, 4), sm, ai, scoredAt: row.at, symbol: row.symbol };
}

/** One sentence from Nansen's agent over the verdict's facts; cached per token (regenerated when the facts change). */
export async function verdictAi(chain: string, address: string, v: Verdict) {
  const items = [
    { id: 'score', kind: 'Token Score', text: `${Math.round(v.score)}/100, ${v.level}`, detail: `Nansen half ${v.nansen != null ? Math.round(v.nansen) : 'n/a'}, Peregrine half ${v.peregrine != null ? Math.round(v.peregrine) : 'n/a'}`, tone: 'flat', href: '' },
    ...v.reasons.map((r, i) => ({ id: `r${i}`, kind: 'Signal', text: r.text, detail: '', tone: 'flat', href: '' })),
  ] as unknown as Parameters<typeof aiBrief>[1];
  return aiBrief(`verdict:${chain}:${address.toLowerCase()}`, items, `the token ${v.symbol ?? address} on ${chain}: is it risky to hold right now, and why`);
}
