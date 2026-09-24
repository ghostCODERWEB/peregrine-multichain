// Reading Nansen's perp/account and perp/positions (Hyperliquid clearinghouse
// state). Values arrive as decimal strings, nested under marginSummary; the
// flat names are kept as fallbacks. Missing values stay null, never 0.
type Row = Record<string, unknown>;
const n = (v: unknown): number | null => { if (v == null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
const obj = (v: unknown): Row => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Row) : {});

export interface PerpAccountView { accountValue: number | null; withdrawable: number | null; marginUsed: number | null; notional: number | null; spotUsdc: number | null }

export function perpAccountView(raw: unknown): PerpAccountView {
  const a = obj(raw), m = obj(a.marginSummary);
  return {
    accountValue: n(m.accountValue) ?? n(a.account_value) ?? n(a.accountValue),
    withdrawable: n(a.withdrawable),
    marginUsed: n(m.totalMarginUsed),
    notional: n(m.totalNtlPos),
    spotUsdc: n(a.spotUsdc),
  };
}

export interface PerpPositionView { coin: string; size: number; entry: number | null; uPnl: number | null; leverage: string | null; liquidation: number | null }

export function perpPositionView(raw: unknown): PerpPositionView | null {
  const p = obj(raw);
  const coin = typeof p.coin === 'string' ? p.coin : typeof p.token_symbol === 'string' ? p.token_symbol : null;
  const size = n(p.szi) ?? n(p.size);
  if (!coin || size == null || size === 0) return null;
  const lev = obj(p.leverage), lv = n(lev.value);
  return {
    coin, size, entry: n(p.entryPx) ?? n(p.entry_price), uPnl: n(p.unrealizedPnl) ?? n(p.unrealized_pnl),
    leverage: lv == null ? null : `${lv}× ${lev.type === 'isolated' ? 'isolated' : 'cross'}`,
    liquidation: n(p.liquidationPx),
  };
}
