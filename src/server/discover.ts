import { getDb } from '@/server/nansen/db';
import type { PressureView } from '@/server/weather/queries';
import type { AlphaRow } from '@/server/alpha/board';

/** Discover's universe: the most-traded tokens in the latest 24h scanner read
 *  (both directions), shaped like board rows; alpha scores attached when the
 *  token is on the board. Stored data only. */
export function discoverUniverse(view: PressureView, scores: Map<string, AlphaRow>, now = Date.now(), limit = 150): AlphaRow[] {
  const src = view === 'private' ? 'smart-money' : 'market-flow';
  const rows = getDb().prepare(`
    SELECT p.chain, p.token_address, p.symbol, p.netflow, p.volume, p.price_change, p.liquidity, p.market_cap, p.price_usd FROM token_pulse p
    JOIN (SELECT chain, token_address, MAX(snapshot_at) t FROM token_pulse WHERE window='24h' AND source=? AND snapshot_at >= ? GROUP BY chain, token_address) m
      ON m.chain = p.chain AND m.token_address = p.token_address AND m.t = p.snapshot_at
    WHERE p.window='24h' AND p.source=? AND p.volume >= 50000 AND p.netflow IS NOT NULL
    ORDER BY p.volume DESC LIMIT ?`).all(src, now - 36 * 3_600_000, src, limit) as Array<{ chain: string; token_address: string; symbol: string | null; netflow: number; volume: number; price_change: number | null; liquidity: number | null; market_cap: number | null; price_usd: number | null }>;
  return rows.map((r) => {
    const a = scores.get(`${r.chain}:${r.token_address.toLowerCase()}`);
    return {
      chain: r.chain, tokenAddress: r.token_address, symbol: r.symbol, logo: a?.logo ?? null, score: a?.score ?? 50, parts: a?.parts ?? [], hourly: a?.hourly ?? [],
      flowShare: r.netflow / r.volume, volume24hUsd: r.volume, liquidityUsd: r.liquidity, marketCapUsd: r.market_cap, priceChange24h: r.price_change, priceUsd: r.price_usd,
    };
  });
}
