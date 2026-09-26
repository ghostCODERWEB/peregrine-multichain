// Dedicated analytics for one Polymarket market, from Nansen: price
// statistics over the 7-day history, trade flow, order-book balance, holder
// concentration, the market's top traders (pnl-by-market) and related
// markets, plus derived insights for its AI brief.
import { traced } from '@/server/nansen/traced';
import { callScope, type CallTally } from '@/server/nansen/client';
import type { PmDetail, PmMarket, PredictBoard } from '@/server/predict/board';
import type { PulseItem } from '@/server/pulse';
import { pct, usd } from '@/lib/viz/format';

type Row = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
const rows = (d: unknown): Row[] => (d && typeof d === 'object' && Array.isArray((d as { data?: unknown }).data) ? (d as { data: Row[] }).data : []);
const pts = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} pts`;
const isYes = (x: string | null | undefined) => /^yes$/i.test(x ?? '');

export interface TopTrader { address: string; side: string | null; pnlUsd: number | null; buyCostUsd: number | null; sellProceedsUsd: number | null; unrealizedUsd: number | null; resolved: boolean }
export interface MarketAnalytics {
  stats: { now: number | null; high7d: number | null; low7d: number | null; change7d: number | null; change24h: number | null; volatility: number | null; volume7d: number; avgDailyVolume: number | null; hoursToEnd: number | null };
  flow: { buyUsd: number; sellUsd: number; yesUsd: number; noUsd: number; trades: number; takers: number; avgUsd: number | null; largest: PmDetail['trades'][number] | null };
  book: { bidDepth: number; askDepth: number; imbalance: number | null; spread: number | null };
  holders: { yes: number; no: number; top10Share: number | null; yesUsd: number; noUsd: number };
  topTraders: TopTrader[];
  related: PmMarket[];
  insights: PulseItem[];
  tally: CallTally;
}

export async function marketAnalytics(id: string, detail: PmDetail, board: PredictBoard | null, now = Date.now()): Promise<MarketAnalytics> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const market = board?.markets.find((m) => m.id === id) ?? null;
    // Same request as the holder-records check, so both share the cache.
    const pnl = await traced<unknown>('prediction-market/pnl-by-market', { market_id: id, pagination: { page: 1, per_page: 15 }, order_by: [{ field: 'total_pnl_usd', direction: 'DESC' }] }, 5).catch(() => null);
    const wallet = (r: Row) => { const o = s(r.owner_address); return o && o.length > 4 ? o : s(r.address) ?? ''; };
    const topTraders: TopTrader[] = pnl ? rows(pnl.data).map((r) => ({ address: wallet(r), side: s(r.side_held), pnlUsd: n(r.total_pnl_usd), buyCostUsd: n(r.net_buy_cost_usd), sellProceedsUsd: n(r.net_sell_proceeds_usd), unrealizedUsd: n(r.unrealized_value_usd), resolved: r.market_resolved === true })).filter((t) => t.address).sort((a, b) => (b.pnlUsd ?? 0) - (a.pnlUsd ?? 0)) : [];

    // Price statistics from the hourly YES candles.
    const c = detail.candles;
    const closes = c.map((x) => x.close);
    const nowP = closes.at(-1) ?? market?.price ?? null;
    const dayAgo = c.length > 24 ? c[c.length - 25].close : null;
    const moves = closes.slice(1).map((v, i) => v - closes[i]);
    const volatility = moves.length > 5 ? Math.sqrt(moves.reduce((a, m) => a + m * m, 0) / moves.length) : null;
    const volume7d = c.reduce((a, x) => a + x.volume, 0);
    const days = c.length ? Math.max(1, (Date.parse(c.at(-1)!.t) - Date.parse(c[0].t)) / 86_400_000) : 0;
    const stats = {
      now: nowP, high7d: closes.length ? Math.max(...closes) : null, low7d: closes.length ? Math.min(...closes) : null,
      change7d: closes.length > 1 ? closes.at(-1)! - closes[0] : null, change24h: dayAgo != null && nowP != null ? nowP - dayAgo : market?.change1d ?? null,
      volatility, volume7d, avgDailyVolume: days ? volume7d / days : null,
      hoursToEnd: market?.endDate ? Math.max(0, (Date.parse(market.endDate) - now) / 3_600_000) : null,
    };

    // Trade flow from the latest trades Nansen returns.
    const t = detail.trades;
    const flow = {
      buyUsd: t.filter((x) => /buy/i.test(x.action ?? '')).reduce((a, x) => a + (x.usd ?? 0), 0),
      sellUsd: t.filter((x) => /sell/i.test(x.action ?? '')).reduce((a, x) => a + (x.usd ?? 0), 0),
      yesUsd: t.filter((x) => isYes(x.side)).reduce((a, x) => a + (x.usd ?? 0), 0),
      noUsd: t.filter((x) => !isYes(x.side)).reduce((a, x) => a + (x.usd ?? 0), 0),
      trades: t.length,
      takers: new Set(t.map((x) => (/sell/i.test(x.action ?? '') ? x.seller : x.buyer)).filter(Boolean)).size,
      avgUsd: t.length ? t.reduce((a, x) => a + (x.usd ?? 0), 0) / t.length : null,
      largest: [...t].sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0))[0] ?? null,
    };

    // Order book within 10 points of the mid.
    const b = detail.book;
    const mid = b?.bids[0] && b?.asks[0] ? (b.bids[0].price + b.asks[0].price) / 2 : nowP;
    const near = (xs: Array<{ price: number; size: number }>) => xs.filter((x) => mid == null || Math.abs(x.price - mid) <= 0.1).reduce((a, x) => a + x.price * x.size, 0);
    const bidDepth = b ? near(b.bids) : 0, askDepth = b ? near(b.asks) : 0;
    const book = { bidDepth, askDepth, imbalance: bidDepth + askDepth ? (bidDepth - askDepth) / (bidDepth + askDepth) : null, spread: b?.bids[0] && b?.asks[0] ? b.asks[0].price - b.bids[0].price : null };

    // Holder concentration among the largest holders Nansen returns.
    const hv = detail.holders.map((h) => ({ yes: isYes(h.side) || h.outcomeIndex === 1, v: h.size * (h.currentPrice ?? 0) })).sort((a, z) => z.v - a.v);
    const total = hv.reduce((a, x) => a + x.v, 0);
    const holders = { yes: hv.filter((x) => x.yes).length, no: hv.filter((x) => !x.yes).length, top10Share: total ? hv.slice(0, 10).reduce((a, x) => a + x.v, 0) / total : null, yesUsd: hv.filter((x) => x.yes).reduce((a, x) => a + x.v, 0), noUsd: hv.filter((x) => !x.yes).reduce((a, x) => a + x.v, 0) };

    // Related: same event first, then markets sharing its main tag.
    const related = board && market ? [
      ...board.markets.filter((m) => m.id !== id && m.eventTitle && m.eventTitle === market.eventTitle),
      ...board.markets.filter((m) => m.id !== id && m.eventTitle !== market.eventTitle && market.tags[0] && m.tags.includes(market.tags[0])),
    ].filter((m, i, xs) => xs.findIndex((x) => x.id === m.id) === i).slice(0, 8) : [];

    const insights: PulseItem[] = [];
    const href = `/predict/${id}`;
    if (nowP != null) insights.push({ id: 'm-price', kind: 'Probability', tone: (stats.change24h ?? 0) >= 0 ? 'up' : 'down', href, text: `Priced at ${Math.round(nowP * 100)}% YES${stats.change24h != null ? `, ${pts(stats.change24h)} in 24h` : ''}${stats.change7d != null ? ` and ${pts(stats.change7d)} over 7 days` : ''}`, detail: stats.high7d != null ? `7-day range ${Math.round(stats.low7d! * 100)}% to ${Math.round(stats.high7d * 100)}%${volatility != null ? ` · hourly moves ±${(volatility * 100).toFixed(1)} pts` : ''}` : '', spark: closes.length > 2 ? { type: 'line', values: closes.map((x) => x * 100), min: 0, max: 100, baseline: 50 } : undefined });
    if (market?.volume24h != null && stats.avgDailyVolume) insights.push({ id: 'm-vol', kind: 'Volume', tone: market.volume24h >= stats.avgDailyVolume ? 'up' : 'flat', href, text: `Traded ${usd(market.volume24h)} in 24h, ${(market.volume24h / stats.avgDailyVolume).toFixed(1)}× its 7-day daily pace`, detail: `${usd(volume7d)} over 7 days${market.traders24h != null ? ` · ${market.traders24h.toLocaleString('en-US')} traders today` : ''}`, spark: c.length > 2 ? { type: 'bars', values: c.map((x) => x.volume) } : undefined });
    if (book.imbalance != null) insights.push({ id: 'm-book', kind: 'Order book', tone: book.imbalance >= 0 ? 'up' : 'down', href, text: `${book.imbalance >= 0 ? 'Bids' : 'Asks'} are deeper within 10 pts of the mid: ${usd(bidDepth)} bid vs ${usd(askDepth)} ask`, detail: book.spread != null ? `Spread ${pts(book.spread)} · liquidity ${usd(market?.liquidity)}` : `Liquidity ${usd(market?.liquidity)}` });
    if (holders.yesUsd + holders.noUsd > 0) insights.push({ id: 'm-hold', kind: 'Holders', tone: holders.yesUsd >= holders.noUsd ? 'up' : 'down', href, text: `The largest holders put ${usd(holders.yesUsd)} on YES and ${usd(holders.noUsd)} on NO`, detail: `${holders.yes} YES and ${holders.no} NO holders · top 10 hold ${pct(holders.top10Share, 0)} of their value` });
    if (flow.trades) insights.push({ id: 'm-flow', kind: 'Trade flow', tone: flow.yesUsd >= flow.noUsd ? 'up' : 'down', href, text: `Recent trades: ${pct(Math.max(flow.yesUsd, flow.noUsd) / Math.max(1, flow.yesUsd + flow.noUsd), 0)} of value in ${flow.yesUsd >= flow.noUsd ? 'YES' : 'NO'} shares across ${flow.takers} traders`, detail: flow.largest?.usd ? `Largest ${usd(flow.largest.usd)} ${[flow.largest.action, flow.largest.side].filter(Boolean).join(' ')} at ${flow.largest.price != null ? Math.round(flow.largest.price * 100) : '?'}¢ · average ${usd(flow.avgUsd)}` : '' });
    const best = topTraders[0];
    if (best?.pnlUsd) insights.push({ id: 'm-best', kind: 'Top trader', tone: best.pnlUsd >= 0 ? 'up' : 'down', href: `/wallet/${best.address}`, text: `The best performer here is ${usd(best.pnlUsd, { signed: true })}${best.side ? ` holding ${best.side}` : ''}`, detail: `${topTraders.filter((x) => (x.pnlUsd ?? 0) > 0).length} of the top ${topTraders.length} traders are in profit` });
    if (stats.hoursToEnd != null) insights.push({ id: 'm-end', kind: 'Resolution', tone: 'flat', href, text: stats.hoursToEnd < 48 ? `Resolves in ${Math.round(stats.hoursToEnd)} hours` : `Resolves in ${Math.round(stats.hoursToEnd / 24)} days`, detail: market?.endDate ? `End date ${market.endDate.slice(0, 10)}` : '' });
    return { stats, flow, book, holders, topTraders, related, insights, tally };
  });
}
