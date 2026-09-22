import { z } from "zod";
import {
  PaginationRequest,
  PaginationInfo,
  SortDirection,
  NumericRangeFilter,
  IntegerRangeFilter,
  DateRange,
  HistoricalSmartMoneyFilterType,
  HistoricalLabelType,
} from "./common";
import { CHAIN_ENUMS } from "./chain-enums";

/**
 * Backtesting Data family (Beta — all under `/api/v1beta1/*`, "subject to
 * breaking changes" per the docs). 7 endpoints, sources:
 *  - docs/raw/hist-screener.md        -> POST /api/v1beta1/token-screener/historical
 *  - docs/raw/hist-ohlcv.md           -> POST /api/v1beta1/tgm/historical-token-ohlcv
 *  - docs/raw/hist-flow-summary.md    -> POST /api/v1beta1/tgm/historical-token-flow-summary
 *  - docs/raw/hist-dex-trades.md      -> POST /api/v1beta1/tgm/historical-dex-trades
 *  - docs/raw/hist-pnl-leaderboard.md -> POST /api/v1beta1/tgm/historical-pnl-leaderboard
 *  - docs/raw/hist-quant-scores.md    -> POST /api/v1beta1/tgm/historical-token-quant-scores
 *  - docs/raw/hist-address-balance.md -> POST /api/v1beta1/profiler/address/historical-token-balances
 *
 * Several of these endpoints reuse the exact same OpenAPI component name as
 * their live/non-historical counterpart already modeled in
 * token-god-mode.ts (e.g. "OHLCVCandle", "MarketCapData",
 * "TGMWhoBoughtSoldType"). Per this codebase's existing convention (each
 * family file only imports from ./common and ./chain-enums, never from a
 * sibling family file), those shapes are redefined locally here rather than
 * imported, even where identical.
 *
 * Required-but-anyOf-wrapped fields: as in profiler.ts, several response
 * schemas here mark a field `required` while wrapping its type in a
 * single-element `anyOf` with no null variant (e.g.
 * TGMHistoricalDexTrade.token_amount). Modeled as `.nullable()` (required
 * key, nullable value) rather than `.nullable().optional()` — flagged inline.
 */

// ===========================================================================
// POST /api/v1beta1/token-screener/historical (docs/raw/hist-screener.md)
// Credit cost: 5.
// ===========================================================================

export const HistoricalTokenScreenerChain = z.enum(CHAIN_ENUMS.histTokenScreener);
export type HistoricalTokenScreenerChain = z.infer<typeof HistoricalTokenScreenerChain>;

/** Mirrors TraderType in token-god-mode.ts (same values, kept file-local). */
export const HistoricalTraderType = z.enum([
  "all",
  "sm",
  "whale",
  "public_figure",
  "trending",
  "consistent_perps_winner",
  "high_winrate_hl_perps_trader",
  "predicted_winner",
]);
export type HistoricalTraderType = z.infer<typeof HistoricalTraderType>;

export const TokenScreenerHistoricalFilters = z.object({
  /** Only applied when trader_type='sm'. Empty list includes all smart-money labels. */
  sm_label_filter: z.array(HistoricalSmartMoneyFilterType).optional().default([]),
  exclude_sm_labels_filter: z.array(HistoricalSmartMoneyFilterType).optional().default([]),
  volume_usd: NumericRangeFilter.optional(),
  buy_volume_usd: NumericRangeFilter.optional(),
  sell_volume_usd: NumericRangeFilter.optional(),
  market_cap_usd: NumericRangeFilter.optional(),
  nof_traders: IntegerRangeFilter.optional(),
  nof_buyers: IntegerRangeFilter.optional(),
  nof_sellers: IntegerRangeFilter.optional(),
  nof_buys: IntegerRangeFilter.optional(),
  nof_sells: IntegerRangeFilter.optional(),
  fdv_usd: NumericRangeFilter.optional(),
  fdv_mc_ratio: NumericRangeFilter.optional(),
  liquidity_usd: NumericRangeFilter.optional(),
  /** Can be negative. */
  netflow_usd: NumericRangeFilter.optional(),
  inflow_fdv_ratio: NumericRangeFilter.optional(),
  outflow_fdv_ratio: NumericRangeFilter.optional(),
  token_age_days: IntegerRangeFilter.optional(),
});
export type TokenScreenerHistoricalFilters = z.infer<typeof TokenScreenerHistoricalFilters>;

