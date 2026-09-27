// Cascades history. Nansen's Smart Money trade feed (smart-money/dex-trades) only covers the trailing 24 hours,
// so entry order across weeks cannot be read from it. Token God Mode's per-token trades (tgm/dex-trades) take a
// date range and an only_smart_money filter: this backfills 30 days of labeled Smart Money trades for the tokens
// Smart Money touches most, into cascade_trades.
import { getDb } from '@/server/nansen/db';
import { traced } from '@/server/nansen/traced';
import { requestDay } from '@/server/nansen/demo';
import { contractUnavailable } from '@/server/nansen/support';
import type { TGMDexTradesResponse } from '@/types/nansen/token-god-mode';

export function ensureCascadeTable() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS cascade_trades (
    chain TEXT NOT NULL, token_address TEXT NOT NULL, token_symbol TEXT, wallet TEXT NOT NULL, wallet_label TEXT,
    side TEXT NOT NULL, usd_value REAL, traded_at INTEGER NOT NULL, tx_hash TEXT NOT NULL,
    PRIMARY KEY (tx_hash, wallet, token_address)
  );
  CREATE INDEX IF NOT EXISTS cascade_trades_token ON cascade_trades(chain, token_address, traded_at);`);
}

export async function backfillCascades(opts: { tokens?: number; days?: number; perPage?: number } = {}) {
  ensureCascadeTable();
  const db = getDb();
  const picks = db.prepare(`SELECT chain, token_address AS token, MAX(token_symbol) AS symbol, COUNT(DISTINCT wallet) AS w
    FROM smart_money_trades WHERE side = 'buy' GROUP BY chain, token_address HAVING w >= 2 ORDER BY w DESC LIMIT ?`).all(opts.tokens ?? 150) as Array<{ chain: string; token: string; symbol: string | null; w: number }>;
  const ins = db.prepare(`INSERT OR IGNORE INTO cascade_trades (chain, token_address, token_symbol, wallet, wallet_label, side, usd_value, traded_at, tx_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let calls = 0, stored = 0, failed = 0;
  for (let i = 0; i < picks.length; i += 5) {
    await Promise.all(picks.slice(i, i + 5).map(async (p) => {
      if (contractUnavailable('POST /api/v1/tgm/dex-trades', p.chain, 'DEX trades')) return;
      try {
        const r = await traced<TGMDexTradesResponse>('tgm/dex-trades', {
          chain: p.chain, token_address: p.token, only_smart_money: true,
          date: { from: requestDay(opts.days ?? 30), to: requestDay(0) },
          pagination: { page: 1, per_page: opts.perPage ?? 1000 }, order_by: [{ field: 'block_timestamp', direction: 'ASC' }],
        }, 1);
        calls++;
        const tx = db.transaction(() => {
          for (const t of r.data.data) {
            const res = ins.run(p.chain, p.token, p.symbol, t.trader_address, t.trader_address_label ?? null, t.action === 'BUY' ? 'buy' : 'sell',
              Number.isFinite(t.estimated_value_usd) ? t.estimated_value_usd : null, Date.parse(t.block_timestamp), t.transaction_hash);
            stored += res.changes;
          }
        });
        tx();
      } catch { failed++; }
    }));
  }
  return { tokens: picks.length, calls, stored, failed };
}
