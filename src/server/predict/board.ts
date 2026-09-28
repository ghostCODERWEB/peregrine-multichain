// Prediction markets (M6): Nansen's Polymarket data as weather. The board
// is three cached calls (categories, markets, events); a market's detail
// and its holders' track records are fetched on request, with the price
// shown before the records call. All of it is attribution-class data.
import { traced, errText } from '@/server/nansen/traced';
import { readCache } from '@/server/nansen/cache';
import { requestDay } from '@/server/nansen/demo';
import { callScope, type CallTally } from '@/server/nansen/client';
import {
  categoryHeat,
  heatLabel,
  holderBalance,
  skilledDivergence,
  isSkilled,
  impliedPct,
  isMover,
  type HolderLike,
  type RecordLike,
} from '@/lib/models/predict';
import type { Provenance } from '@/lib/provenance';
import { usd, pct, num } from '@/lib/viz/format';

type Row = Record<string, unknown>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const s = (v: unknown) => (typeof v === 'string' && v ? v : null);
const rows = (d: unknown): Row[] =>
  d && typeof d === 'object' && Array.isArray((d as { data?: unknown }).data) ? (d as { data: Row[] }).data : [];

export const MARKET_ID_RE = /^[0-9A-Za-z_-]{1,40}$/;

export interface PmCategory {
  category: string;
  activeMarkets: number | null;
  openInterest: number | null;
  volume24h: number | null;
  volume1w: number | null;
  traders24h: number | null;
  heat: number | null;
  weather: number | null;
  topMarketId: string | null;
  topQuestion: string | null;
}
export interface PmMarket {
  id: string;
  question: string;
  eventTitle: string | null;
  endDate: string | null;
  tags: string[];
  price: number | null;
  change1d: number | null;
  volume24h: number | null;
  volume1w: number | null;
  openInterest: number | null;
  liquidity: number | null;
  traders24h: number | null;
  bid: number | null;
  ask: number | null;
  negRisk: boolean;
  /** Polymarket URL slug: polymarket.com/market/<slug> opens the live market. */
  slug?: string | null;
  volumeTotal?: number | null;
  createdAt?: string | null;
  volumeChangePct?: number | null;
}
export interface PmEvent {
  id: string;
  title: string;
  markets: number | null;
  volume24h: number | null;
  openInterest: number | null;
  traders24h: number | null;
  topQuestion: string | null;
  changePct: number | null;
}

export interface PredictBoard {
  categories: PmCategory[];
  markets: PmMarket[];
  events: PmEvent[];
  totals: { openInterest: number; volume24h: number; activeMarkets: number; traders24h: number };
  /** Server time of the read: the client ranks movers against it, not its own clock. */
  asOf: number;
  provenance: Provenance;
  tally: CallTally;
  unavailable: string | null;
}

/** The board's category and market requests: shared with the share card, which reads their stored answers only. */
export const PM_CATEGORY_BODY = { pagination: { page: 1, per_page: 60 } };
export const PM_MARKET_BODY = { status: 'active', order_by: [{ field: 'volume_24hr', direction: 'DESC' }], pagination: { page: 1, per_page: 200 } };