export const TokenScreenerHistoricalSortField = z.enum([
  "volume",
  "buy_volume",
  "sell_volume",
  "netflow",
  "price_change",
  "market_cap_usd",
  "fdv",
  "liquidity",
  "price_usd",
  "nof_traders",
  "nof_buyers",
  "nof_sellers",
  "nof_buys",
  "nof_sells",
  "token_age_days",
]);
export type TokenScreenerHistoricalSortField = z.infer<typeof TokenScreenerHistoricalSortField>;

export const TokenScreenerHistoricalSortOrder = z.object({
  field: TokenScreenerHistoricalSortField,
  direction: SortDirection,
});
export type TokenScreenerHistoricalSortOrder = z.infer<typeof TokenScreenerHistoricalSortOrder>;

export const TokenScreenerHistoricalRequest = z.object({
  /** Required. End date of the screener window. */
  to_date: z.string(),
  /** Required. 1-365. */
  timeframe_days: z.number().int().min(1).max(365),
  /** Required, non-empty. */
  chains: z.array(HistoricalTokenScreenerChain).min(1),
  /** Empty list includes all sectors. */
  sectors_filter: z.array(z.string()).optional(),
  /** Empty list excludes nothing. */
  exclude_sectors: z.array(z.string()).optional(),
  /** @deprecated Use `trader_type` instead. Ignored when trader_type is provided. */
  only_smart_money: z.boolean().optional().default(false),
  /** Overrides only_smart_money when provided. */
  trader_type: HistoricalTraderType.optional(),
  filters: TokenScreenerHistoricalFilters.optional(),
  pagination: PaginationRequest.optional(),
  /** Defaults to netflow DESC. Only the first element is used. */
  order_by: z.array(TokenScreenerHistoricalSortOrder).optional(),
  /** Default true. */
  apply_blacklist_filter: z.boolean().optional().default(true),
});
export type TokenScreenerHistoricalRequest = z.infer<typeof TokenScreenerHistoricalRequest>;

export const TokenScreenerHistoricalItem = z.object({
  token_address: z.string(),
  token_symbol: z.string(),
  chain: z.string(),
  /** Token price in USD at to_date. */
  price_usd: z.number().nullable().optional(),
  /** Price change over the timeframe as a ratio. */
  price_change: z.number().nullable().optional(),
  /** Falls back to FDV if zero. */
  market_cap_usd: z.number().nullable().optional(),
  fdv: z.number().nullable().optional(),
  fdv_mc_ratio: z.number().nullable().optional(),
  /** Total DEX volume (buy + sell) in USD over the timeframe. */
  volume: z.number().nullable().optional(),
  buy_volume: z.number().nullable().optional(),
  sell_volume: z.number().nullable().optional(),
  /** buy - sell, in USD. */
  netflow: z.number().nullable().optional(),
  inflow_fdv_ratio: z.number().nullable().optional(),
  outflow_fdv_ratio: z.number().nullable().optional(),
  /** Days since token deployment as of to_date. */
  token_age_days: z.number().int().nullable().optional(),
  liquidity: z.number().nullable().optional(),
  sectors: z.array(z.string()).optional().default([]),
});
export type TokenScreenerHistoricalItem = z.infer<typeof TokenScreenerHistoricalItem>;

export const TokenScreenerHistoricalResponse = z.object({
  pagination: PaginationInfo,
  data: z.array(TokenScreenerHistoricalItem),
});
export type TokenScreenerHistoricalResponse = z.infer<typeof TokenScreenerHistoricalResponse>;

// ===========================================================================
// POST /api/v1beta1/tgm/historical-token-ohlcv (docs/raw/hist-ohlcv.md)
// Credit cost: 5.
// ===========================================================================

export const HistoricalTokenOHLCVChain = z.enum(CHAIN_ENUMS.histTgmTokenOhlcv);
export type HistoricalTokenOHLCVChain = z.infer<typeof HistoricalTokenOHLCVChain>;

