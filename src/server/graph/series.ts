// Time series and graphs for charts, from tables the scanner already fills
// (no Nansen call on view). Each function states its source.
import { getDb } from '@/server/nansen/db';
import type { Cohort } from '@/lib/perps/positions';

/** Smart Money DEX trades per hour (smart_money_trades): buys, sells, net, wallets, top token. */
export function smFlowSeries(hours = 168, now = Date.now()) {
  const rows = getDb().prepare(`
    SELECT (traded_at / 3600000) * 3600000 AS h,
      SUM(CASE WHEN side='buy' THEN usd_value ELSE 0 END) AS buy, SUM(CASE WHEN side='sell' THEN usd_value ELSE 0 END) AS sell,
      COUNT(DISTINCT wallet) AS wallets
    FROM smart_money_trades WHERE traded_at >= ? GROUP BY h ORDER BY h`).all(now - hours * 3_600_000) as Array<{ h: number; buy: number; sell: number; wallets: number }>;
  const tops = getDb().prepare(`
    SELECT (traded_at / 3600000) * 3600000 AS h, token_symbol AS s, chain, token_address AS t, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net
    FROM smart_money_trades WHERE traded_at >= ? AND token_symbol IS NOT NULL GROUP BY h, chain, token_address`).all(now - hours * 3_600_000) as Array<{ h: number; s: string; chain: string; t: string; net: number }>;
  const byHour = new Map<number, typeof tops>();
  for (const r of tops) byHour.set(r.h, [...(byHour.get(r.h) ?? []), r]);
  return rows.map((r) => {
    const list = (byHour.get(r.h) ?? []).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)).slice(0, 5).map((x) => ({ symbol: x.s, chain: x.chain, token: x.t, net: x.net }));
    return { t: r.h, buy: r.buy, sell: r.sell, net: r.buy - r.sell, wallets: r.wallets, top: list };
  });
}

/** Positioning per stored snapshot (perp_position_snapshots): Smart Money and all observed, long vs short. */
export function positioningSeries(symbol: string) {
  const rows = getDb().prepare('SELECT at, mark, positions FROM perp_position_snapshots WHERE symbol = ? ORDER BY at').all(symbol) as Array<{ at: number; mark: number | null; positions: string }>;
  return rows.map((r) => {
    let smLong = 0, smShort = 0, allLong = 0, allShort = 0, smTraders = 0;
    for (const p of JSON.parse(r.positions) as Array<[string, string | null, number, number, ...unknown[]]>) {
      const sm = String(p[9] ?? '').includes('smart_money');
      if (p[2]) { allLong += p[3]; if (sm) smLong += p[3]; } else { allShort += p[3]; if (sm) smShort += p[3]; }
      if (sm) smTraders++;
    }
    return { at: r.at, mark: r.mark, smLong, smShort, allLong, allShort, smTraders };
  });
}

/** Flow Index history per chain (chain_cpi), for the chains that moved most over the window. */
export function flowIndexHistory(days = 7, chains = 6, source = 'smart-money', now = Date.now()) {
  const rows = getDb().prepare('SELECT chain, cpi, snapshot_at AS t FROM chain_cpi WHERE source = ? AND snapshot_at >= ? AND cpi != 50 ORDER BY snapshot_at').all(source, now - days * 86_400_000) as Array<{ chain: string; cpi: number; t: number }>;
  const by = new Map<string, Array<[number, number]>>();
  for (const r of rows) by.set(r.chain, [...(by.get(r.chain) ?? []), [r.t, r.cpi]]);
  const range = (xs: Array<[number, number]>) => Math.max(...xs.map((x) => x[1])) - Math.min(...xs.map((x) => x[1]));
  return [...by.entries()].filter(([, xs]) => xs.length >= 3).sort((a, b) => range(b[1]) - range(a[1])).slice(0, chains).map(([chain, points]) => ({ chain, points }));
}