export async function predictBoard(): Promise<PredictBoard> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const cBody = PM_CATEGORY_BODY;
    const mBody = PM_MARKET_BODY;
    const eBody = { status: 'active', order_by: [{ field: 'volume_24hr', direction: 'DESC' }], pagination: { page: 1, per_page: 40 } };
    try {
      const [c, m, e] = await Promise.all([
        traced<unknown>('prediction-market/categories', cBody, 1),
        traced<unknown>('prediction-market/market-screener', mBody, 1),
        traced<unknown>('prediction-market/event-screener', eBody, 1),
      ]);
      const categories: PmCategory[] = rows(c.data)
        .map((r) => {
          const base = { volume24h: n(r.total_volume_24hr), volume1w: n(r.total_volume_1wk), openInterest: n(r.total_open_interest) };
          return {
            category: s(r.category) ?? '?',
            activeMarkets: n(r.active_markets),
            traders24h: n(r.total_traders_24h),
            topMarketId: s(r.top_market_id),
            topQuestion: s(r.top_market_question),
            ...base,
            ...categoryHeat(base),
          };
        })
        .filter((x) => (x.volume24h ?? 0) > 0)
        .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
      const markets: PmMarket[] = rows(m.data).map(toMarket);
      const events: PmEvent[] = rows(e.data).map((r) => ({
        id: String(r.event_id),
        title: s(r.event_title) ?? '?',
        markets: n(r.market_count),
        volume24h: n(r.total_volume_24hr),
        openInterest: n(r.total_open_interest),
        traders24h: n(r.total_traders_24h),
        topQuestion: s(r.top_market_question),
        changePct: n(r.total_volume_change_pct),
      }));
      const totals = {
        openInterest: categories.reduce((a, x) => a + (x.openInterest ?? 0), 0),
        volume24h: categories.reduce((a, x) => a + (x.volume24h ?? 0), 0),
        activeMarkets: categories.reduce((a, x) => a + (x.activeMarkets ?? 0), 0),
        traders24h: categories.reduce((a, x) => a + (x.traders24h ?? 0), 0),
      };
      const hottest = [...categories]
        .filter((x) => x.weather != null && (x.volume24h ?? 0) > 100_000)
        .sort((a, b) => b.weather! - a.weather!)[0];
      return {
        categories,
        markets,
        events,
        totals,
        tally,
        unavailable: null,
        asOf: Date.now(),
        provenance: {
          title: 'Prediction flows (Polymarket, via Nansen)',
          formula:
            'per category: heat = 24h volume ÷ (1-week volume ÷ 7); activity = 50 + 50·tanh(ln heat)\nper market: implied probability = last YES price; repricing = 1-day change in that price, in points',
          inputs: [
            { label: 'Categories', value: String(categories.length) },
            { label: 'Open interest', value: usd(totals.openInterest) },
            { label: '24h volume', value: usd(totals.volume24h) },
            { label: 'Hottest (> $100K today)', value: hottest ? `${hottest.category} ${num(hottest.heat, 1)}× its pace` : 'n/a' },
          ],
          calls: [c.call, m.call, e.call],
          notes: [
            'Categories overlap: a market can carry several tags, so category totals add up to more than the market total.',
            'The 200 active markets with the most volume in the last 24 hours; smaller ones are not shown.',
          ],
        },
      };
    } catch (err) {
      return {
        categories: [],
        markets: [],
        events: [],
        totals: { openInterest: 0, volume24h: 0, activeMarkets: 0, traders24h: 0 },
        asOf: Date.now(),
        tally,
        unavailable: errText(err),
        provenance: { title: 'Prediction flows', formula: '', inputs: [], calls: [], notes: [] },
      };
    }
  });
}

/** The board as last stored, read without a Nansen call (expired answers included): for share cards and page
 *  titles, which crawlers fetch and which must never spend credits. Null when nothing was stored yet. */
export function storedBoard(): { markets: PmMarket[]; totals: PredictBoard['totals']; hottest: PmCategory | null } | null {
  const c = readCache<unknown>('prediction-market/categories', PM_CATEGORY_BODY, null, { stale: true });
  const m = readCache<unknown>('prediction-market/market-screener', PM_MARKET_BODY, null, { stale: true });
  if (!c && !m) return null;
  const categories: PmCategory[] = rows(c?.value).map((r) => {
    const base = { volume24h: n(r.total_volume_24hr), volume1w: n(r.total_volume_1wk), openInterest: n(r.total_open_interest) };
    return { category: s(r.category) ?? '?', activeMarkets: n(r.active_markets), traders24h: n(r.total_traders_24h), topMarketId: s(r.top_market_id), topQuestion: s(r.top_market_question), ...base, ...categoryHeat(base) };
  });
  const totals = {
    openInterest: categories.reduce((a, x) => a + (x.openInterest ?? 0), 0),
    volume24h: categories.reduce((a, x) => a + (x.volume24h ?? 0), 0),
    activeMarkets: categories.reduce((a, x) => a + (x.activeMarkets ?? 0), 0),
    traders24h: categories.reduce((a, x) => a + (x.traders24h ?? 0), 0),
  };
  const hottest = [...categories].filter((x) => x.weather != null && (x.volume24h ?? 0) > 100_000).sort((a, b) => b.weather! - a.weather!)[0] ?? null;
  return { markets: rows(m?.value).map(toMarket), totals, hottest };
}