/**
 * Full resolution enum per the doc's `$ref`. Prose notes this endpoint only
 * *accepts* 5m/15m/30m/1h/4h/1d/1w — 1m and 1M are documented as
 * unsupported here even though the referenced component includes them.
 */
export const HistoricalResolutionEnum = z.enum([
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
  "1M",
]);
export type HistoricalResolutionEnum = z.infer<typeof HistoricalResolutionEnum>;

export const TGMHistoricalTokenOHLCVRequest = z.object({
  /** Required. */
  chain: HistoricalTokenOHLCVChain,
  /** Required. For chain="hyperliquid", pass the coin symbol instead (e.g. "BTC", "HYPE", "@1", "XYZ/USDC"). */
  token_address: z.string(),
  /** Required. Start of the data window, ISO 8601 (date or datetime). */
  date_from: z.string(),
  /**
   * Snapshot anchor; semantically equivalent to date_to. Date-only values
   * are end-of-day. Provide exactly one of as_of_date / as_of_ts.
   */
  as_of_date: z.string().optional(),
  /** Exact UTC-normalized cutoff for Hyperliquid requests. */
  as_of_ts: z.string().optional(),
  /** Required. 1m and 1M are not supported by this endpoint (see HistoricalResolutionEnum). */
  timeframe: HistoricalResolutionEnum,
  /**
   * High-tf-only (1d/1w). Passing this with a low-tf timeframe returns 400 —
   * low-tf has no blacklist plumbing.
   */
  apply_blacklist_filter: z.boolean().optional(),
});
export type TGMHistoricalTokenOHLCVRequest = z.infer<typeof TGMHistoricalTokenOHLCVRequest>;

export const HistoricalMarketCapData = z.object({
  open: z.number().nullable().optional(),
  high: z.number().nullable().optional(),
  low: z.number().nullable().optional(),
  close: z.number().nullable().optional(),
});
export type HistoricalMarketCapData = z.infer<typeof HistoricalMarketCapData>;

export const HistoricalOHLCVCandle = z.object({
  interval_start: z.string(),
  open: z.number().nullable().optional(),
  high: z.number().nullable().optional(),
  low: z.number().nullable().optional(),
  close: z.number().nullable().optional(),
  volume: z.number().nullable().optional(),
  volume_usd: z.number().nullable().optional(),
  market_cap: HistoricalMarketCapData,
});
export type HistoricalOHLCVCandle = z.infer<typeof HistoricalOHLCVCandle>;

/**
 * Named "TokenOHLCVResponse" in the docs — same component name/shape as the
 * live /tgm/token-ohlcv single-token response in token-god-mode.ts, renamed
 * here to avoid a cross-file collision. Unlike the live endpoint, this
 * historical endpoint has no batch (`token_addresses`) request mode, so
 * there is no corresponding "batch" response variant.
 */
export const HistoricalTokenOHLCVResponse = z.object({
  chain: z.string(),
  token_address: z.string(),
  timeframe: z.string(),
  /** Ordered by interval_start. */
  data: z.array(HistoricalOHLCVCandle),
  /**
   * True if the candle cap was reached. Most chains cap at 50,000 candles
   * (omits the most recent ones); Hyperliquid caps at ~5,000 (omits the
   * oldest ones instead, from its own upstream feed).
   */
  truncated: z.boolean().optional().default(false),
  truncation_note: z.string().nullable().optional(),
});
export type HistoricalTokenOHLCVResponse = z.infer<typeof HistoricalTokenOHLCVResponse>;

// ===========================================================================
// POST /api/v1beta1/tgm/historical-token-flow-summary (docs/raw/hist-flow-summary.md)
// Credit cost: 5.
// ===========================================================================

export const HistoricalTgmChain = z.enum(CHAIN_ENUMS.histTgmTokenFlowSummary);
export type HistoricalTgmChain = z.infer<typeof HistoricalTgmChain>;

