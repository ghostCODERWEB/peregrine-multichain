// The scanner's perp step: one Hyperliquid perp-screener read for all
// traders and one for smart money, hourly (2 credits), stored as the
// history the Perp Pressure Index scores against. It also writes the
// venue's reading into the chain series, so the map's Hyperliquid tile
// carries perp pressure instead of "n/a".
import { callNansen } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import { requestDay } from '@/server/nansen/demo';
import { perpBoard } from './board';

const EVERY_MS = 55 * 60_000;
const KEEP_MS = 7 * 86_400_000;
const COINS = 250;

interface ScreenerRow {
  token_symbol: string; mark_price?: number | null; previous_price_usd?: number | null; funding?: number | null; open_interest?: number | null;
  volume?: number | null; buy_volume?: number | null; sell_volume?: number | null; trader_count?: number | null;
  smart_money_volume?: number | null; smart_money_buy_volume?: number | null; smart_money_sell_volume?: number | null;
  net_position_change?: number | null; current_smart_money_position_longs_usd?: number | null; current_smart_money_position_shorts_usd?: number | null;
  smart_money_longs_count?: number | null; smart_money_shorts_count?: number | null;
}

export function perpScanDue(now: number): boolean {
  const last = (getDb().prepare("SELECT MAX(snapshot_at) AS t FROM perp_snapshots WHERE source = 'all'").get() as { t: number | null }).t;
  return last == null || now - last >= EVERY_MS;
}

const fin = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? v : null);

export async function scanPerps(now: number, errors: string[]): Promise<number> {
  if (!perpScanDue(now)) return 0;
  const date = { from: requestDay(1), to: requestDay(0) };
  const body = (sm: boolean) => ({ date, ...(sm ? { filters: { trader_type: 'sm' } } : {}), pagination: { page: 1, per_page: COINS }, order_by: [{ field: 'open_interest', direction: 'DESC' }] });
  const [all, sm] = await Promise.allSettled([
    callNansen<{ data: ScreenerRow[] }>('perp-screener', body(false), { skipCache: true, record: false }),
    callNansen<{ data: ScreenerRow[] }>('perp-screener', body(true), { skipCache: true, record: false }),
  ]);
  if (all.status === 'rejected') { errors.push(`perp-screener: ${String(all.reason).slice(0, 160)}`); return 0; }
  if (sm.status === 'rejected') errors.push(`perp-screener (smart money): ${String(sm.reason).slice(0, 160)}`);

  const db = getDb();
  const ins = db.prepare(`INSERT OR IGNORE INTO perp_snapshots
    (snapshot_at, source, symbol, mark_price, previous_price, funding, open_interest, volume, buy_volume, sell_volume, trader_count,
     net_position_change, longs_usd, shorts_usd, longs_count, shorts_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let n = 0;
  db.transaction(() => {
    for (const r of all.value.data.data ?? []) {
      if (!r.token_symbol) continue;
      ins.run(now, 'all', r.token_symbol, fin(r.mark_price), fin(r.previous_price_usd), fin(r.funding), fin(r.open_interest),
        fin(r.volume), fin(r.buy_volume), fin(r.sell_volume), fin(r.trader_count), null, null, null, null, null);
      n++;
    }
    if (sm.status === 'fulfilled') {
      for (const r of sm.value.data.data ?? []) {
        if (!r.token_symbol) continue;
        ins.run(now, 'sm', r.token_symbol, fin(r.mark_price), fin(r.previous_price_usd), fin(r.funding), fin(r.open_interest),
          fin(r.smart_money_volume), fin(r.smart_money_buy_volume), fin(r.smart_money_sell_volume), fin(r.trader_count),
          fin(r.net_position_change), fin(r.current_smart_money_position_longs_usd), fin(r.current_smart_money_position_shorts_usd),
          fin(r.smart_money_longs_count), fin(r.smart_money_shorts_count));
      }
    }
    db.prepare('DELETE FROM perp_snapshots WHERE snapshot_at < ?').run(now - KEEP_MS);
  })();

  // The venue's reading on the map, one per view: all traders for public,
  // with smart money for the key owner.
  const put = db.prepare('INSERT INTO chain_cpi (chain, cpi, any_cross_section, windows, snapshot_at, source) VALUES (?, ?, ?, ?, ?, ?)');
  for (const [view, source] of [['public', 'market-flow'], ['private', 'smart-money']] as const) {
    if (view === 'private' && sm.status !== 'fulfilled') continue;
    const b = perpBoard(view, now);
    if (b.venue?.ppi == null) continue;
    put.run('hyperliquid', b.venue.ppi, b.coins.some((c) => c.ppi != null && c.usedCrossSectional) ? 1 : 0, JSON.stringify(['perp']), now, source);
  }
  return n;
}
