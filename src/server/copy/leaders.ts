// Copy Lab's leaderboard: which Smart Money traders are worth following?
// Nansen's Smart Money PnL leaderboard (smart-money/pnl-leaderboard) over 7,
// 30 and 90 days, re-ranked by a copy score that rewards profit that is
// banked, repeated across windows and spread over many tokens, and marks down
// one-trade wonders and bots nobody can keep up with. Joined with this
// instance's stored Smart Money trade tape for what the leaders are buying
// now. Owner only: the endpoint and the tape are restricted data.
import { traced, errText } from '@/server/nansen/traced';
import { getDb } from '@/server/nansen/db';
import type { NansenCallRef } from '@/lib/provenance';

export const TIMEFRAMES = [7, 30, 90] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
export type TraderKind = 'kol' | 'fund' | 'trader';

type Row = Record<string, unknown>;
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const s = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export interface LeaderWindow {
  pnl: number; realized: number; unrealized: number;
  winRate: number | null; avgRoi: number | null; trades: number; tokens: number; held: number;
}
export interface LeaderToken { symbol: string | null; address: string | null; chain: string | null; usd: number | null }
export interface LeaderBuy { chain: string; token: string; symbol: string | null; usd: number; at: number }
export interface Leader {
  address: string; label: string | null; kind: TraderKind;
  windows: Partial<Record<Timeframe, LeaderWindow>>;
  holdings: LeaderToken[]; topTraded: LeaderToken[];
  score: number; parts: Record<string, number>;
  recent: LeaderBuy[];
}
export interface ConsensusToken { chain: string; token: string; symbol: string | null; wallets: number; usd: number; last: number; source: 'buying' | 'holding' }
export interface Leaders {
  at: number; timeframe: Timeframe;
  leaders: Leader[]; buying: Array<LeaderBuy & { leader: Leader }>; consensus: ConsensusToken[];
  calls: NansenCallRef[]; notes: string[];
}

/** A wallet's kind from its Nansen label. KOLs are wallets Nansen names after
 *  a public figure (KOL, influencer, or an @handle); funds say so. */
export function traderKind(label: string | null): TraderKind {
  if (!label) return 'trader';
  if (/\b(kol|influencer|youtuber|streamer|public figure)\b|@\w{2,}|🎤|📣/iu.test(label)) return 'kol';
  if (/\b(fund|capital|ventures?|labs|partners|investments?|dao|treasury)\b|🏦/iu.test(label)) return 'fund';
  return 'trader';
}

function toWindow(r: Row): LeaderWindow {
  return {
    pnl: n(r.total_pnl_usd) ?? 0, realized: n(r.realized_pnl_usd) ?? 0, unrealized: n(r.unrealized_pnl_usd) ?? 0,
    winRate: n(r.win_rate), avgRoi: n(r.avg_trade_roi), trades: n(r.n_trades) ?? 0, tokens: n(r.n_tokens) ?? 0, held: n(r.held_tokens_count) ?? 0,
  };
}

/** Nansen's token info objects have no fixed schema: read the usual names. */
export function toTokens(v: unknown): LeaderToken[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Row => !!x && typeof x === 'object').map((t) => ({
    symbol: s(t.token_symbol) ?? s(t.symbol),
    address: s(t.token_address) ?? s(t.address),
    chain: s(t.chain),
    usd: n(t.value_usd) ?? n(t.balance_usd) ?? n(t.usd_value) ?? n(t.total_pnl_usd) ?? n(t.pnl_usd),
  })).filter((t) => t.symbol || t.address);
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Copy score 0 to 100: can a follower expect to share this trader's result?
 *  Starts at 50 and adds or removes points for what makes profit copyable. */