export const TGMHistoricalTokenFlowSummaryRequest = z.object({
  /** Required. Currently base, bnb, ethereum, solana. */
  chain: HistoricalTgmChain,
  /** Required. */
  token_address: z.string(),
  /**
   * Required. `to` is the as-of date for label resolution; the (from, to)
   * span determines bucket resolution and the lookback window for
   * avg_flow_usd.
   */
  date_range: DateRange,
  /** Default true. */
  apply_blacklist_filter: z.boolean().optional().default(true),
});
export type TGMHistoricalTokenFlowSummaryRequest = z.infer<
  typeof TGMHistoricalTokenFlowSummaryRequest
>;

/**
 * No `required` list at all in the docs — every field (including
 * token_symbol) is optional/nullable. All segment columns are NULL when
 * temporal label data isn't available for the queried date_to (before
 * 2025-03-11 for whale/public_figure/top_pnl/exchange), distinct from a
 * zero net flow.
 */
export const TGMHistoricalTokenFlowSummary = z.object({
  token_symbol: z.string().nullable().optional(),
  public_figure_net_flow_usd: z.number().nullable().optional(),
  public_figure_avg_flow_usd: z.number().nullable().optional(),
  public_figure_wallet_count: z.number().int().nullable().optional(),
  top_pnl_net_flow_usd: z.number().nullable().optional(),
  top_pnl_avg_flow_usd: z.number().nullable().optional(),
  top_pnl_wallet_count: z.number().int().nullable().optional(),
  whale_net_flow_usd: z.number().nullable().optional(),
  whale_avg_flow_usd: z.number().nullable().optional(),
  whale_wallet_count: z.number().int().nullable().optional(),
  /** Direction inverted: deposit-to-exchange is positive. Combines CEX transfers and DEX trades. */
  exchange_net_flow_usd: z.number().nullable().optional(),
  exchange_avg_flow_usd: z.number().nullable().optional(),
  /** Always 0 (matching production flow-intelligence — not tracked). */
  exchange_wallet_count: z.number().int().nullable().optional(),
  /** Available from 2020+; before 2025-03-11 covers DEX trades only. */
  smart_trader_net_flow_usd: z.number().nullable().optional(),
  smart_trader_avg_flow_usd: z.number().nullable().optional(),
  smart_trader_wallet_count: z.number().int().nullable().optional(),
  /** 24h fresh-wallet inflow from the most recent snapshot on or before date_to. */
  fresh_wallets_net_flow_usd: z.number().nullable().optional(),
  /** 7-day daily-average fresh-wallet inflow from the snapshot. */
  fresh_wallets_avg_flow_usd: z.number().nullable().optional(),
  /** Always 0 (matching production — not tracked separately). */
  fresh_wallets_wallet_count: z.number().int().nullable().optional(),
});
export type TGMHistoricalTokenFlowSummary = z.infer<typeof TGMHistoricalTokenFlowSummary>;

export const TGMHistoricalTokenFlowSummaryResponse = z.object({
  /** Single aggregated row per (token_address, date_to). */
  data: z.array(TGMHistoricalTokenFlowSummary),
  warnings: z.array(z.string()).optional(),
});
export type TGMHistoricalTokenFlowSummaryResponse = z.infer<
  typeof TGMHistoricalTokenFlowSummaryResponse
>;

// ===========================================================================
// POST /api/v1beta1/tgm/historical-dex-trades (docs/raw/hist-dex-trades.md)
// Credit cost: 5.
// ===========================================================================

export const HistoricalTgmDexTradesChain = z.enum(CHAIN_ENUMS.histTgmDexTrades);
export type HistoricalTgmDexTradesChain = z.infer<typeof HistoricalTgmDexTradesChain>;

/** Same values/name as TGMWhoBoughtSoldType in token-god-mode.ts, kept file-local. */
export const TGMWhoBoughtSoldType = z.enum(["BUY", "SELL"]);
export type TGMWhoBoughtSoldType = z.infer<typeof TGMWhoBoughtSoldType>;

export const TGMHistoricalDexTradesFilters = z.object({
  /** Omit for all trades. */
  action: TGMWhoBoughtSoldType.optional(),
  include_labels: z.array(HistoricalLabelType).optional(),
  value_usd: NumericRangeFilter.optional(),
  trader_address: z.string().optional(),
});
export type TGMHistoricalDexTradesFilters = z.infer<typeof TGMHistoricalDexTradesFilters>;