export interface GraphNode { id: string; name: string; kind: 'wallet' | 'perp' | 'token'; value: number; href: string; sm?: boolean }
export interface GraphLink { source: string; target: string; value: number; side: string }

/** Wallet ↔ market graph: wallets active in more than one place (latest perp snapshots, 24h Smart Money DEX trades). Real edges only. */
export function walletGraph(now = Date.now(), maxWallets = 40) {
  const db = getDb();
  const edges = new Map<string, { label: string | null; sm: boolean; links: GraphLink[] }>();
  const add = (address: string, label: string | null, sm: boolean, target: string, value: number, side: string) => {
    const k = address.toLowerCase();
    const cur = edges.get(k) ?? { label, sm, links: [] };
    if (!cur.label && label) cur.label = label;
    cur.sm ||= sm;
    cur.links.push({ source: `w:${k}`, target, value, side });
    edges.set(k, cur);
  };
  const snaps = db.prepare(`SELECT s.symbol, s.positions FROM perp_position_snapshots s JOIN (SELECT symbol, MAX(at) t FROM perp_position_snapshots WHERE at >= ? GROUP BY symbol) m ON m.symbol = s.symbol AND m.t = s.at`).all(now - 86_400_000) as Array<{ symbol: string; positions: string }>;
  for (const s of snaps) for (const p of JSON.parse(s.positions) as Array<[string, string | null, number, number, ...unknown[]]>) {
    add(p[0], p[1], String(p[9] ?? '').includes('smart_money' as Cohort), `p:${s.symbol}`, p[3], p[2] ? 'long' : 'short');
  }
  const spot = db.prepare(`SELECT wallet, MAX(wallet_label) AS label, chain, token_address AS t, MAX(token_symbol) AS sym, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net FROM smart_money_trades WHERE traded_at >= ? GROUP BY wallet, chain, token_address`).all(now - 86_400_000) as Array<{ wallet: string; label: string | null; chain: string; t: string; sym: string | null; net: number }>;
  const tokenName = new Map<string, { name: string; href: string }>();
  for (const r of spot) {
    const id = `t:${r.chain}:${r.t}`;
    tokenName.set(id, { name: r.sym ?? r.t.slice(0, 6), href: `/token/${r.chain}/${encodeURIComponent(r.t)}` });
    add(r.wallet, r.label, true, id, Math.abs(r.net), r.net >= 0 ? 'bought' : 'sold');
  }
  // Keep wallets that connect two or more markets and touch a perp: the ones that tie datasets together.
  const kept = [...edges.entries()].filter(([, w]) => new Set(w.links.map((l) => l.target)).size >= 2 && w.links.some((l) => l.target.startsWith('p:')))
    .sort((a, b) => b[1].links.reduce((s, l) => s + l.value, 0) - a[1].links.reduce((s, l) => s + l.value, 0)).slice(0, maxWallets);
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  for (const [addr, w] of kept) {
    const total = w.links.reduce((s, l) => s + l.value, 0);
    nodes.set(`w:${addr}`, { id: `w:${addr}`, name: (w.label ?? '').replace(/\s*\[[^\]]*\]$/, '') || `${addr.slice(0, 6)}…${addr.slice(-4)}`, kind: 'wallet', value: total, href: `/wallet/${addr}`, sm: w.sm });
    for (const l of w.links) {
      links.push(l);
      if (!nodes.has(l.target)) {
        const perp = l.target.startsWith('p:');
        const sym = l.target.slice(2);
        nodes.set(l.target, { id: l.target, name: perp ? `${sym} perp` : tokenName.get(l.target)?.name ?? sym, kind: perp ? 'perp' : 'token', value: 0, href: perp ? `/perps/${sym}` : tokenName.get(l.target)?.href ?? '/' });
      }
      nodes.get(l.target)!.value += l.value;
    }
  }
  return { nodes: [...nodes.values()], links, walletsConnected: kept.length, sources: snaps.map((s) => s.symbol) };
}