export function predictTitle(b: PredictBoard): string {
  if (b.unavailable || !b.categories.length) return 'Prediction markets: no reading from Nansen right now';
  const hot = [...b.categories].filter((x) => x.weather != null && (x.volume24h ?? 0) > 100_000).sort((a, z) => z.weather! - a.weather!)[0];
  const mover = [...b.markets].filter((m) => isMover(m, b.asOf)).sort((a, z) => Math.abs(z.change1d!) - Math.abs(a.change1d!))[0];
  const q = mover ? (mover.question.length > 70 ? `${mover.question.slice(0, 69).trimEnd()}…` : mover.question) : '';
  const parts = [
    hot ? `${hot.category} is trading at ${num(hot.heat, 1)}× a normal day.` : null,
    mover ? `Biggest move: “${q}”, ${mover.change1d! > 0 ? 'up' : 'down'} ${Math.round(Math.abs(mover.change1d!) * 100)} points.` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Prediction markets are trading at a normal pace.';
}

// ------------------------------------------------------------ market detail

export interface PmDetail {
  id: string;
  candles: Array<{ t: string; close: number; volume: number }>;
  book: { bids: Array<{ price: number; size: number }>; asks: Array<{ price: number; size: number }> } | null;
  holders: HolderLike[];
  balance: ReturnType<typeof holderBalance>;
  trades: Array<{
    at: string;
    side: string | null;
    action: string | null;
    price: number | null;
    usd: number | null;
    buyer: string | null;
    seller: string | null;
  }>;
  errors: string[];
  provenance: Provenance;
  tally: CallTally;
}

export async function marketDetail(id: string): Promise<PmDetail> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const errors: string[] = [];
    const calls: Provenance['calls'] = [];
    const safe = async <T>(p: Promise<{ data: T; call: Provenance['calls'][number] }>, what: string): Promise<T | null> => {
      try {
        const r = await p;
        calls.push(r.call);
        return r.data;
      } catch (e) {
        errors.push(`${what}: ${errText(e)}`);
        return null;
      }
    };
    const [o, b, h, t] = await Promise.all([
      safe(
        traced<unknown>(
          'prediction-market/ohlcv',
          { market_id: id, date: { from: requestDay(7), to: requestDay(0) }, pagination: { page: 1, per_page: 400 } },
          1,
        ),
        'Price history',
      ),
      safe(traced<unknown>('prediction-market/orderbook', { market_id: id, pagination: { page: 1, per_page: 200 } }, 1), 'Order book'),
      safe(traced<unknown>('prediction-market/top-holders', { market_id: id, pagination: { page: 1, per_page: 50 } }, 5), 'Top holders'),
      // Only timestamp ordering is accepted here (usdc_value is a 422), so
      // take the latest 100 and rank them by size ourselves.
      safe(
        traced<unknown>(
          'prediction-market/trades-by-market',
          {
            market_id: id,
            date: { from: requestDay(1), to: requestDay(0) },
            pagination: { page: 1, per_page: 100 },
            order_by: [{ field: 'timestamp', direction: 'DESC' }],
          },
          1,
        ),
        'Trades',
      ),
    ]);
    // YES candles only (outcome 1), oldest first.
    const candles = rows(o)
      .filter((r) => r.outcome_index === 1 || /^yes$/i.test(String(r.side)))
      .map((r) => ({ t: s(r.period_start) ?? '', close: n(r.close) ?? 0, volume: n(r.volume_usd) ?? 0 }))
      .filter((c) => c.t)
      .sort((a, z) => a.t.localeCompare(z.t));
    const yesBook = rows(b).filter((r) => r.outcome_index === 1 || /^yes$/i.test(String(r.outcome)));
    const book = yesBook.length
      ? {
          bids: yesBook
            .filter((r) => /buy|bid/i.test(String(r.side)))
            .map((r) => ({ price: n(r.price) ?? 0, size: n(r.size) ?? 0 }))
            .sort((a, z) => z.price - a.price),
          asks: yesBook
            .filter((r) => /sell|ask/i.test(String(r.side)))
            .map((r) => ({ price: n(r.price) ?? 0, size: n(r.size) ?? 0 }))
            .sort((a, z) => a.price - z.price),
        }
      : null;
    const holders: HolderLike[] = rows(h).map((r) => ({
      address: s(r.address) ?? '',
      side: s(r.side) ?? '',
      outcomeIndex: n(r.outcome_index),
      size: n(r.position_size) ?? 0,
      currentPrice: n(r.current_price),
      avgEntry: n(r.avg_entry_price),
      unrealizedUsd: n(r.unrealized_pnl_usd),
    }));
    const trades = rows(t)
      .map((r) => ({
        at: s(r.timestamp) ?? '',
        side: s(r.side),
        action: s(r.taker_action),
        price: n(r.price),
        usd: n(r.usdc_value),
        buyer: s(r.buyer),
        seller: s(r.seller),
      }))
      .sort((a, z) => (z.usd ?? 0) - (a.usd ?? 0))
      .slice(0, 50);
    const balance = holderBalance(holders);
    return {
      id,
      candles,
      book,
      holders,
      balance,
      trades,
      errors,
      tally,
      provenance: {
        title: 'Market detail',
        formula:
          "implied probability = YES price; holder value = position size × current price, per side\nin profit = share of each side's value with positive unrealized PnL",
        inputs: [
          { label: "YES holders' value", value: usd(balance.yesUsd) },
          { label: "NO holders' value", value: usd(balance.noUsd) },
          { label: 'Largest holders on YES', value: balance.yesShare != null ? pct(balance.yesShare, 0) : 'n/a' },
        ],
        calls,
        notes: [
          'The 50 largest positions. Hourly candles over 7 days. Trades: the largest 50 of the latest 100 (the endpoint only sorts by time).',
        ],
      },
    };
  });
}