export function copyScore(w: Partial<Record<Timeframe, LeaderWindow>>, focus: Timeframe): { score: number; parts: Record<string, number> } {
  const f = w[focus];
  if (!f) return { score: 0, parts: {} };
  const parts: Record<string, number> = {};
  // Profit, on a log scale: $10K is a start, $1M+ is the top.
  parts.profit = f.pnl > 0 ? clamp(4 * Math.log10(f.pnl / 10_000), 0, 12) : -10;
  // Consistency: profitable in every window it appears in.
  const shown = TIMEFRAMES.filter((t) => w[t]);
  const won = shown.filter((t) => w[t]!.pnl > 0).length;
  parts.consistency = shown.length > 1 ? Math.round((won / shown.length) * 10 - (won < shown.length ? 8 : 0)) : 0;
  // Win rate, shrunk toward 50% until there are enough trades to trust it.
  if (f.winRate != null) {
    const k = f.trades / (f.trades + 20);
    parts.winRate = Math.round((k * f.winRate + (1 - k) * 0.5 - 0.5) * 40);
  }
  // Banked, not paper: realized share of the profit.
  if (f.pnl > 0) parts.banked = Math.round(clamp((f.realized / f.pnl - 0.5) * 16, -8, 8));
  // Breadth: profit from many tokens is skill, from one token is luck.
  parts.breadth = f.tokens >= 10 ? 4 : f.tokens >= 5 ? 2 : f.tokens >= 3 ? 0 : -10;
  // Pace: a wallet trading thousands of times a month is a bot you cannot keep up with.
  const perDay = f.trades / focus;
  parts.pace = perDay > 100 ? -18 : perDay > 30 ? -8 : perDay < 0.1 ? -4 : 0;
  // Average trade ROI: a small bonus for trades that actually pay.
  if (f.avgRoi != null) parts.roi = Math.round(clamp(f.avgRoi * 10, -4, 4));
  const score = Math.round(clamp(50 + Object.values(parts).reduce((a, b) => a + b, 0), 0, 100));
  return { score, parts };
}

async function board(timeframe: Timeframe, calls: NansenCallRef[]): Promise<Row[]> {
  const body = { chains: ['all'], timeframe, pagination: { page: 1, per_page: 100 }, order_by: [{ field: 'total_pnl_usd', direction: 'DESC' }] };
  const r = await traced<{ data?: Row[] }>('smart-money/pnl-leaderboard', body, 5);
  calls.push(r.call);
  return Array.isArray(r.data.data) ? r.data.data : [];
}

/** Recent Smart Money buys by these wallets, from the stored tape (free, local). */
function recentBuys(addresses: string[], since: number): Map<string, LeaderBuy[]> {
  const out = new Map<string, LeaderBuy[]>();
  if (!addresses.length) return out;
  const db = getDb();
  // The tape may store EVM addresses in either case: ask for both spellings.
  const keys = [...new Set(addresses.flatMap((a) => (a.startsWith('0x') ? [a, a.toLowerCase()] : [a])))];
  const marks = keys.map(() => '?').join(',');
  const rows = db.prepare(`SELECT wallet, chain, token_address AS token, token_symbol AS symbol, SUM(usd_value) AS usd, MAX(traded_at) AS at
    FROM smart_money_trades WHERE side = 'buy' AND traded_at >= ? AND wallet IN (${marks})
    GROUP BY wallet, chain, token_address ORDER BY at DESC`).all(since, ...keys) as Array<{ wallet: string; chain: string; token: string; symbol: string | null; usd: number; at: number }>;
  for (const r of rows) {
    const key = r.wallet.startsWith('0x') ? r.wallet.toLowerCase() : r.wallet;
    const list = out.get(key) ?? [];
    list.push({ chain: r.chain, token: r.token, symbol: r.symbol?.replace(/\p{Extended_Pictographic}|️/gu, '').trim() || null, usd: r.usd ?? 0, at: r.at });
    out.set(key, list);
  }
  return out;
}

