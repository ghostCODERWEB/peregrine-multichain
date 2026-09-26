// One-line live status per navigation destination, so the menu reads as an
// information surface ("status, not only destination"). Built only from
// tables the scanner already fills: no Nansen call, cached for a minute.
// Smart-money-derived values are the key owner's only.
import { getDb } from '@/server/nansen/db';
import { perpBoard } from '@/server/perps/board';
import { sectorWeather } from '@/server/sectors/weather';
import type { DisplayMode } from '@/server/mode';
import { usd } from '@/lib/viz/format';

export type NavStatus = Record<string, { text: string; tone?: 'in' | 'out' }>;
let memo: { at: number; mode: DisplayMode; value: NavStatus } | null = null;

export function navStatus(mode: DisplayMode, now = Date.now()): NavStatus {
  if (memo && memo.mode === mode && now - memo.at < 60_000) return memo.value;
  const db = getDb();
  const out: NavStatus = {};
  const owner = mode === 'owner';
  try {
    const latest = db.prepare(`SELECT c.chain, c.cpi FROM chain_cpi c JOIN (SELECT chain, MAX(snapshot_at) t FROM chain_cpi GROUP BY chain) m ON m.chain = c.chain AND m.t = c.snapshot_at WHERE c.snapshot_at >= ?`).all(now - 6 * 3_600_000) as Array<{ chain: string; cpi: number }>;
    const acc = latest.filter((r) => r.cpi >= 65).length, dist = latest.filter((r) => r.cpi <= 35).length;
    if (latest.length) out['/'] = { text: `${acc} accumulating · ${dist} distributing` };
  } catch { /* no scan yet */ }
  if (owner) {
    const r = db.prepare(`SELECT SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT wallet) AS wallets FROM smart_money_trades WHERE traded_at >= ?`).get(now - 86_400_000) as { net: number | null; wallets: number };
    if (r.net != null) out['/smart-money'] = { text: `${usd(r.net, { signed: true })} DEX net · ${r.wallets} wallets`, tone: r.net >= 0 ? 'in' : 'out' };
    const top = db.prepare(`SELECT token_symbol AS s, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net FROM smart_money_trades WHERE traded_at >= ? AND token_symbol IS NOT NULL GROUP BY token_symbol ORDER BY net DESC LIMIT 1`).get(now - 86_400_000) as { s: string; net: number } | undefined;
    if (top && top.net > 0) out['/flows'] = { text: `Top SM buy ${top.s} ${usd(top.net, { signed: true })}`, tone: 'in' };
    const sm = db.prepare(`SELECT symbol, positions FROM perp_position_snapshots WHERE at >= ? ORDER BY at DESC LIMIT 1`).get(now - 86_400_000) as { symbol: string; positions: string } | undefined;
    if (sm) {
      const n = (JSON.parse(sm.positions) as Array<unknown[]>).filter((p) => String(p[9] ?? '').includes('smart_money')).length;
      out['/wallet'] = { text: `${n} SM traders in ${sm.symbol}` };
    }
  }
  try {
    const b = perpBoard(owner ? 'private' : 'public', now);
    if (b.venue) out['/perps'] = { text: `OI ${usd(b.venue.openInterest)}${b.venue.ppi != null ? ` · flow ${Math.round(b.venue.ppi)}` : ''}`, tone: b.venue.ppi == null ? undefined : b.venue.ppi >= 50 ? 'in' : 'out' };
  } catch { /* no perp snapshot */ }
  try {
    const w = sectorWeather(owner ? 'private' : 'public', now);
    const lead = w.sectors.filter((s) => (s.netFlow24hUsd ?? 0) > 0 && (s.tokens ?? 0) >= 5).sort((a, b) => b.pressure - a.pressure)[0];
    if (lead) out['/sectors'] = { text: `${lead.sector} ${usd(lead.netFlow24hUsd, { signed: true })}`, tone: 'in' };
  } catch { /* no sector snapshot */ }
  memo = { at: now, mode, value: out };
  return out;
}
