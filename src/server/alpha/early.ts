// Early alpha buys: tokens Smart Money started buying recently. A token counts
// when its first recorded Smart Money trade is in the last 72 hours and at
// least a day after the scanner's history begins (so "first" means new, not
// merely the start of the record), and buying dominates. From stored trades
// and token snapshots: no Nansen call per view.
import { getDb } from '@/server/nansen/db';

export interface EarlyBuy {
  chain: string; token: string; symbol: string | null;
  firstAt: number; wallets: number; buyers: number; boughtUsd: number; soldUsd: number; trades: number;
  topBuyer: { wallet: string; label: string | null; usd: number } | null;
  priceAtFirst: number | null; priceNow: number | null; marketCap: number | null; ageDays: number | null;
}

const H = 3_600_000;

export function earlyAlphaBuys(owner: boolean, now = Date.now(), limit = 18): EarlyBuy[] {
  if (!owner) return [];
  const db = getDb();
  const start = (db.prepare('SELECT MIN(traded_at) AS t FROM smart_money_trades').get() as { t: number | null }).t;
  if (!start) return [];
  const since = Math.max(now - 72 * H, start + 24 * H);
  const rows = db.prepare(`
    SELECT chain, token_address AS token, MAX(token_symbol) AS symbol, MIN(traded_at) AS firstAt, COUNT(DISTINCT wallet) AS wallets,
      COUNT(DISTINCT CASE WHEN side='buy' THEN wallet END) AS buyers,
      SUM(CASE WHEN side='buy' THEN usd_value ELSE 0 END) AS boughtUsd, SUM(CASE WHEN side='sell' THEN usd_value ELSE 0 END) AS soldUsd, COUNT(*) AS trades
    FROM smart_money_trades GROUP BY chain, token_address
    HAVING MIN(traded_at) >= ? AND boughtUsd > soldUsd AND buyers >= 2
    ORDER BY buyers DESC, boughtUsd - soldUsd DESC LIMIT ?`).all(since, limit) as Array<Omit<EarlyBuy, 'topBuyer' | 'priceAtFirst' | 'priceNow' | 'marketCap' | 'ageDays'>>;
  const top = db.prepare(`SELECT wallet, MAX(wallet_label) AS label, SUM(usd_value) AS usd FROM smart_money_trades WHERE chain = ? AND token_address = ? AND side = 'buy' GROUP BY wallet ORDER BY usd DESC LIMIT 1`);
  const pAt = db.prepare(`SELECT price_usd AS p FROM token_pulse WHERE chain = ? AND token_address = ? AND price_usd IS NOT NULL AND snapshot_at <= ? ORDER BY snapshot_at DESC LIMIT 1`);
  const pAfter = db.prepare(`SELECT price_usd AS p FROM token_pulse WHERE chain = ? AND token_address = ? AND price_usd IS NOT NULL AND snapshot_at >= ? ORDER BY snapshot_at ASC LIMIT 1`);
  const latest = db.prepare(`SELECT price_usd AS p, market_cap AS mc, age_days AS age FROM token_pulse WHERE chain = ? AND token_address = ? ORDER BY snapshot_at DESC LIMIT 1`);
  return rows.map((r) => {
    const tb = top.get(r.chain, r.token) as { wallet: string; label: string | null; usd: number } | undefined;
    const first = (pAt.get(r.chain, r.token, r.firstAt) as { p: number } | undefined)?.p ?? (pAfter.get(r.chain, r.token, r.firstAt) as { p: number } | undefined)?.p ?? null;
    const l = latest.get(r.chain, r.token) as { p: number | null; mc: number | null; age: number | null } | undefined;
    return { ...r, topBuyer: tb ? { wallet: tb.wallet, label: tb.label?.replace(/\s*\[.*?\]$/, '') ?? null, usd: tb.usd } : null, priceAtFirst: first, priceNow: l?.p ?? null, marketCap: l?.mc ?? null, ageDays: l?.age ?? null };
  });
}