export const TGMHistoricalDexTradesSortField = z.enum([
  "block_timestamp",
  "estimated_value_usd",
  "token_amount",
  "estimated_swap_price_usd",
]);
export type TGMHistoricalDexTradesSortField = z.infer<typeof TGMHistoricalDexTradesSortField>;

export const TGMHistoricalDexTradesSortOrder = z.object({
  field: TGMHistoricalDexTradesSortField,
  direction: SortDirection,
});
export type TGMHistoricalDexTradesSortOrder = z.infer<typeof TGMHistoricalDexTradesSortOrder>;

export const TGMHistoricalDexTradesRequest = z.object({
  /** Required. */
  chain: HistoricalTgmDexTradesChain,
  /** Required. */
  token_address: z.string(),
  /** Required. */
  date_range: DateRange,
  pagination: PaginationRequest.optional(),
  filters: TGMHistoricalDexTradesFilters.optional(),
  /** Defaults to block_timestamp DESC. Only the first element is used. */
  order_by: z.array(TGMHistoricalDexTradesSortOrder).optional(),
  /** Default true. */
  apply_blacklist_filter: z.boolean().optional().default(true),
});
export type TGMHistoricalDexTradesRequest = z.infer<typeof TGMHistoricalDexTradesRequest>;

/**
 * token_amount, traded_token_amount, estimated_swap_price_usd, and
 * estimated_value_usd are all `required` despite being anyOf-wrapped with no
 * null variant — modeled as required-but-nullable, see file-level note.
 * Differs from the live TGMDexTrade (token-god-mode.ts): no token_address or
 * traded_token_address columns (not surfaced by this endpoint).
 */
export const TGMHistoricalDexTrade = z.object({
  block_timestamp: z.string(),
  transaction_hash: z.string(),
  trader_address: z.string(),
  /** Temporally-correct label of the trader as of the trade date. */
  trader_address_label: z.string().nullable().optional(),
  action: TGMWhoBoughtSoldType,
  /** Symbol of the queried token. */
  token_name: z.string(),
  token_amount: z.number().nullable(),
  /** Symbol of the counter token. */
  traded_token_name: z.string(),
  traded_token_amount: z.number().nullable(),
  estimated_swap_price_usd: z.number().nullable(),
  estimated_value_usd: z.number().nullable(),
});
export type TGMHistoricalDexTrade = z.infer<typeof TGMHistoricalDexTrade>;

export const TGMHistoricalDexTradesResponse = z.object({
  data: z.array(TGMHistoricalDexTrade),
  pagination: PaginationInfo,
});
export type TGMHistoricalDexTradesResponse = z.infer<typeof TGMHistoricalDexTradesResponse>;

// ===========================================================================
// POST /api/v1beta1/tgm/historical-pnl-leaderboard (docs/raw/hist-pnl-leaderboard.md)
// Credit cost: 25.
// ===========================================================================

export const HistoricalTgmPnlLeaderboardChain = z.enum(CHAIN_ENUMS.histTgmPnlLeaderboard);
export type HistoricalTgmPnlLeaderboardChain = z.infer<typeof HistoricalTgmPnlLeaderboardChain>;

export const TGMHistoricalPnlLeaderboardFilters = z.object({
  /** Empty = all traders. */
  trader_address: z.array(z.string()).optional(),
  pnl_usd_total: NumericRangeFilter.optional(),
  roi_percent_total: NumericRangeFilter.optional(),
  pnl_usd_realised: NumericRangeFilter.optional(),
  roi_percent_realised: NumericRangeFilter.optional(),
  pnl_usd_unrealised: NumericRangeFilter.optional(),
  roi_percent_unrealised: NumericRangeFilter.optional(),
  netflow_amount_usd: NumericRangeFilter.optional(),
  holding_usd: NumericRangeFilter.optional(),
  nof_trades: NumericRangeFilter.optional(),
  /** Ratio of current holdings to max balance held. */
  still_holding_balance_ratio: NumericRangeFilter.optional(),
  holding_amount: NumericRangeFilter.optional(),
  nof_buys: NumericRangeFilter.optional(),
  nof_sells: NumericRangeFilter.optional(),
  bought_amount: NumericRangeFilter.optional(),
  sold_amount: NumericRangeFilter.optional(),
  bought_usd: NumericRangeFilter.optional(),
  sold_usd: NumericRangeFilter.optional(),
  max_balance_held: NumericRangeFilter.optional(),
  max_balance_held_usd: NumericRangeFilter.optional(),
});
export type TGMHistoricalPnlLeaderboardFilters = z.infer<
  typeof TGMHistoricalPnlLeaderboardFilters
