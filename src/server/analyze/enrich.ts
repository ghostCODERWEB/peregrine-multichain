// Real records behind an element the user selected for analysis: stored Nansen
// reads for a token, wallet or perp coin (no extra call), added to what the
// page itself sent.
import { getDb } from '@/server/nansen/db';

const D = 86_400_000;
type Sel = { kind?: string; chain?: string; address?: string; symbol?: string; id?: string };

export function enrichSelection(sel: Sel, now = Date.now()): Record<string, unknown> | null {
  const db = getDb();
  try {
    if (sel.kind === 'token' && sel.chain && sel.address) {
      const flow = db.prepare(`SELECT SUM(CASE WHEN side='buy' THEN usd_value ELSE 0 END) AS bought, SUM(CASE WHEN side='sell' THEN usd_value ELSE 0 END) AS sold, COUNT(DISTINCT wallet) AS wallets, COUNT(*) AS trades
        FROM smart_money_trades WHERE chain = ? AND token_address = ? AND traded_at >= ?`).get(sel.chain, sel.address, now - D);
      const wallets = db.prepare(`SELECT wallet, MAX(wallet_label) AS label, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net FROM smart_money_trades
        WHERE chain = ? AND token_address = ? AND traded_at >= ? GROUP BY wallet ORDER BY ABS(net) DESC LIMIT 8`).all(sel.chain, sel.address, now - D);
      const risk = db.prepare('SELECT score, band, sub_scores, market_cap_usd, price_usd, computed_at FROM storm_scores WHERE chain = ? AND token_address = ? ORDER BY computed_at DESC LIMIT 1').get(sel.chain, sel.address.toLowerCase());
      return { smartMoneyDex24h: flow, largestSmartMoneyWallets24h: wallets, dumpRisk: risk ?? null };
    }
    if (sel.kind === 'wallet' && sel.address) {
      const trades = db.prepare(`SELECT chain, token_symbol AS symbol, side, usd_value AS usd, traded_at AS at FROM smart_money_trades WHERE wallet = ? AND traded_at >= ? ORDER BY traded_at DESC LIMIT 25`).all(sel.address, now - 7 * D);
      const perps: unknown[] = [];
      const latest = db.prepare('SELECT p.symbol, p.positions FROM perp_position_snapshots p JOIN (SELECT symbol, MAX(at) m FROM perp_position_snapshots GROUP BY symbol) x ON x.symbol = p.symbol AND x.m = p.at').all() as Array<{ symbol: string; positions: string }>;
      // Snapshot tuple: [address, label, long, usd, size, leverage, entry, liq, uPnL, cohorts].
      for (const r of latest) for (const x of JSON.parse(r.positions) as unknown[][]) {
        if (String(x[0]).toLowerCase() === sel.address.toLowerCase()) perps.push({ coin: r.symbol, side: x[2] ? 'long' : 'short', usd: x[3], leverage: x[5], entry: x[6], liquidation: x[7], unrealizedPnlUsd: x[8] });
      }
      return { smartMoneyTrades7d: trades, observedPerpPositions: perps };
    }
    if (sel.kind === 'perp' && sel.symbol) {
      const rows = db.prepare('SELECT source, snapshot_at AS at, mark_price AS mark, funding, open_interest AS oi, volume, longs_usd, shorts_usd FROM perp_snapshots WHERE symbol = ? ORDER BY snapshot_at DESC LIMIT 48').all(sel.symbol);
      return { hyperliquidSnapshots: rows };
    }
  } catch { /* enrichment is best-effort */ }
  return null;
}