// ---------------------------------------------------------- holder records

export interface PmRecords {
  id: string;
  records: Array<{
    address: string;
    side: string;
    valueUsd: number;
    marketsTraded: number | null;
    winRate: number | null;
    totalPnlUsd: number | null;
    skilled: boolean;
  }>;
  skilled: number;
  skilledYesShare: number | null;
  divergence: number | null;
  price: number | null;
  winners: Array<{ address: string; side: string | null; pnlUsd: number | null; resolved: boolean }>;
  provenance: Provenance;
  tally: CallTally;
}

export const RECORD_HOLDERS = 10;

/** Top holders' own prediction track records, and who is winning in this market: ~15 credits. */
export async function holderRecords(id: string, price: number | null): Promise<PmRecords> {
  const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
  return callScope.run(tally, async () => {
    const h = await traced<unknown>('prediction-market/top-holders', { market_id: id, pagination: { page: 1, per_page: 50 } }, 5);
    const holders: HolderLike[] = rows(h.data)
      .map((r) => ({
        address: s(r.address) ?? '',
        side: s(r.side) ?? '',
        outcomeIndex: n(r.outcome_index),
        size: n(r.position_size) ?? 0,
        currentPrice: n(r.current_price),
        avgEntry: n(r.avg_entry_price),
        unrealizedUsd: n(r.unrealized_pnl_usd),
      }))
      .filter((x) => x.address);
    const byValue = [...holders].sort((a, z) => z.size * (z.currentPrice ?? 0) - a.size * (a.currentPrice ?? 0));
    const top = byValue.filter((x, i, arr) => arr.findIndex((y) => y.address === x.address) === i).slice(0, RECORD_HOLDERS);
    const summaries = await Promise.all(
      top.map((x) =>
        traced<unknown>('prediction-market/address-summary', { address: x.address, pagination: { page: 1, per_page: 1 } }, 1)
          .then((r) => ({ address: x.address, r: rows(r.data)[0] ?? null, call: r.call }))
          .catch(() => ({ address: x.address, r: null, call: null })),
      ),
    );
    const recs = new Map<string, RecordLike>();
    for (const x of summaries)
      if (x.r)
        recs.set(x.address.toLowerCase(), {
          marketsTraded: n(x.r.markets_traded),
          winRate: n(x.r.win_rate),
          totalPnlUsd: n(x.r.total_pnl_usd),
        });
    const div = skilledDivergence(top, recs, price);
    const p = await traced<unknown>(
      'prediction-market/pnl-by-market',
      { market_id: id, pagination: { page: 1, per_page: 15 }, order_by: [{ field: 'total_pnl_usd', direction: 'DESC' }] },
      5,
    ).catch(() => null);
    const winners = p
      ? rows(p.data).map((r) => ({
          address: s(r.address) ?? '',
          side: s(r.side_held),
          pnlUsd: n(r.total_pnl_usd),
          resolved: r.market_resolved === true,
        }))
      : [];
    const summaryCalls = summaries.filter((x) => x.call).map((x) => x.call!);
    return {
      id,
      price,
      winners,
      tally,
      ...div,
      records: top.map((x) => {
        const r = recs.get(x.address.toLowerCase());
        return {
          address: x.address,
          side: x.side,
          valueUsd: x.size * (x.currentPrice ?? 0),
          marketsTraded: r?.marketsTraded ?? null,
          winRate: r?.winRate ?? null,
          totalPnlUsd: r?.totalPnlUsd ?? null,
          skilled: isSkilled(r),
        };
      }),
      provenance: {
        title: 'Where skilled money sits against the price',
        formula: `skilled = 10+ prediction markets traded, positive total PnL, 55%+ won (address-summary)\namong the ${RECORD_HOLDERS} largest holders: skilled YES share = skilled value on YES ÷ skilled value\ndivergence = skilled YES share − YES price (points)`,
        inputs: [
          { label: 'Skilled among the largest', value: `${div.skilled} of ${top.length}` },
          { label: 'Skilled YES share', value: div.skilledYesShare != null ? pct(div.skilledYesShare, 0) : 'n/a' },
          { label: 'Market says', value: impliedPct(price) },
        ],
        calls: [
          h.call,
          {
            endpoint: 'prediction-market/address-summary',
            body: { address: '<each of the largest holders>' },
            credits: 1,
            ref: `${summaryCalls.length} calls, cached a day`,
          },
          ...(p ? [p.call] : []),
        ],
        notes: [
          'Calibration against resolved markets comes with the M9 backtest.',
          'Needs at least two skilled holders among the largest, or it reports nothing.',
        ],
      },
    };
  });
}