>;

export const TGMHistoricalPnlLeaderboardSortField = z.enum([
  "pnl_usd_total",
  "roi_percent_total",
  "pnl_usd_realised",
  "roi_percent_realised",
  "pnl_usd_unrealised",
  "roi_percent_unrealised",
  "holding_usd",
  "holding_amount",
  "nof_trades",
  "still_holding_balance_ratio",
  "netflow_amount_usd",
  "max_balance_held",
  "max_balance_held_usd",
  "nof_buys",
  "nof_sells",
  "bought_amount",
  "sold_amount",
  "bought_usd",
  "sold_usd",
]);
export type TGMHistoricalPnlLeaderboardSortField = z.infer<
  typeof TGMHistoricalPnlLeaderboardSortField
>;

export const TGMHistoricalPnlLeaderboardSortOrder = z.object({
  field: TGMHistoricalPnlLeaderboardSortField,
  direction: SortDirection,
});
export type TGMHistoricalPnlLeaderboardSortOrder = z.infer<
  typeof TGMHistoricalPnlLeaderboardSortOrder
>;

export const TGMHistoricalPnlLeaderboardRequest = z.object({
  /** Required. Currently base, bnb, ethereum, solana. */
  chain: HistoricalTgmPnlLeaderboardChain,
  /** Required. */
  token_address: z.string(),
  /** Required. Dates are truncated to YYYY-MM-DD server-side. */
  date_range: DateRange,
  pagination: PaginationRequest.optional(),
  filters: TGMHistoricalPnlLeaderboardFilters.optional(),
  /** Defaults to pnl_usd_total DESC. Only the first element is used. */
  order_by: z.array(TGMHistoricalPnlLeaderboardSortOrder).optional(),
  /** Default true. */
  apply_blacklist_filter: z.boolean().optional().default(true),
});
export type TGMHistoricalPnlLeaderboardRequest = z.infer<typeof TGMHistoricalPnlLeaderboardRequest>;

/**
 * Named "TGMPnlLeaderboard" in the docs — renamed here to avoid a collision
 * with TGMPnlLeaderboardItem (the live /tgm/pnl-leaderboard response record)
 * in token-god-mode.ts.
 */
export const HistoricalTGMPnlLeaderboardItem = z.object({
  trader_address: z.string(),
  /** Nansen name of the trader. */
  trader_address_label: z.string().nullable().optional(),
  /** Latest spot price if date_to is today or later, otherwise the daily median price for that date. */
  price_usd: z.number().nullable().optional(),
  pnl_usd_realised: z.number().nullable().optional(),
  pnl_usd_unrealised: z.number().nullable().optional(),
  holding_amount: z.number().nullable().optional(),
  holding_usd: z.number().nullable().optional(),
  max_balance_held: z.number().nullable().optional(),
  max_balance_held_usd: z.number().nullable().optional(),
  still_holding_balance_ratio: z.number().nullable().optional(),
  netflow_amount_usd: z.number().nullable().optional(),
  netflow_amount: z.number().nullable().optional(),
  roi_percent_total: z.number().nullable().optional(),
  roi_percent_realised: z.number().nullable().optional(),
  roi_percent_unrealised: z.number().nullable().optional(),
  pnl_usd_total: z.number().nullable().optional(),
  nof_trades: z.number().int().nullable().optional(),
});
export type HistoricalTGMPnlLeaderboardItem = z.infer<typeof HistoricalTGMPnlLeaderboardItem>;

export const TGMHistoricalPnlLeaderboardResponse = z.object({
  data: z.array(HistoricalTGMPnlLeaderboardItem),
  pagination: PaginationInfo,
});
export type TGMHistoricalPnlLeaderboardResponse = z.infer<
  typeof TGMHistoricalPnlLeaderboardResponse
