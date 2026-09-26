// Market Intelligence Graph, from stored Nansen reads only (no calls): which
// wallets appear in more than one place: open perp positions per coin (latest
// snapshot) and Smart Money DEX trades (24h). Every edge is a real record.
import { getDb } from '@/server/nansen/db';
import type { Cohort } from '@/lib/perps/positions';

export interface Presence { kind: 'perp' | 'spot'; key: string; side: string; usd: number }
export interface Overlap { address: string; label: string | null; cohorts: Cohort[]; presence: Presence[]; totalUsd: number }

export function walletOverlaps(now = Date.now(), minPlaces = 2): { wallets: Overlap[]; sources: string[] } {
  const db = getDb();
  const map = new Map<string, Overlap>();
  const add = (address: string, label: string | null, cohorts: Cohort[], p: Presence) => {
    const k = address.toLowerCase();
    const cur = map.get(k) ?? { address, label, cohorts: [], presence: [], totalUsd: 0 };
    if (!cur.label && label) cur.label = label;
    for (const c of cohorts) if (!cur.cohorts.includes(c)) cur.cohorts.push(c);
    cur.presence.push(p);
    cur.totalUsd += p.usd;
    map.set(k, cur);
  };
  const snaps = db.prepare(`SELECT s.symbol, s.positions FROM perp_position_snapshots s JOIN (SELECT symbol, MAX(at) t FROM perp_position_snapshots WHERE at >= ? GROUP BY symbol) m ON m.symbol = s.symbol AND m.t = s.at`).all(now - 86_400_000) as Array<{ symbol: string; positions: string }>;
  for (const s of snaps) for (const p of JSON.parse(s.positions) as Array<[string, string | null, number, number, ...unknown[]]>) {
    add(p[0], p[1], (String(p[9] ?? '') ? String(p[9]).split(',') : []) as Cohort[], { kind: 'perp', key: s.symbol, side: p[2] ? 'long' : 'short', usd: p[3] });
  }
  const spot = db.prepare(`SELECT wallet, MAX(wallet_label) AS label, chain, token_address, MAX(token_symbol) AS sym, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net FROM smart_money_trades WHERE traded_at >= ? GROUP BY wallet, chain, token_address`).all(now - 86_400_000) as Array<{ wallet: string; label: string | null; chain: string; token_address: string; sym: string | null; net: number }>;
  for (const r of spot) add(r.wallet, r.label, ['smart_money'], { kind: 'spot', key: `${r.chain}:${r.token_address}:${r.sym ?? '?'}`, side: r.net >= 0 ? 'bought' : 'sold', usd: Math.abs(r.net) });
  const wallets = [...map.values()]
    .filter((w) => new Set(w.presence.map((p) => `${p.kind}:${p.key}`)).size >= minPlaces && w.presence.some((p) => p.kind === 'perp'))
    .sort((a, b) => b.presence.length - a.presence.length || b.totalUsd - a.totalUsd);
  return { wallets, sources: [...snaps.map((s) => `${s.symbol} perps`), 'Smart Money DEX trades (24h)'] };
}
