// Token Checker's landing data, from stored Nansen reads (no call per view):
// every token scored in the last 7 days with its Token Score (50% Nansen's
// risk indicator, 50% Peregrine's model), the token universe from the
// scanner's screener snapshots, new tokens, and Smart Money buying into risk.
import { getDb } from '@/server/nansen/db';
import { properAddress } from '@/server/nansen/address-case';
import { tokenScore, type StormSubScores } from '@/lib/models/storm-score';

const D = 86_400_000;

export interface ScoredToken {
  chain: string; address: string; symbol: string; score: number; band: string; nansen: number | null; peregrine: number | null;
  confidence: number; sub: Record<string, number | null>; marketCap: number | null; at: number;
}
export interface UniverseToken {
  chain: string; address: string; symbol: string | null; price: number | null; change: number | null; volume: number | null; liquidity: number | null;
  marketCap: number | null; ageDays: number | null; netflow: number | null; smNetflow: number | null; turnover: number | null; score: number | null;
}
export interface CheckerData {
  scored: ScoredToken[];
  universe: UniverseToken[];
  fresh: UniverseToken[];
  smIntoRisk: Array<{ chain: string; address: string; symbol: string; net: number; buyers: number; score: number }>;
  stats: { scored: number; high: number; avg: number | null; tracked: number; newTokens: number; thin: number };
  at: number | null;
}

export function tokenChecker(owner: boolean, now = Date.now()): CheckerData {
  const db = getDb();
  const rows = db.prepare(`SELECT s.chain, s.token_address AS t, s.symbol, s.sub_scores AS sub, s.market_cap_usd AS mc, s.computed_at AS at FROM storm_scores s
    JOIN (SELECT chain, token_address, MAX(computed_at) m FROM storm_scores WHERE computed_at >= ? GROUP BY chain, token_address) x ON x.chain = s.chain AND x.token_address = s.token_address AND x.m = s.computed_at
    WHERE COALESCE(s.symbol, '') <> ''`).all(now - 7 * D) as Array<{ chain: string; t: string; symbol: string; sub: string; mc: number | null; at: number }>;
  // Recomputed from the stored inputs, so older rows use the current 50/50 Token Score too.
  // Only rows scored by the current model (v2): the old Nansen term read signal percentiles as risk.
  const scored: ScoredToken[] = rows.filter((r) => (JSON.parse(r.sub) as { v?: number }).v === 2).map((r) => {
    const { v: _v, stable: _s, ...sub } = JSON.parse(r.sub) as Record<string, number | null>;
    void _v;
    const ts = tokenScore(sub as unknown as StormSubScores, { marketCapUsd: r.mc, isStablecoin: (_s as unknown) === true, symbol: r.symbol });
    return { chain: r.chain, address: properAddress(r.chain, r.t), symbol: r.symbol, score: ts.score, band: ts.band, nansen: ts.nansen, peregrine: ts.peregrine, confidence: ts.confidence, sub, marketCap: r.mc, at: r.at };
  }).sort((a, b) => b.score - a.score);
  const scoreOf = new Map(scored.map((s) => [`${s.chain}:${s.address.toLowerCase()}`, s.score]));

  // The universe is always the all-trader screener (real market volume); the smart-money
  // screener's volume counts only Smart Money's own trades, so it only supplies the SM net flow.
  const latest = (src: string) => (db.prepare(`SELECT MAX(snapshot_at) AS t FROM token_pulse WHERE window = '24h' AND source = ?`).get(src) as { t: number | null }).t;
  const last = latest('market-flow');
  const uni = last ? db.prepare(`SELECT chain, token_address AS a, symbol, price_usd AS price, price_change AS change, volume, liquidity, market_cap AS mc, age_days AS age, netflow
    FROM token_pulse WHERE window = '24h' AND source = 'market-flow' AND snapshot_at = ?`).all(last) as Array<{ chain: string; a: string; symbol: string | null; price: number | null; change: number | null; volume: number | null; liquidity: number | null; mc: number | null; age: number | null; netflow: number | null }> : [];
  const smLast = owner ? latest('smart-money') : null;
  const smFlow = new Map(smLast ? (db.prepare(`SELECT chain, lower(token_address) AS a, netflow FROM token_pulse WHERE window = '24h' AND source = 'smart-money' AND snapshot_at = ?`).all(smLast) as Array<{ chain: string; a: string; netflow: number | null }>).map((r) => [`${r.chain}:${r.a}`, r.netflow]) : []);
  // Nansen marks new tokens with a seedling emoji; the age column already says so.
  const universe: UniverseToken[] = uni.map((u) => ({ chain: u.chain, address: u.a, symbol: u.symbol?.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').trim() || null, price: u.price, change: u.change, volume: u.volume, liquidity: u.liquidity, marketCap: u.mc, ageDays: u.age, netflow: u.netflow,
    smNetflow: owner ? smFlow.get(`${u.chain}:${u.a.toLowerCase()}`) ?? null : null,
    turnover: u.volume && u.liquidity ? u.volume / u.liquidity : null, score: scoreOf.get(`${u.chain}:${u.a.toLowerCase()}`) ?? null })).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  const fresh = universe.filter((u) => u.ageDays != null && u.ageDays <= 7).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));

  const smIntoRisk = owner ? (db.prepare(`SELECT chain, token_address AS a, MAX(token_symbol) AS s, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT CASE WHEN side='buy' THEN wallet END) AS buyers
    FROM smart_money_trades WHERE traded_at >= ? GROUP BY chain, token_address HAVING net > 0`).all(now - D) as Array<{ chain: string; a: string; s: string | null; net: number; buyers: number }>)
    .map((r) => ({ chain: r.chain, address: r.a, symbol: r.s ?? r.a.slice(0, 6), net: r.net, buyers: r.buyers, score: scoreOf.get(`${r.chain}:${r.a.toLowerCase()}`) ?? -1 }))
    .filter((r) => r.score >= 50).sort((a, b) => b.score - a.score) : [];

  return {
    scored, universe, fresh, smIntoRisk,
    stats: { scored: scored.length, high: scored.filter((s) => s.score > 50).length, avg: scored.length ? scored.reduce((a, s) => a + s.score, 0) / scored.length : null, tracked: universe.length, newTokens: fresh.length, thin: universe.filter((u) => (u.turnover ?? 0) > 5).length },
    at: last,
  };
}
