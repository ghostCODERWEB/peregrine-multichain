// Smart Money Cascades, data layer: Nansen Smart Money DEX trades (smart-money/dex-trades, stored by the
// scanner with Nansen's wallet labels) → first-buy episodes → leadership statistics and precedence edges.
import { getDb, getKv, setKv } from '@/server/nansen/db';
import { ensureCascadeTable } from '@/server/cascade/backfill';
import { buildEpisodes, walletStats, precedenceEdges, fdrSurvivors, type Buy, type Episode, type WalletStat, type Edge } from '@/lib/models/cascade';

export interface Cascades {
  at: number; window: { from: number; to: number };
  trades: number; wallets: number; episodes: Episode[]; stats: WalletStat[]; edges: Edge[];
  tested: number; fdrLeaders: number; minUsd: number;
}
const KEY = 'cascades:v2'; // v1 merged case-sensitive token identities.
const TTL = 30 * 60_000;
// SQLite counterpart of addressKey: normalize EVM only, never base58 mints.
const TOKEN_KEY_SQL = `CASE WHEN length(token_address) = 42
  AND lower(substr(token_address, 1, 2)) = '0x'
  AND substr(token_address, 3) NOT GLOB '*[^0-9a-fA-F]*'
  THEN lower(token_address) ELSE token_address END`;

export function computeCascades(opts: { minUsd?: number; days?: number; now?: number } = {}): Cascades {
  const now = opts.now ?? Date.now();
  const minUsd = opts.minUsd ?? 500;
  ensureCascadeTable();
  // The live tape (smart-money/dex-trades, trailing 24h, stored every scan) plus the 30-day backfill
  // (tgm/dex-trades, only_smart_money), one row per transaction.
  const since = now - (opts.days ?? 30) * 86_400_000;
  const rows = getDb().prepare(`SELECT wallet, MAX(label) AS label, token, chain, MAX(symbol) AS symbol, MIN(at) AS at, MAX(usd) AS usd FROM (
      SELECT wallet, wallet_label AS label, ${TOKEN_KEY_SQL} AS token, chain, token_symbol AS symbol, traded_at AS at, usd_value AS usd, tx_hash AS tx
        FROM smart_money_trades WHERE side = 'buy' AND usd_value >= @minUsd AND traded_at >= @since
      UNION ALL
      SELECT wallet, wallet_label, ${TOKEN_KEY_SQL}, chain, token_symbol, traded_at, usd_value, tx_hash
        FROM cascade_trades WHERE side = 'buy' AND usd_value >= @minUsd AND traded_at >= @since
    ) GROUP BY chain, tx, wallet, token ORDER BY at`).all({ minUsd, since }) as Buy[];
  const clean = rows.map((b) => ({ ...b, symbol: b.symbol?.replace(/\p{Extended_Pictographic}|️/gu, '').trim() || null }));
  const episodes = buildEpisodes(clean);
  const stats = walletStats(episodes);
  const edges = precedenceEdges(episodes);
  const times = rows.map((r) => r.at);
  return {
    at: now, window: { from: Math.min(...times), to: Math.max(...times) },
    trades: rows.length, wallets: new Set(rows.map((r) => r.wallet)).size,
    episodes, stats, edges, tested: stats.length, fdrLeaders: fdrSurvivors(stats.filter((s) => s.z > 0).map((s) => s.p)), minUsd,
  };
}

/** Cached for 30 minutes: the computation is pure SQL + arithmetic over stored Nansen trades (no API calls). */
export function cascades(): Cascades {
  const hit = getKv(KEY);
  if (hit && Date.now() - hit.updatedAt < TTL) { try { return JSON.parse(hit.value) as Cascades; } catch { /* recompute */ } }
  const c = computeCascades();
  setKv(KEY, JSON.stringify(c));
  return c;
}

export interface MapNode { wallet: string; name: string; episodes: number; meanR: number; z: number; p: number; q: boolean; role: 'leader' | 'follower' | 'mixed'; firsts: number; leadMin: number | null }
export interface Evidence { chain: string; token: string; symbol: string | null; rank: number; k: number; at: number; aheadMin: number }
export interface ReplayEpisode { chain: string; token: string; symbol: string | null; start: number; entries: Array<{ wallet: string; name: string; at: number; usd: number; role: MapNode['role'] | null }> }

/** What the page needs, shaped server-side: nodes for the map, evidence per wallet, and the largest episodes to replay. */
export function cascadeView(c: Cascades, name: (label: string | null, wallet: string) => string) {
  // Benjamini-Hochberg threshold across the early-side tests.
  const early = c.stats.filter((s) => s.z > 0).map((s) => s.p).sort((a, b) => a - b);
  const cut = c.fdrLeaders ? early[c.fdrLeaders - 1] : -1;
  const nodes: MapNode[] = c.stats.map((s) => ({ wallet: s.wallet, name: name(s.label, s.wallet), episodes: s.episodes, meanR: s.meanR, z: s.z, p: s.p, q: s.z > 0 && s.p <= cut, role: s.role, firsts: s.firsts, leadMin: s.medianLeadMin }));
  const roles = new Map(nodes.map((n) => [n.wallet, n.role]));
  const evidence: Record<string, Evidence[]> = {};
  for (const e of c.episodes) {
    const med = [...e.entries].sort((a, b) => a.at - b.at)[Math.floor(e.entries.length / 2)].at;
    for (const x of e.entries) {
      if (!roles.has(x.wallet)) continue;
      (evidence[x.wallet] ??= []).push({ chain: e.chain, token: e.token, symbol: e.symbol, rank: x.rank, k: e.entries.length, at: x.at, aheadMin: Math.round((med - x.at) / 60_000) });
    }
  }
  // Episodes to replay: readable sizes (5-25 wallets) where a tested leader entered among the first three.
  const replay: ReplayEpisode[] = c.episodes.filter((e) => e.entries.length >= 5 && e.entries.length <= 25 && e.entries.slice(0, 3).some((x) => roles.get(x.wallet) === 'leader'))
    .sort((a, b) => b.entries.length - a.entries.length).slice(0, 24).map((e) => ({
    chain: e.chain, token: e.token, symbol: e.symbol, start: e.start,
    entries: e.entries.map((x) => ({ wallet: x.wallet, name: name(x.label, x.wallet), at: x.at, usd: x.usd, role: roles.get(x.wallet) ?? null })),
  }));
  return { nodes, edges: c.edges, evidence, replay };
}