>;

// ===========================================================================
// POST /api/v1beta1/tgm/historical-token-quant-scores (docs/raw/hist-quant-scores.md)
// Credit cost: 25.
// ===========================================================================

/** Reuses the shared "TGMChain" OpenAPI component (identical to token-god-mode.ts's TGMChain). */
export const HistoricalTgmTokenQuantScoresChain = z.enum(CHAIN_ENUMS.histTgmTokenQuantScores);
export type HistoricalTgmTokenQuantScoresChain = z.infer<
  typeof HistoricalTgmTokenQuantScoresChain
>;

export const TgmHistoricalTokenQuantScoresRequest = z.object({
  /** Required. Date to query indicators for. */
  as_of_date: z.string(),
  /** Required. */
  chain: HistoricalTgmTokenQuantScoresChain,
  /** Required. */
  token_address: z.string(),
});
export type TgmHistoricalTokenQuantScoresRequest = z.infer<
  typeof TgmHistoricalTokenQuantScoresRequest
>;

export const TgmHistoricalTokenQuantScore = z.object({
  indicator_type: z.string(),
  signal: z.number().nullable().optional(),
  /** vs same market cap group, 0-100. */
  signal_percentile: z.number().nullable().optional(),
  /** Qualitative score label — docs don't give a closed enum, kept as string. */
  score: z.string().nullable().optional(),
  last_trigger_on: z.string().nullable().optional(),
  is_stablecoin: z.boolean().nullable().optional(),
  market_cap_usd: z.number().nullable().optional(),
  market_cap_group: z.string().nullable().optional(),
  /** Whether the indicator measures risk or reward — docs don't give a closed enum, kept as string. */
  model_type: z.string().nullable().optional(),
});
export type TgmHistoricalTokenQuantScore = z.infer<typeof TgmHistoricalTokenQuantScore>;

/** No pagination field on this response, unlike most other list endpoints. */
export const TgmHistoricalTokenQuantScoresResponse = z.object({
  data: z.array(TgmHistoricalTokenQuantScore),
});
export type TgmHistoricalTokenQuantScoresResponse = z.infer<
  typeof TgmHistoricalTokenQuantScoresResponse
>;

// ===========================================================================
// POST /api/v1beta1/profiler/address/historical-token-balances
// (docs/raw/hist-address-balance.md). Credit cost: 5.
// ===========================================================================

export const HistoricalProfilerTokenBalancesChain = z.enum(CHAIN_ENUMS.histProfilerTokenBalances);
export type HistoricalProfilerTokenBalancesChain = z.infer<
  typeof HistoricalProfilerTokenBalancesChain
>;

export const ProfilerHistoricalTokenBalancesRequest = z.object({
  /** Required. EVM hex or Solana base58. */
  address: z.string(),
  /** Required. Balances are computed up to this date. */
  as_of_date: z.string(),
  /** Required. */
  chain: HistoricalProfilerTokenBalancesChain,
  /** Default true. */
  apply_blacklist_filter: z.boolean().optional().default(true),
  pagination: PaginationRequest.optional(),
});
export type ProfilerHistoricalTokenBalancesRequest = z.infer<
  typeof ProfilerHistoricalTokenBalancesRequest
>;

export const ProfilerHistoricalTokenBalancesItem = z.object({
  chain: z.string(),
  token_address: z.string(),
  token_symbol: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  /** Adjusted for decimals. */
  token_amount: z.number().nullable().optional(),
  /** Price in USD at as_of_date. */
  price_usd: z.number().nullable().optional(),
  /** token_amount * price_usd. */
  value_usd: z.number().nullable().optional(),
});
export type ProfilerHistoricalTokenBalancesItem = z.infer<
  typeof ProfilerHistoricalTokenBalancesItem
>;

export const ProfilerHistoricalTokenBalancesResponse = z.object({
  pagination: PaginationInfo,
  /** Ordered by value_usd DESC. */
  data: z.array(ProfilerHistoricalTokenBalancesItem),
});
export type ProfilerHistoricalTokenBalancesResponse = z.infer<
  typeof ProfilerHistoricalTokenBalancesResponse
>;
