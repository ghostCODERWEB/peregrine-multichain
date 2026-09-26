import { getDb } from '@/server/nansen/db';
import { perpBoard } from '@/server/perps/board';
import type { PressureView } from '@/server/weather/queries';
import { spotPerp, type SpotSide } from '@/lib/models/spot-perp';

/** Latest 24h token pulse per token (DEX), joined to the perp board by symbol. Stored data only. */
export function spotPerpBoard(view: PressureView, now = Date.now()) {
  const src = view === 'private' ? 'smart-money' : 'market-flow';
  const spot = (getDb().prepare(`
    SELECT p.symbol, p.netflow AS netflowUsd, p.volume AS volumeUsd FROM token_pulse p
    JOIN (SELECT chain, token_address, MAX(snapshot_at) t FROM token_pulse WHERE window='24h' AND source=? AND snapshot_at >= ? GROUP BY chain, token_address) m
      ON m.chain = p.chain AND m.token_address = p.token_address AND m.t = p.snapshot_at
    WHERE p.window='24h' AND p.source=? AND p.symbol IS NOT NULL AND p.netflow IS NOT NULL AND p.volume > 0`).all(src, now - 36 * 3_600_000, src) as SpotSide[]);
  const board = perpBoard(view, now);
  return spotPerp(spot, board.coins.map((c) => ({ symbol: c.symbol, ppi: c.ppi, openInterest: c.openInterest, smSkew: c.sm?.skew ?? null })));
}
