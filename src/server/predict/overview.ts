// Predictions overview: trending markets with their 7-day probability and
// volume, the recent trades across the busiest markets, and derived insights.
// Uses the same Nansen request shapes as the market page, so both share the cache.
import { traced } from '@/server/nansen/traced';
import { requestDay } from '@/server/nansen/demo';
import { callScope, type CallTally } from '@/server/nansen/client';
import type { PredictBoard, PmMarket } from '@/server/predict/board';
import type { PulseItem } from '@/server/pulse';
import { usd, pct } from '@/lib/viz/format';

type Row = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
const rows = (d: unknown): Row[] => (d && typeof d === 'object' && Array.isArray((d as { data?: unknown }).data) ? (d as { data: Row[] }).data : []);
const pts = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} pts`;

export interface MarketSeries { prob: number[]; volume: number[] }
export interface RecentTrade { at: string; marketId: string; question: string; side: string | null; action: string | null; price: number | null; usd: number | null; trader: string | null }
export interface PredictOverview {
  trending: PmMarket[];
  movers: PmMarket[];
  series: Record<string, MarketSeries>;
  recent: RecentTrade[];
  insights: PulseItem[];
  tally: CallTally;
}

const live = (m: PmMarket) => m.price != null && m.price > 0.02 && m.price < 0.98;

async function history(id: string): Promise<MarketSeries | null> {
  try {
    const r = await traced<unknown>('prediction-market/ohlcv', { market_id: id, date: { from: requestDay(7), to: requestDay(0) }, pagination: { page: 1, per_page: 400 } }, 1);
    const yes = rows(r.data).filter((x) => x.outcome_index === 1 || /^yes$/i.test(String(x.side))).sort((a, b) => String(a.period_start).localeCompare(String(b.period_start)));
    return yes.length ? { prob: yes.map((x) => n(x.close) ?? 0), volume: yes.map((x) => n(x.volume_usd) ?? 0) } : null;
  } catch { return null; }
}

async function latestTrades(m: PmMarket): Promise<RecentTrade[]> {
  try {
    const r = await traced<unknown>('prediction-market/trades-by-market', { market_id: m.id, date: { from: requestDay(1), to: requestDay(0) }, pagination: { page: 1, per_page: 100 }, order_by: [{ field: 'timestamp', direction: 'DESC' }] }, 1);
    return rows(r.data).slice(0, 8).map((x) => ({ at: s(x.timestamp) ?? '', marketId: m.id, question: m.question, side: s(x.side), action: s(x.taker_action), price: n(x.price), usd: n(x.usdc_value), trader: s(x.taker_action) === 'sell' ? s(x.seller) : s(x.buyer) }));
  } catch { return []; }
}

export async function predictOverview(board: PredictBoard): Promise<PredictOverview> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const byVol = [...board.markets].filter(live).sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
    const trending = byVol.slice(0, 8);
    const movers = board.markets.filter((m) => live(m) && m.change1d != null && (m.volume24h ?? 0) >= 25_000).sort((a, b) => Math.abs(b.change1d!) - Math.abs(a.change1d!)).slice(0, 8);
    const ids = [...new Set([...trending, ...movers].map((m) => m.id))];
    const [hist, trades] = await Promise.all([Promise.all(ids.map((id) => history(id))), Promise.all(trending.slice(0, 6).map(latestTrades))]);
    const series: Record<string, MarketSeries> = {};
    ids.forEach((id, i) => { if (hist[i]) series[id] = hist[i]!; });
    const recent = trades.flat().filter((t) => t.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);

    const insights: PulseItem[] = [];
    const hot = [...board.categories].filter((c) => c.heat != null && (c.volume24h ?? 0) >= 100_000).sort((a, b) => b.heat! - a.heat!)[0];
    if (hot) insights.push({ id: 'pm-hot', kind: 'Hottest category', tone: 'alert', href: `/predict?q=${encodeURIComponent(hot.category)}`, text: `${hot.category} is trading ${hot.heat!.toFixed(1)}× its usual daily volume`, detail: `${usd(hot.volume24h)} in 24h · ${hot.traders24h?.toLocaleString('en-US') ?? 'n/a'} traders${hot.topQuestion ? ` · busiest: ${hot.topQuestion.slice(0, 60)}` : ''}` });
    const mv = movers[0];
    if (mv) insights.push({ id: 'pm-mover', kind: 'Biggest repricing', tone: (mv.change1d ?? 0) >= 0 ? 'up' : 'down', href: `/predict/${mv.id}`, text: `“${mv.question.slice(0, 80)}” moved ${pts(mv.change1d!)} to ${Math.round(mv.price! * 100)}%`, detail: `${usd(mv.volume24h)} traded in 24h · liquidity ${usd(mv.liquidity)}`, spark: series[mv.id] ? { type: 'line', values: series[mv.id].prob.map((x) => x * 100), min: 0, max: 100, baseline: 50 } : undefined });
    const big = [...board.markets].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0))[0];
    if (big) insights.push({ id: 'pm-oi', kind: 'Largest market', tone: 'flat', href: `/predict/${big.id}`, text: `“${big.question.slice(0, 80)}” holds ${usd(big.openInterest)} open interest at ${big.price != null ? Math.round(big.price * 100) : '?'}% YES`, detail: `${usd(big.volume24h)} traded in 24h` });
    const total = board.markets.reduce((a, m) => a + (m.volume24h ?? 0), 0);
    const top10 = byVol.slice(0, 10).reduce((a, m) => a + (m.volume24h ?? 0), 0);
    if (total) insights.push({ id: 'pm-conc', kind: 'Concentration', tone: 'flat', href: '/predict', text: `The 10 busiest markets take ${pct(top10 / total, 0)} of the tracked markets' 24h volume`, detail: `${usd(total)} across ${board.markets.length} markets · ${board.markets.filter((m) => live(m) && Math.abs(m.change1d ?? 0) >= 0.1).length} moved 10 pts or more` });
    const crowd = [...board.markets].sort((a, b) => (b.traders24h ?? 0) - (a.traders24h ?? 0))[0];
    if (crowd) insights.push({ id: 'pm-crowd', kind: 'Most traders', tone: 'up', href: `/predict/${crowd.id}`, text: `“${crowd.question.slice(0, 80)}” drew ${crowd.traders24h?.toLocaleString('en-US')} traders in 24h`, detail: `${usd(crowd.volume24h)} volume · ${crowd.price != null ? Math.round(crowd.price * 100) : '?'}% YES` });
    const thin = byVol.slice(0, 30).filter((m) => (m.liquidity ?? 0) > 0).map((m) => ({ m, r: (m.volume24h ?? 0) / m.liquidity! })).sort((a, b) => b.r - a.r)[0];
    if (thin) insights.push({ id: 'pm-thin', kind: 'Liquidity', tone: 'alert', href: `/predict/${thin.m.id}`, text: `“${thin.m.question.slice(0, 70)}” traded ${thin.r.toFixed(1)}× its book liquidity today`, detail: `${usd(thin.m.volume24h)} volume on ${usd(thin.m.liquidity)} liquidity: prices there move easily` });
    const whale = [...recent].sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0))[0];
    if (whale?.usd) insights.push({ id: 'pm-whale', kind: 'Largest recent trade', tone: whale.action === 'sell' ? 'down' : 'up', href: `/predict/${whale.marketId}`, text: `${usd(whale.usd)} ${whale.action ?? 'trade'} of ${whale.side ?? 'shares'} at ${whale.price != null ? Math.round(whale.price * 100) : '?'}¢`, detail: `“${whale.question.slice(0, 70)}”` });
    return { trending, movers, series, recent, insights, tally };
  });
}
