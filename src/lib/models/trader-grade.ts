// A wallet's trading grade per market, 0 to 100, and an overall verdict.
// Each grade starts at 50: profit (log scale, signed), win rate shrunk toward
// 50% until there are enough trades, and return on capital or profit factor.
// Too few trades to judge gives no grade rather than a guess.

export interface Grade { score: number; verdict: string; tone: 'good' | 'mixed' | 'bad'; basis: string }
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const profitPts = (usd: number, max = 16) => (usd === 0 ? 0 : Math.sign(usd) * clamp(5 * Math.log10(Math.abs(usd) / 1_000), 0, max));
const winPts = (rate: number | null, n: number, k = 20, w = 40) => (rate == null ? 0 : ((n / (n + k)) * rate + (k / (n + k)) * 0.5 - 0.5) * w);

/** `pnl`, when known, keeps the middle band honest: a +$1.6M trader with a low win rate scores in
 *  the middle, but "Break-even" would misstate the money, so the words follow the profit's sign. */
export function verdictOf(score: number, pnl?: number | null): Pick<Grade, 'verdict' | 'tone'> {
  if (score >= 75) return { verdict: 'Strong trader', tone: 'good' };
  if (score >= 60) return { verdict: 'Profitable', tone: 'good' };
  if (score >= 45) {
    if (pnl != null && pnl >= 10_000) return { verdict: 'Profitable, low hit rate', tone: 'mixed' };
    if (pnl != null && pnl <= -10_000) return { verdict: 'Slightly losing', tone: 'mixed' };
    return { verdict: 'Break-even', tone: 'mixed' };
  }
  if (score >= 30) return { verdict: 'Losing', tone: 'bad' };
  return { verdict: 'Consistently losing', tone: 'bad' };
}
const make = (raw: number, basis: string, pnl?: number | null): Grade => { const score = Math.round(clamp(raw, 0, 100)); return { score, ...verdictOf(score, pnl), basis }; };

/** Spot, from Nansen's 30-day PnL summary (realized). */
export function spotGrade(p: { realizedUsd: number | null; realizedPct: number | null; winRate: number | null; exits: number | null }): Grade | null {
  const n = p.exits ?? 0;
  if (n < 3 || p.realizedUsd == null) return null;
  const roi = p.realizedPct != null ? clamp(p.realizedPct * 20, -10, 10) : 0;
  return make(50 + profitPts(p.realizedUsd) + winPts(p.winRate, n) + roi, `${n} exits, 30 days`, p.realizedUsd);
}

/** Perps, from 30 days of Hyperliquid closed trades. */
export function perpGrade(s: { closedTrades: number; winRate: number | null; profitFactor: number | null; realizedPnl: number } | null): Grade | null {
  if (!s || s.closedTrades < 3) return null;
  const pf = s.profitFactor == null ? 0 : clamp((Math.log2(Math.max(0.05, s.profitFactor))) * 8, -12, 12);
  return make(50 + profitPts(s.realizedPnl) + winPts(s.winRate, s.closedTrades, 20, 30) + pf, `${s.closedTrades} closed trades, 30 days`, s.realizedPnl);
}

/** Prediction markets, from the lifetime Polymarket summary. */
export function predictGrade(s: { realizedUsd: number | null; unrealizedUsd: number | null; marketsTraded: number | null; winRate: number | null } | null): Grade | null {
  const n = s?.marketsTraded ?? 0;
  if (!s || n < 3) return null;
  const pnl = (s.realizedUsd ?? 0) + (s.unrealizedUsd ?? 0);
  return make(50 + profitPts(pnl) + winPts(s.winRate, n, 15, 50), `${n} markets, lifetime`, pnl);
}

/** Overall: each market's grade weighted by how much it trades there. */
export function overallGrade(parts: Array<{ grade: Grade | null; weight: number; pnl?: number | null }>): Grade | null {
  const g = parts.filter((p): p is { grade: Grade; weight: number } => !!p.grade && p.weight > 0);
  if (!g.length) return null;
  const w = g.reduce((s, p) => s + p.weight, 0);
  const known = parts.filter((p) => p.grade && p.pnl != null);
  const pnl = known.length ? known.reduce((s, p) => s + p.pnl!, 0) : null;
  return make(g.reduce((s, p) => s + p.grade.score * p.weight, 0) / w, `${g.length} market${g.length > 1 ? 's' : ''}`, pnl);
}
