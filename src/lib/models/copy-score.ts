// Copy-trade candidate score, 0–100, for a Hyperliquid trader on Nansen's
// perp leaderboard. It rates how *copyable* a record looks, not whether to
// copy it: return, whether the profit held across windows and was banked,
// and how much risk is open right now. No track record until M9 backtests
// it; the page says so.

export interface TraderWindow {
  totalPnl: number | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  /** Fraction: 0.29 = 29%. */
  roi: number | null;
  accountValue: number | null;
  topPositions: Array<{ coin: string; side: string; valueUsd: number; unrealizedUsd: number }>;
}

export interface CopyPart { id: string; label: string; points: number; detail: string }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pc = (x: number) => `${(x * 100).toFixed(0)}%`;

/**
 *   return      = 25·tanh(ROI₃₀ ÷ 0.5)
 *   consistency = +15 profitable over both 7 and 30 days; −5 if the 7-day window lost
 *   banked      = 10·(realized share of 30-day PnL − 0.5), within ±5
 *   leverage    = −15 × how far open positions ÷ account value run past 3× (full at 10×)
 *   open loss   = −10 × losing open positions ÷ 20% of the account
 *   small book  = −10 under $100K account value; −15 when the account is empty now
 *   score       = 50 + Σ, clamped to 0–100
 */
export function copyScore(d30: TraderWindow, d7: TraderWindow | null): { score: number; parts: CopyPart[] } {
  const parts: CopyPart[] = [];
  if (d30.roi != null) parts.push({ id: 'roi', label: 'Return', points: Math.round(25 * Math.tanh(d30.roi / 0.5)), detail: `${pc(d30.roi)} ROI over 30 days` });

  if (d30.totalPnl != null) {
    if (d30.totalPnl > 0 && d7?.totalPnl != null && d7.totalPnl > 0) parts.push({ id: 'consistency', label: 'Consistent', points: 15, detail: 'profitable over both 7 and 30 days' });
    else if (d7?.totalPnl != null && d7.totalPnl <= 0) parts.push({ id: 'consistency', label: 'Recent loss', points: -5, detail: 'the last 7 days lost money' });
  }

  if (d30.totalPnl != null && d30.totalPnl > 0 && d30.realizedPnl != null) {
    const share = clamp(d30.realizedPnl / d30.totalPnl, 0, 1);
    const pts = Math.round(clamp(10 * (share - 0.5), -5, 5));
    if (pts) parts.push({ id: 'banked', label: pts > 0 ? 'Banked' : 'On paper', points: pts, detail: `${pc(share)} of the 30-day profit realized` });
  }

  const acct = d30.accountValue ?? 0;
  if (d30.accountValue != null && acct <= 0) parts.push({ id: 'empty', label: 'No funds now', points: -15, detail: 'the account holds nothing today: nothing to follow' });
  if (acct > 0) {
    const gross = d30.topPositions.reduce((s, p) => s + Math.abs(p.valueUsd), 0);
    const lev = gross / acct;
    const levPts = -Math.round(15 * clamp((lev - 3) / 7, 0, 1));
    if (levPts) parts.push({ id: 'leverage', label: 'Leverage', points: levPts, detail: `open positions ${lev.toFixed(1)}× the account` });
    const loss = d30.topPositions.reduce((s, p) => s + Math.max(0, -p.unrealizedUsd), 0);
    const lossPts = -Math.round(10 * clamp(loss / (0.2 * acct), 0, 1));
    if (lossPts) parts.push({ id: 'open-loss', label: 'Open loss', points: lossPts, detail: `${pc(loss / acct)} of the account underwater` });
    if (acct < 100_000) parts.push({ id: 'small', label: 'Small book', points: -10, detail: 'under $100K: a short record moves a lot on one trade' });
  }

  const score = Math.round(clamp(50 + parts.reduce((s, p) => s + p.points, 0), 0, 100));
  return { score, parts: parts.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)) };
}