export { heatLabel };

function toMarket(r: Row): PmMarket {
  return {
    id: String(r.market_id),
    question: s(r.question) ?? '?',
    eventTitle: s(r.event_title),
    endDate: s(r.end_date),
    tags: Array.isArray(r.tags) ? (r.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
    price: n(r.last_trade_price),
    change1d: n(r.one_day_price_change),
    volume24h: n(r.volume_24hr),
    volume1w: n(r.volume_1wk),
    openInterest: n(r.open_interest),
    liquidity: n(r.liquidity),
    traders24h: n(r.unique_traders_24h),
    bid: n(r.best_bid),
    ask: n(r.best_ask),
    negRisk: r.neg_risk === true,
    slug: s(r.slug),
    volumeTotal: n(r.volume),
    createdAt: s(r.created_at),
    volumeChangePct: n(r.volume_change_pct),
  };
}

export interface CategoryPage { category: PmCategory | null; markets: PmMarket[]; unavailable: string | null; provenance: Provenance }

/** One category's active markets (Nansen market screener filtered by tag), busiest first. */
export async function categoryMarkets(category: string): Promise<CategoryPage> {
  const board = await predictBoard();
  const cat = board.categories.find((c) => c.category.toLowerCase() === category.toLowerCase()) ?? null;
  const body = { status: 'active', tags: [cat?.category ?? category], order_by: [{ field: 'volume_24hr', direction: 'DESC' }], pagination: { page: 1, per_page: 200 } };
  const provenance: Provenance = { title: `${cat?.category ?? category} markets`, formula: 'Nansen prediction-market/market-screener, active markets tagged with this category, by 24h volume', inputs: [], calls: [] };
  try {
    const r = await traced<unknown>('prediction-market/market-screener', body, 1);
    const markets = rows(r.data).map(toMarket).filter((x) => x.question !== '?');
    return { category: cat, markets, unavailable: markets.length ? null : 'Nansen lists no active markets in this category right now.', provenance: { ...provenance, inputs: [{ label: 'Markets', value: String(markets.length) }], calls: [r.call] } };
  } catch (e) {
    return { category: cat, markets: [], unavailable: errText(e), provenance };
  }
}