/** Merge the three windows into one row per wallet (exported for tests). */
export function mergeBoards(boards: Partial<Record<Timeframe, Row[]>>, focus: Timeframe): Leader[] {
  const by = new Map<string, Leader>();
  for (const t of TIMEFRAMES) {
    for (const r of boards[t] ?? []) {
      const address = s(r.address);
      if (!address) continue;
      const key = address.startsWith('0x') ? address.toLowerCase() : address;
      const label = s(r.address_label);
      const cur = by.get(key) ?? { address, label, kind: 'trader' as TraderKind, windows: {}, holdings: [], topTraded: [], score: 0, parts: {}, recent: [] };
      cur.windows[t] = toWindow(r);
      if (!cur.label && label) cur.label = label;
      if (t === focus || !cur.holdings.length) { const h = toTokens(r.top_5_balance_tokens_info); if (h.length) cur.holdings = h; }
      if (t === focus || !cur.topTraded.length) { const tt = toTokens(r.top_traded_tokens_info); if (tt.length) cur.topTraded = tt; }
      by.set(key, cur);
    }
  }
  return [...by.values()].filter((l) => l.windows[focus]).map((l) => {
    const c = copyScore(l.windows, focus);
    return { ...l, kind: traderKind(l.label), score: c.score, parts: c.parts };
  }).sort((a, b) => b.score - a.score || (b.windows[focus]!.pnl - a.windows[focus]!.pnl));
}

/** Tokens several leaders are buying (tape) or holding (leaderboard). */
export function consensusOf(leaders: Leader[], minWallets = 2): ConsensusToken[] {
  const agg = new Map<string, ConsensusToken & { who: Set<string> }>();
  const add = (source: ConsensusToken['source'], chain: string | null, token: string | null, symbol: string | null, usd: number, at: number, who: string) => {
    const id = token ? `${chain ?? ''}|${token.startsWith('0x') ? token.toLowerCase() : token}` : `sym|${(symbol ?? '').toUpperCase()}`;
    if (id === 'sym|') return;
    const k = `${source}:${id}`;
    const cur = agg.get(k) ?? { chain: chain ?? '', token: token ?? '', symbol, wallets: 0, usd: 0, last: 0, source, who: new Set<string>() };
    cur.who.add(who); cur.wallets = cur.who.size; cur.usd += usd; cur.last = Math.max(cur.last, at);
    if (!cur.symbol && symbol) cur.symbol = symbol;
    agg.set(k, cur);
  };
  for (const l of leaders) {
    for (const b of l.recent) add('buying', b.chain, b.token, b.symbol, b.usd, b.at, l.address);
    for (const h of l.holdings) {
      if (/^(usdc|usdt|dai|usde|weth|eth|wbtc|sol|wsol|fdusd|pyusd)$/i.test(h.symbol ?? '')) continue; // cash and majors say nothing
      add('holding', h.chain, h.address, h.symbol, h.usd ?? 0, 0, l.address);
    }
  }
  return [...agg.values()].filter((c) => c.wallets >= minWallets)
    .sort((a, b) => (a.source === b.source ? 0 : a.source === 'buying' ? -1 : 1) || b.wallets - a.wallets || b.usd - a.usd)
    .map((c) => ({ chain: c.chain, token: c.token, symbol: c.symbol, wallets: c.wallets, usd: c.usd, last: c.last, source: c.source }));
}

export async function copyLeaders(timeframe: Timeframe = 30, now = Date.now()): Promise<Leaders | { unavailable: string }> {
  const calls: NansenCallRef[] = [], notes: string[] = [];
  const boards: Partial<Record<Timeframe, Row[]>> = {};
  const got = await Promise.allSettled(TIMEFRAMES.map(async (t) => { boards[t] = await board(t, calls); }));
  const failed = got.filter((g): g is PromiseRejectedResult => g.status === 'rejected');
  if (!boards[timeframe]) return { unavailable: errText(failed[0]?.reason ?? new Error('Nansen returned no leaderboard.')) };
  if (failed.length) notes.push(`${failed.length} of ${TIMEFRAMES.length} leaderboard windows could not be read, so consistency uses the rest.`);

  const leaders = mergeBoards(boards, timeframe);
  const recent = recentBuys(leaders.map((l) => l.address), now - 3 * 86_400_000);
  for (const l of leaders) l.recent = (recent.get(l.address.startsWith('0x') ? l.address.toLowerCase() : l.address) ?? []).slice(0, 6);
  const buying = leaders.flatMap((l) => l.recent.map((b) => ({ ...b, leader: l }))).sort((a, b) => b.at - a.at).slice(0, 30);
  if (!buying.length) notes.push('No stored Smart Money buys from these traders in the last 3 days yet: the scanner records the tape as it runs.');
  return { at: now, timeframe, leaders, buying, consensus: consensusOf(leaders).slice(0, 12), calls, notes };
}
