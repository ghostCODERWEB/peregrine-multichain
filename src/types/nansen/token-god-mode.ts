import { z } from "zod";
import {
  PaginationRequest,
  PaginationInfo,
  SortDirection,
  NumericRangeFilter,
  IntegerRangeFilter,
  DateRange,
  DateRangeFilter,
  SmartMoneyFilterType,
  LabelType,
} from "./common";
import { CHAIN_ENUMS } from "./chain-enums";

/**
 * Token God Mode (TGM) family. 12 endpoints, sources:
 *  - docs/raw/tgm-screener.md         -> POST /api/v1/token-screener
 *  - docs/raw/tgm-perp-screener.md    -> POST /api/v1/perp-screener
 *  - docs/raw/tgm-flow-intelligence.md -> POST /api/v1/tgm/flow-intelligence
 *  - docs/raw/tgm-holders.md          -> POST /api/v1/tgm/holders
 *  - docs/raw/tgm-dex-trades.md       -> POST /api/v1/tgm/dex-trades
 *  - docs/raw/tgm-flows.md            -> POST /api/v1/tgm/flows
 *  - docs/raw/tgm-indicators.md       -> POST /api/v1/tgm/indicators
 *  - docs/raw/tgm-ohlcv.md            -> POST /api/v1/tgm/token-ohlcv
 *  - docs/raw/tgm-perp-positions.md   -> POST /api/v1/tgm/perp-positions
 *  - docs/raw/tgm-pnl-leaderboard.md  -> POST /api/v1/tgm/pnl-leaderboard
 *  - docs/raw/tgm-token-information.md -> POST /api/v1/tgm/token-information
 *  - docs/raw/tgm-who-bought-sold.md  -> POST /api/v1/tgm/who-bought-sold
 */

// ===========================================================================
// POST /api/v1/token-screener  (docs/raw/tgm-screener.md)
// Credit cost: 1. Live/point-in-time; `timeframe` recommended over deprecated `date`.
// ===========================================================================

export const TokenScreenerChain = z.enum(CHAIN_ENUMS.tokenScreener);
export type TokenScreenerChain = z.infer<typeof TokenScreenerChain>;

export const TokenScreenerTimeframe = z.enum([
  "5m",
  "10m",
  "1h",
  "6h",
  "24h",
  "7d",
  "30d",
]);
export type TokenScreenerTimeframe = z.infer<typeof TokenScreenerTimeframe>;

export const TraderType = z.enum([
  "all",
  "sm",
  "whale",
  "public_figure",
  "trending",
  "consistent_perps_winner",
  "high_winrate_hl_perps_trader",
  "predicted_winner",
]);
export type TraderType = z.infer<typeof TraderType>;

export const TokenScreenerFilters = z.object({
  token_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_symbol: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  /** @deprecated Use `trader_type` instead. */
  only_smart_money: z.boolean().optional(),
  /** Overrides `only_smart_money` when provided. */
  trader_type: TraderType.optional(),
  /** Bare sector names (e.g. "DeFi", "Gaming") — differs from perp screener's category:subcategory form. */
  sectors: z.array(z.string()).optional(),
  exclude_sectors: z.array(z.string()).optional(),
  token_age_days: NumericRangeFilter.optional(),
  market_cap_usd: NumericRangeFilter.optional(),
  liquidity: NumericRangeFilter.optional(),
  price_usd: NumericRangeFilter.optional(),
  price_change: NumericRangeFilter.optional(),
  fdv: NumericRangeFilter.optional(),
  fdv_mc_ratio: NumericRangeFilter.optional(),
  nof_buyers: IntegerRangeFilter.optional(),
  nof_traders: IntegerRangeFilter.optional(),
  nof_sellers: IntegerRangeFilter.optional(),
  nof_buys: IntegerRangeFilter.optional(),
  nof_sells: IntegerRangeFilter.optional(),
  buy_volume: NumericRangeFilter.optional(),
  sell_volume: NumericRangeFilter.optional(),
  volume: NumericRangeFilter.optional(),
  netflow: NumericRangeFilter.optional(),
  inflow_fdv_ratio: NumericRangeFilter.optional(),
  outflow_fdv_ratio: NumericRangeFilter.optional(),
  /** Default true — includes stablecoins unless explicitly disabled. */
  include_stablecoins: z.boolean().optional().default(true),
  /** Default false. */
  include_native_tokens: z.boolean().optional().default(false),
  include_smart_money_labels: z.array(SmartMoneyFilterType).optional(),
  exclude_smart_money_labels: z.array(SmartMoneyFilterType).optional(),
});
export type TokenScreenerFilters = z.infer<typeof TokenScreenerFilters>;

export const TokenScreenerSortField = z.enum([
  "chain",
  "token_address",
  "token_symbol",
  "market_cap_usd",
  "volume",
  "liquidity",
  "nof_traders",
  "nof_buyers",
  "nof_sellers",
  "nof_buys",
  "nof_sells",
  "price_change",
  "price_usd",
  "netflow",
  "buy_volume",
  "sell_volume",
  "fdv",
  "fdv_mc_ratio",
  "inflow_fdv_ratio",
  "outflow_fdv_ratio",
  "token_age_days",
]);
export type TokenScreenerSortField = z.infer<typeof TokenScreenerSortField>;

export const TokenScreenerSortOrder = z.object({
  field: TokenScreenerSortField,
  direction: SortDirection,
});
export type TokenScreenerSortOrder = z.infer<typeof TokenScreenerSortOrder>;

export const TokenScreenerRequest = z.object({
  /** Required. 1-5 chains. */
  chains: z.array(TokenScreenerChain).min(1).max(5),
  /**
   * Recommended (required unless deprecated `date` is used instead).
   * Mutually exclusive with `date`.
   */
  timeframe: TokenScreenerTimeframe.optional(),
  /** @deprecated Use `timeframe` instead. Mutually exclusive with `timeframe`. */
  date: DateRange.optional(),
  pagination: PaginationRequest.optional(),
  filters: TokenScreenerFilters.optional(),
  order_by: z.array(TokenScreenerSortOrder).optional(),
});
export type TokenScreenerRequest = z.infer<typeof TokenScreenerRequest>;

/**
 * Response shape varies by query (default / smart-money-default / non-default)
 * per the docs' 3-way `anyOf`. Modeled here as one permissive shape covering
 * the union of all fields; not every field is present on every row.
 * TODO: verify against live response — docs unclear on exactly which fields
 * are omitted (vs. present-and-null) for each of the three response variants.
 */
export const TokenScreenerItem = z.object({
  chain: z.string(),
  token_address: z.string(),
  token_symbol: z.string(),
  token_age_days: z.number().nullable().optional(),
  token_age_hours: z.number().nullable().optional(),
  token_deployment_date: z.string().nullable().optional(),
  market_cap_usd: z.number().nullable().optional(),
  liquidity: z.number().nullable().optional(),
  price_usd: z.number().nullable().optional(),
  price_change: z.number().nullable().optional(),
  fdv: z.number().nullable().optional(),
  fdv_mc_ratio: z.number().nullable().optional(),
  nof_buyers: z.number().int().nullable().optional(),
  nof_traders: z.number().int().nullable().optional(),
  nof_sellers: z.number().int().nullable().optional(),
  nof_buys: z.number().int().nullable().optional(),
  nof_sells: z.number().int().nullable().optional(),
  buy_volume: z.number().nullable().optional(),
  inflow_fdv_ratio: z.number().nullable().optional(),
  outflow_fdv_ratio: z.number().nullable().optional(),
  sell_volume: z.number().nullable().optional(),
  volume: z.number().nullable().optional(),
  netflow: z.number().nullable().optional(),
});
export type TokenScreenerItem = z.infer<typeof TokenScreenerItem>;

export const TokenScreenerResponse = z.object({
  data: z.array(TokenScreenerItem),
  pagination: PaginationInfo,
});
export type TokenScreenerResponse = z.infer<typeof TokenScreenerResponse>;

// ===========================================================================
// POST /api/v1/perp-screener  (docs/raw/tgm-perp-screener.md)
// Credit cost: 1. Hyperliquid dataset only — no `chain`/`chains` field.
// ===========================================================================

export const PerpTraderType = z.enum([
  "all",
  "sm",
  "whale",
  "public_figure",
  "high_winrate_hl_perps_trader",
]);
export type PerpTraderType = z.infer<typeof PerpTraderType>;

export const PerpScreenerFilters = z.object({
  /** Overrides `only_smart_money` when provided. */
  trader_type: PerpTraderType.optional(),
  /** @deprecated Use `trader_type=sm` instead. */
  only_smart_money: z.boolean().optional().default(false),
  /** category:subcategory form (e.g. "Crypto:DeFi") — differs from token screener's bare sector names. */
  sectors_filter: z.array(z.string()).optional(),
  /** Only applies when trader_type is all/sm. */
  sm_label_filter: z.array(z.string()).optional(),
  /** Hyperliquid perps trader label, e.g. "HL Perps Whale". Only applies when trader_type is all/sm. */
  trader_label_filter: z.array(z.string()).optional(),
  token_symbol: z.string().optional(),
  volume: NumericRangeFilter.optional(),
  buy_volume: NumericRangeFilter.optional(),
  sell_volume: NumericRangeFilter.optional(),
  buy_sell_pressure: NumericRangeFilter.optional(),
  trader_count: IntegerRangeFilter.optional(),
  mark_price: NumericRangeFilter.optional(),
  funding: NumericRangeFilter.optional(),
  previous_price_usd: NumericRangeFilter.optional(),
  open_interest: NumericRangeFilter.optional(),
  smart_money_volume: NumericRangeFilter.optional(),
  smart_money_buy_volume: NumericRangeFilter.optional(),
  smart_money_sell_volume: NumericRangeFilter.optional(),
  net_position_change: NumericRangeFilter.optional(),
  current_smart_money_position_longs_usd: NumericRangeFilter.optional(),
  current_smart_money_position_shorts_usd: NumericRangeFilter.optional(),
  smart_money_longs_count: IntegerRangeFilter.optional(),
  smart_money_shorts_count: IntegerRangeFilter.optional(),
});
export type PerpScreenerFilters = z.infer<typeof PerpScreenerFilters>;

/**
 * Available sort fields depend on `trader_type`: `buy_sell_pressure` only
 * applies to `all`, `net_position_change` to the other trader types. Modeled
 * here as the union of all three documented sort-field enums; validating
 * that a given field matches the selected trader_type is left to the caller.
 */
export const PerpScreenerSortField = z.enum([
  "token_symbol",
  "volume",
  "buy_volume",
  "sell_volume",
  "buy_sell_pressure",
  "trader_count",
  "mark_price",
  "funding",
  "previous_price_usd",
  "open_interest",
  "smart_money_volume",
  "smart_money_buy_volume",
  "smart_money_sell_volume",
  "net_position_change",
  "current_smart_money_position_longs_usd",
  "current_smart_money_position_shorts_usd",
  "smart_money_longs_count",
  "smart_money_shorts_count",
  "current_position_longs_usd",
  "current_position_shorts_usd",
  "longs_count",
  "shorts_count",
]);
export type PerpScreenerSortField = z.infer<typeof PerpScreenerSortField>;

export const PerpScreenerSortOrder = z.object({
  field: PerpScreenerSortField,
  direction: SortDirection,
});
export type PerpScreenerSortOrder = z.infer<typeof PerpScreenerSortOrder>;

export const PerpScreenerRequest = z.object({
  /** Required. */
  date: DateRange,
  pagination: PaginationRequest.optional(),
  filters: PerpScreenerFilters.optional(),
  order_by: z.array(PerpScreenerSortOrder).optional(),
});
export type PerpScreenerRequest = z.infer<typeof PerpScreenerRequest>;

/**
 * Response row shape varies by trader_type (default / smart-money /
 * notable-label), per the docs' 3-way `anyOf`. Modeled as one permissive
 * union of all fields; only `token_symbol` is required on every variant.
 */
export const PerpScreenerItem = z.object({
  token_symbol: z.string(),
  volume: z.number().nullable().optional(),
  buy_volume: z.number().nullable().optional(),
  sell_volume: z.number().nullable().optional(),
  buy_sell_pressure: z.number().nullable().optional(),
  trader_count: z.number().int().nullable().optional(),
  mark_price: z.number().nullable().optional(),
  funding: z.number().nullable().optional(),
  open_interest: z.number().nullable().optional(),
  previous_price_usd: z.number().nullable().optional(),
  smart_money_volume: z.number().nullable().optional(),
  smart_money_buy_volume: z.number().nullable().optional(),
  smart_money_sell_volume: z.number().nullable().optional(),
  net_position_change: z.number().nullable().optional(),
  current_smart_money_position_longs_usd: z.number().nullable().optional(),
  current_smart_money_position_shorts_usd: z.number().nullable().optional(),
  smart_money_longs_count: z.number().int().nullable().optional(),
  smart_money_shorts_count: z.number().int().nullable().optional(),
  current_position_longs_usd: z.number().nullable().optional(),
  current_position_shorts_usd: z.number().nullable().optional(),
  longs_count: z.number().int().nullable().optional(),
  shorts_count: z.number().int().nullable().optional(),
});
export type PerpScreenerItem = z.infer<typeof PerpScreenerItem>;

export const PerpScreenerResponse = z.object({
  data: z.array(PerpScreenerItem),
  pagination: PaginationInfo,
});
export type PerpScreenerResponse = z.infer<typeof PerpScreenerResponse>;

// ===========================================================================
// POST /api/v1/tgm/flow-intelligence  (docs/raw/tgm-flow-intelligence.md)
// Credit cost: 1.
// ===========================================================================

export const TGMFlowIntelligenceChain = z.enum(CHAIN_ENUMS.tgmFlowIntelligence);
export type TGMFlowIntelligenceChain = z.infer<typeof TGMFlowIntelligenceChain>;

export const TGMFlowIntelligenceTimeframe = z.enum([
  "5m",
  "1h",
  "6h",
  "12h",
  "1d",
  "7d",
]);
export type TGMFlowIntelligenceTimeframe = z.infer<typeof TGMFlowIntelligenceTimeframe>;

export const TGMFlowIntelligenceFilters = z.object({
  public_figure_net_flow_usd: NumericRangeFilter.optional(),
  public_figure_avg_flow_usd: NumericRangeFilter.optional(),
  public_figure_wallet_count: IntegerRangeFilter.optional(),
  top_pnl_net_flow_usd: NumericRangeFilter.optional(),
  top_pnl_avg_flow_usd: NumericRangeFilter.optional(),
  top_pnl_wallet_count: IntegerRangeFilter.optional(),
  whale_net_flow_usd: NumericRangeFilter.optional(),
  whale_avg_flow_usd: NumericRangeFilter.optional(),
  whale_wallet_count: IntegerRangeFilter.optional(),
  smart_trader_net_flow_usd: NumericRangeFilter.optional(),
  smart_trader_avg_flow_usd: NumericRangeFilter.optional(),
  smart_trader_wallet_count: IntegerRangeFilter.optional(),
  exchange_net_flow_usd: NumericRangeFilter.optional(),
  exchange_avg_flow_usd: NumericRangeFilter.optional(),
  exchange_wallet_count: IntegerRangeFilter.optional(),
  fresh_wallets_net_flow_usd: NumericRangeFilter.optional(),
  fresh_wallets_avg_flow_usd: NumericRangeFilter.optional(),
  fresh_wallets_wallet_count: IntegerRangeFilter.optional(),
});
export type TGMFlowIntelligenceFilters = z.infer<typeof TGMFlowIntelligenceFilters>;

export const TGMFlowIntelligenceRequest = z.object({
  chain: TGMFlowIntelligenceChain,
  token_address: z.string(),
  timeframe: TGMFlowIntelligenceTimeframe.optional().default("1d"),
  filters: TGMFlowIntelligenceFilters.optional(),
});
export type TGMFlowIntelligenceRequest = z.infer<typeof TGMFlowIntelligenceRequest>;

export const TGMFlowIntelligenceItem = z.object({
  public_figure_net_flow_usd: z.number().nullable().optional(),
  public_figure_avg_flow_usd: z.number().nullable().optional(),
  public_figure_wallet_count: z.number().int().nullable().optional(),
  top_pnl_net_flow_usd: z.number().nullable().optional(),
  top_pnl_avg_flow_usd: z.number().nullable().optional(),
  top_pnl_wallet_count: z.number().int().nullable().optional(),
  whale_net_flow_usd: z.number().nullable().optional(),
  whale_avg_flow_usd: z.number().nullable().optional(),
  whale_wallet_count: z.number().int().nullable().optional(),
  smart_trader_net_flow_usd: z.number().nullable().optional(),
  smart_trader_avg_flow_usd: z.number().nullable().optional(),
  smart_trader_wallet_count: z.number().int().nullable().optional(),
  exchange_net_flow_usd: z.number().nullable().optional(),
  exchange_avg_flow_usd: z.number().nullable().optional(),
  /** Always 0 — exchange wallet count is not tracked, even when exchange net flow is non-zero. */
  exchange_wallet_count: z.number().int().nullable().optional(),
  /** Only available for 1d and 7d timeframes. */
  fresh_wallets_net_flow_usd: z.number().nullable().optional(),
  fresh_wallets_avg_flow_usd: z.number().nullable().optional(),
  /** Always 0 for 1d/7d (null for shorter timeframes) — not tracked separately. */
  fresh_wallets_wallet_count: z.number().int().nullable().optional(),
});
export type TGMFlowIntelligenceItem = z.infer<typeof TGMFlowIntelligenceItem>;

export const TGMFlowIntelligenceResponse = z.object({
  data: z.array(TGMFlowIntelligenceItem),
  /** e.g. present when fresh_wallets fields are null due to timeframe constraints. */
  warnings: z.array(z.string()).optional(),
});
export type TGMFlowIntelligenceResponse = z.infer<typeof TGMFlowIntelligenceResponse>;

// ===========================================================================
// POST /api/v1/tgm/holders  (docs/raw/tgm-holders.md)
// Credit cost: 5 (150 if premium_labels=true — requires a paid plan).
// ===========================================================================

export const TGMHoldersChain = z.enum(CHAIN_ENUMS.tgmHolders);
export type TGMHoldersChain = z.infer<typeof TGMHoldersChain>;

export const TGMHoldersLabel = z.enum([
  "whale",
  "public_figure",
  "smart_money",
  "all_holders",
  "exchange",
]);
export type TGMHoldersLabel = z.infer<typeof TGMHoldersLabel>;

export const TGMHoldersFilters = z.object({
  include_smart_money_labels: z.array(LabelType).optional(),
  exclude_smart_money_labels: z.array(LabelType).optional(),
  address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  address_label: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_amount: NumericRangeFilter.optional(),
  total_outflow: NumericRangeFilter.optional(),
  total_inflow: NumericRangeFilter.optional(),
  balance_change_24h: NumericRangeFilter.optional(),
  balance_change_7d: NumericRangeFilter.optional(),
  balance_change_30d: NumericRangeFilter.optional(),
  ownership_percentage: NumericRangeFilter.optional(),
  /**
   * Defaults to {min: 1.0} server-side to exclude dust holders (does not
   * apply to native tokens with label_type "all_holders"). Pass {min: 0}
   * explicitly to include all holders.
   */
  value_usd: NumericRangeFilter.optional(),
});
export type TGMHoldersFilters = z.infer<typeof TGMHoldersFilters>;

export const TGMHoldersSortField = z.enum([
  "address",
  "name",
  "token_amount",
  "total_outflow",
  "total_inflow",
  "balance_change_24h",
  "balance_change_7d",
  "balance_change_30d",
  "ownership_percentage",
  "value_usd",
]);
export type TGMHoldersSortField = z.infer<typeof TGMHoldersSortField>;

export const TGMHoldersSortOrder = z.object({
  field: TGMHoldersSortField,
  direction: SortDirection,
});
export type TGMHoldersSortOrder = z.infer<typeof TGMHoldersSortOrder>;

export const TGMHoldersRequest = z.object({
  chain: TGMHoldersChain,
  token_address: z.string(),
  aggregate_by_entity: z.boolean().optional().default(false),
  /**
   * When set to anything other than "all_holders", `filters.include_smart_money_labels`
   * (etc.) must include the matching label set — see docs/raw/tgm-holders.md.
   * For native tokens with label_type "all_holders" the endpoint uses an
   * optimized model: only `token_amount` is sortable and filters are limited
   * to token_amount/total_outflow/total_inflow/address/include_smart_money_labels/
   * exclude_smart_money_labels.
   */
  label_type: TGMHoldersLabel.optional().default("all_holders"),
  pagination: PaginationRequest.optional(),
  filters: TGMHoldersFilters.optional(),
  /**
   * Controls label tier. Omitted/false (default): free-tier labels at
   * standard credit cost. true: premium labels (Smart Money, Fund, etc.),
   * billed at 150 credits/call, requires a paid plan.
   */
  premium_labels: z.boolean().nullable().optional(),
  order_by: z.array(TGMHoldersSortOrder).optional(),
});
export type TGMHoldersRequest = z.infer<typeof TGMHoldersRequest>;

export const TGMHolder = z.object({
  address: z.string().nullable().optional(),
  address_label: z.string().nullable().optional(),
  token_amount: z.number().nullable().optional(),
  total_outflow: z.number().nullable().optional(),
  total_inflow: z.number().nullable().optional(),
  balance_change_24h: z.number().nullable().optional(),
  balance_change_7d: z.number().nullable().optional(),
  balance_change_30d: z.number().nullable().optional(),
  ownership_percentage: z.number().nullable().optional(),
  value_usd: z.number().nullable().optional(),
});
export type TGMHolder = z.infer<typeof TGMHolder>;

export const TGMHoldersResponse = z.object({
  data: z.array(TGMHolder),
  pagination: PaginationInfo,
  /** e.g. warns that the default value_usd filter may be excluding results when a token has no USD price data. */
  warnings: z.array(z.string()).optional(),
});
export type TGMHoldersResponse = z.infer<typeof TGMHoldersResponse>;

// ===========================================================================
// POST /api/v1/tgm/dex-trades  (docs/raw/tgm-dex-trades.md)
// Credit cost: 1.
// ===========================================================================

export const TGMDexTradesChain = z.enum(CHAIN_ENUMS.tgmDexTrades);
export type TGMDexTradesChain = z.infer<typeof TGMDexTradesChain>;

export const TGMWhoBoughtSoldType = z.enum(["BUY", "SELL"]);
export type TGMWhoBoughtSoldType = z.infer<typeof TGMWhoBoughtSoldType>;

export const TGMDexTradesFilters = z.object({
  include_smart_money_labels: z.array(LabelType).optional(),
  exclude_smart_money_labels: z.array(LabelType).optional(),
  block_timestamp: DateRangeFilter.optional(),
  transaction_hash: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  trader_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  trader_address_label: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  action: TGMWhoBoughtSoldType.optional(),
  token_name: z.string().optional(),
  token_amount: NumericRangeFilter.optional(),
  traded_token_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  traded_token_name: z.string().optional(),
  traded_token_amount: NumericRangeFilter.optional(),
  estimated_swap_price_usd: NumericRangeFilter.optional(),
  estimated_value_usd: NumericRangeFilter.optional(),
});
export type TGMDexTradesFilters = z.infer<typeof TGMDexTradesFilters>;

export const TGMDexTradesSortField = z.enum([
  "block_timestamp",
  "transaction_hash",
  "trader_address",
  "trader_address_label",
  "token_address",
  "action",
  "token_name",
  "token_amount",
  "traded_token_address",
  "traded_token_name",
  "traded_token_amount",
  "estimated_swap_price_usd",
  "estimated_value_usd",
]);
export type TGMDexTradesSortField = z.infer<typeof TGMDexTradesSortField>;

export const TGMDexTradesSortOrder = z.object({
  field: TGMDexTradesSortField,
  direction: SortDirection,
});
export type TGMDexTradesSortOrder = z.infer<typeof TGMDexTradesSortOrder>;

export const TGMDexTradesRequest = z.object({
  chain: TGMDexTradesChain,
  token_address: z.string(),
  only_smart_money: z.boolean().optional().default(false),
  /** Required. ISO 8601 date-time range object with optional from/to fields. */
  date: DateRange,
  pagination: PaginationRequest.optional(),
  filters: TGMDexTradesFilters.optional(),
  order_by: z.array(TGMDexTradesSortOrder).optional(),
});
export type TGMDexTradesRequest = z.infer<typeof TGMDexTradesRequest>;

export const TGMDexTrade = z.object({
  block_timestamp: z.string(),
  transaction_hash: z.string(),
  trader_address: z.string(),
  trader_address_label: z.string().nullable().optional(),
  action: TGMWhoBoughtSoldType,
  token_address: z.string(),
  token_name: z.string(),
  token_amount: z.number().nullable().optional(),
  traded_token_address: z.string(),
  traded_token_name: z.string(),
  traded_token_amount: z.number().nullable().optional(),
  /** Falls back to the daily median token price if the counterpart price is unavailable. */
  estimated_swap_price_usd: z.number().nullable().optional(),
  estimated_value_usd: z.number().nullable().optional(),
});
export type TGMDexTrade = z.infer<typeof TGMDexTrade>;

export const TGMDexTradesResponse = z.object({
  data: z.array(TGMDexTrade),
  pagination: PaginationInfo,
});
export type TGMDexTradesResponse = z.infer<typeof TGMDexTradesResponse>;

// ===========================================================================
// POST /api/v1/tgm/flows  (docs/raw/tgm-flows.md)
// Credit cost: 1.
// ===========================================================================

export const TGMFlowsChain = z.enum(CHAIN_ENUMS.tgmFlows);
export type TGMFlowsChain = z.infer<typeof TGMFlowsChain>;

export const TGMFlowsLabel = z.enum([
  "whale",
  "public_figure",
  "smart_money",
  "top_100_holders",
  "exchange",
]);
export type TGMFlowsLabel = z.infer<typeof TGMFlowsLabel>;

export const TGMFlowsFilters = z.object({
  price_usd: NumericRangeFilter.optional(),
  token_amount: NumericRangeFilter.optional(),
  value_usd: NumericRangeFilter.optional(),
  holders_count: IntegerRangeFilter.optional(),
  total_inflows_count: IntegerRangeFilter.optional(),
  total_outflows_count: IntegerRangeFilter.optional(),
});
export type TGMFlowsFilters = z.infer<typeof TGMFlowsFilters>;

export const TGMFlowsSortField = z.enum([
  "date",
  "price_usd",
  "token_amount",
  "value_usd",
  "holders_count",
  "total_inflows_count",
  "total_outflows_count",
  "total_inflows_dex",
  "total_outflows_dex",
  "total_inflows_cex",
  "total_outflows_cex",
]);
export type TGMFlowsSortField = z.infer<typeof TGMFlowsSortField>;

export const TGMFlowsSortOrder = z.object({
  field: TGMFlowsSortField,
  direction: SortDirection,
});
export type TGMFlowsSortOrder = z.infer<typeof TGMFlowsSortOrder>;

export const TGMFlowsRequest = z.object({
  chain: TGMFlowsChain,
  token_address: z.string(),
  /** Required. */
  date: DateRange,
  label: TGMFlowsLabel.optional().default("top_100_holders"),
  pagination: PaginationRequest.optional(),
  filters: TGMFlowsFilters.optional(),
  order_by: z.array(TGMFlowsSortOrder).optional(),
});
export type TGMFlowsRequest = z.infer<typeof TGMFlowsRequest>;

export const TGMFlowsItem = z.object({
  /** Inclusive bucket start, RFC 3339 UTC timestamp. */
  date: z.string(),
  /** Exclusive bucket end, RFC 3339 UTC timestamp. */
  bucket_end: z.string().nullable().optional(),
  /** Describes request-window coverage, not whether the data is final. */
  is_complete: z.boolean().nullable().optional(),
  price_usd: z.number().nullable().optional(),
  token_amount: z.number().nullable().optional(),
  value_usd: z.number().nullable().optional(),
  holders_count: z.number().int().nullable().optional(),
  total_inflows_count: z.number().nullable().optional(),
  total_outflows_count: z.number().nullable().optional(),
  /** Only populated when label="exchange"; null otherwise. */
  total_inflows_dex: z.number().nullable().optional(),
  total_outflows_dex: z.number().nullable().optional(),
  total_inflows_cex: z.number().nullable().optional(),
  total_outflows_cex: z.number().nullable().optional(),
});
export type TGMFlowsItem = z.infer<typeof TGMFlowsItem>;

export const TGMFlowsResponse = z.object({
  data: z.array(TGMFlowsItem),
  pagination: PaginationInfo,
  warnings: z.array(z.string()).optional(),
});
export type TGMFlowsResponse = z.infer<typeof TGMFlowsResponse>;

// ===========================================================================
// POST /api/v1/tgm/indicators  (docs/raw/tgm-indicators.md)
// Credit cost: 5.
// ===========================================================================

export const TGMChain = z.enum(CHAIN_ENUMS.tgmIndicators);
export type TGMChain = z.infer<typeof TGMChain>;

export const TGMIndicatorsRequest = z.object({
  chain: TGMChain,
  token_address: z.string(),
});
export type TGMIndicatorsRequest = z.infer<typeof TGMIndicatorsRequest>;

export const TGMIndicatorTokenInfo = z.object({
  market_cap_usd: z.number().nullable().optional(),
  market_cap_group: z.string().nullable().optional(),
  is_stablecoin: z.boolean().nullable().optional(),
});
export type TGMIndicatorTokenInfo = z.infer<typeof TGMIndicatorTokenInfo>;

export const TGMIndicator = z.object({
  indicator_type: z.string(),
  /** risk: low/medium/high; reward: bearish/neutral/bullish. Docs don't give a closed enum — kept as string. */
  score: z.string().nullable().optional(),
  signal: z.number().nullable().optional(),
  signal_percentile: z.number().nullable().optional(),
  /** YYYY-MM-DD. */
  last_trigger_on: z.string().nullable().optional(),
});
export type TGMIndicator = z.infer<typeof TGMIndicator>;

export const TGMIndicatorsResponse = z.object({
  token_address: z.string(),
  chain: z.string(),
  token_info: TGMIndicatorTokenInfo,
  /** btc-reflexivity, liquidity-risk, concentration-risk, token-supply-inflation. */
  risk_indicators: z.array(TGMIndicator),
  /** chain-tvl, trading-range, price-momentum, chain-fees, protocol-fees, cex-flows, funding-rate. */
  reward_indicators: z.array(TGMIndicator),
});
export type TGMIndicatorsResponse = z.infer<typeof TGMIndicatorsResponse>;

// ===========================================================================
// POST /api/v1/tgm/token-ohlcv  (docs/raw/tgm-ohlcv.md)
// Credit cost: 1.
// ===========================================================================

export const TGMOHLCVChain = z.enum(CHAIN_ENUMS.tgmTokenOhlcv);
export type TGMOHLCVChain = z.infer<typeof TGMOHLCVChain>;

export const ResolutionEnum = z.enum([
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
export type ResolutionEnum = z.infer<typeof ResolutionEnum>;

/** @deprecated Use `date` (DateRange) instead. */
export const TokenOHLCVDateRangeDeprecated = z.object({
  start: z.string(),
  end: z.string(),
});
export type TokenOHLCVDateRangeDeprecated = z.infer<typeof TokenOHLCVDateRangeDeprecated>;

export const TokenOHLCVRequest = z.object({
  chain: TGMOHLCVChain,
  /** Mutually exclusive with token_addresses. */
  token_address: z.string().optional(),
  /** Batch mode: max 10 (max 5 for Hyperliquid). Mutually exclusive with token_address. */
  token_addresses: z.array(z.string()).max(10).optional(),
  /** @deprecated Use `date` instead. */
  date_range: TokenOHLCVDateRangeDeprecated.optional(),
  /** Defaults to last 30 days if not specified. */
  date: DateRange.optional(),
  timeframe: ResolutionEnum,
});
export type TokenOHLCVRequest = z.infer<typeof TokenOHLCVRequest>;

export const MarketCapData = z.object({
  open: z.number().nullable().optional(),
  high: z.number().nullable().optional(),
  low: z.number().nullable().optional(),
  close: z.number().nullable().optional(),
});
export type MarketCapData = z.infer<typeof MarketCapData>;

export const OHLCVCandle = z.object({
  interval_start: z.string(),
  open: z.number().nullable().optional(),
  high: z.number().nullable().optional(),
  low: z.number().nullable().optional(),
  close: z.number().nullable().optional(),
  volume: z.number().nullable().optional(),
  volume_usd: z.number().nullable().optional(),
  market_cap: MarketCapData,
});
export type OHLCVCandle = z.infer<typeof OHLCVCandle>;

/** Single-token response shape (when `token_address` is used). */
export const TokenOHLCVResponse = z.object({
  chain: z.string(),
  token_address: z.string(),
  timeframe: z.string(),
  data: z.array(OHLCVCandle),
  truncated: z.boolean().optional().default(false),
  truncation_note: z.string().nullable().optional(),
});
export type TokenOHLCVResponse = z.infer<typeof TokenOHLCVResponse>;

export const TokenOHLCVTokenData = z.object({
  token_address: z.string(),
  data: z.array(OHLCVCandle),
});
export type TokenOHLCVTokenData = z.infer<typeof TokenOHLCVTokenData>;

/** Batch response shape (when `token_addresses` is used). */
export const TokenOHLCVBatchResponse = z.object({
  chain: z.string(),
  timeframe: z.string(),
  /** Tokens with no data for the requested window are omitted, not returned as empty rows. */
  tokens: z.array(TokenOHLCVTokenData),
  truncated: z.boolean().optional().default(false),
  truncation_note: z.string().nullable().optional(),
});
export type TokenOHLCVBatchResponse = z.infer<typeof TokenOHLCVBatchResponse>;

/** The endpoint returns one of these two shapes depending on single vs. batch request. */
export const TokenOHLCVEndpointResponse = z.union([
  TokenOHLCVResponse,
  TokenOHLCVBatchResponse,
]);
export type TokenOHLCVEndpointResponse = z.infer<typeof TokenOHLCVEndpointResponse>;

// ===========================================================================
// POST /api/v1/tgm/perp-positions  (docs/raw/tgm-perp-positions.md)
// Credit cost: 5. Hyperliquid only — no `chain` field.
// ===========================================================================

export const TGMPerpPositionsLabel = z.enum([
  "smart_money",
  "all_traders",
  "whale",
  "public_figure",
]);
export type TGMPerpPositionsLabel = z.infer<typeof TGMPerpPositionsLabel>;

export const PositionSide = z.enum(["Long", "Short"]);
export type PositionSide = z.infer<typeof PositionSide>;

export const TGMPerpPositionsFilters = z.object({
  include_smart_money_labels: z.array(LabelType).optional(),
  exclude_smart_money_labels: z.array(LabelType).optional(),
  address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  address_label: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  side: z
    .union([PositionSide, z.array(PositionSide)])
    .nullable()
    .optional(),
  position_value_usd: NumericRangeFilter.optional(),
  position_size: NumericRangeFilter.optional(),
  entry_price: NumericRangeFilter.optional(),
  upnl_usd: NumericRangeFilter.optional(),
  funding_usd: NumericRangeFilter.optional(),
});
export type TGMPerpPositionsFilters = z.infer<typeof TGMPerpPositionsFilters>;

export const TGMPerpPositionsSortField = z.enum([
  "address",
  "address_label",
  "side",
  "position_value_usd",
  "position_size",
  "size_base",
  "leverage",
  "entry_price",
  "mark_price",
  "liquidation_price",
  "funding_usd",
  "upnl_usd",
]);
export type TGMPerpPositionsSortField = z.infer<typeof TGMPerpPositionsSortField>;

export const TGMPerpPositionsSortOrder = z.object({
  field: TGMPerpPositionsSortField,
  direction: SortDirection,
});
export type TGMPerpPositionsSortOrder = z.infer<typeof TGMPerpPositionsSortOrder>;

export const TGMPerpPositionsRequest = z.object({
  token_symbol: z.string(),
  label_type: TGMPerpPositionsLabel.optional().default("all_traders"),
  pagination: PaginationRequest.optional(),
  filters: TGMPerpPositionsFilters.optional(),
  /**
   * `position_size` is signed (short = negative), so sorting on it ranks
   * every long above every short. `size_base` sorts both sides by magnitude.
   */
  order_by: z.array(TGMPerpPositionsSortOrder).optional(),
});
export type TGMPerpPositionsRequest = z.infer<typeof TGMPerpPositionsRequest>;

export const TGMPerpPosition = z.object({
  address: z.string().nullable().optional(),
  address_label: z.string().nullable().optional(),
  side: PositionSide.nullable().optional(),
  position_value_usd: z.number().nullable().optional(),
  position_size: z.number().nullable().optional(),
  leverage: z.string(),
  leverage_type: z.string().nullable().optional(),
  entry_price: z.number().nullable().optional(),
  mark_price: z.number().nullable().optional(),
  liquidation_price: z.number().nullable().optional(),
  funding_usd: z.number().nullable().optional(),
  upnl_usd: z.number().nullable().optional(),
});
export type TGMPerpPosition = z.infer<typeof TGMPerpPosition>;

export const TGMPerpPositionsResponse = z.object({
  data: z.array(TGMPerpPosition),
  pagination: PaginationInfo,
});
export type TGMPerpPositionsResponse = z.infer<typeof TGMPerpPositionsResponse>;

// ===========================================================================
// POST /api/v1/tgm/pnl-leaderboard  (docs/raw/tgm-pnl-leaderboard.md)
// Credit cost: 5 (150 if premium_labels=true — requires a paid plan).
// ===========================================================================

export const TGMPnLLeaderboardChain = z.enum(CHAIN_ENUMS.tgmPnlLeaderboard);
export type TGMPnLLeaderboardChain = z.infer<typeof TGMPnLLeaderboardChain>;

export const TGMPnlLeaderboardFilters = z.object({
  trader_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  trader_address_label: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_price: NumericRangeFilter.optional(),
  pnl_usd_realised: NumericRangeFilter.optional(),
  pnl_usd_unrealised: NumericRangeFilter.optional(),
  holding_amount: NumericRangeFilter.optional(),
  holding_usd: NumericRangeFilter.optional(),
  max_balance_held: NumericRangeFilter.optional(),
  max_balance_held_usd: NumericRangeFilter.optional(),
  still_holding_balance_ratio: NumericRangeFilter.optional(),
  nof_trades: NumericRangeFilter.optional(),
});
export type TGMPnlLeaderboardFilters = z.infer<typeof TGMPnlLeaderboardFilters>;

export const TGMPnlLeaderboardSortField = z.enum([
  "pnl_usd_realised",
  "pnl_usd_unrealised",
  "pnl_usd_total",
  "roi_percent_total",
  "roi_percent_realised",
  "roi_percent_unrealised",
  "holding_amount",
  "holding_usd",
  "max_balance_held",
  "max_balance_held_usd",
  "still_holding_balance_ratio",
  "netflow_amount_usd",
  "netflow_amount",
  "nof_trades",
]);
export type TGMPnlLeaderboardSortField = z.infer<typeof TGMPnlLeaderboardSortField>;

export const TGMPnlLeaderboardSortOrder = z.object({
  field: TGMPnlLeaderboardSortField,
  direction: SortDirection,
});
export type TGMPnlLeaderboardSortOrder = z.infer<typeof TGMPnlLeaderboardSortOrder>;

export const TGMPnlLeaderboardRequest = z.object({
  chain: TGMPnLLeaderboardChain,
  token_address: z.string(),
  /** Required. */
  date: DateRange,
  pagination: PaginationRequest.optional(),
  filters: TGMPnlLeaderboardFilters.optional(),
  /** Omitted/false (default): free-tier labels. true: premium labels, 150 credits/call, paid plan required. */
  premium_labels: z.boolean().nullable().optional(),
  order_by: z.array(TGMPnlLeaderboardSortOrder).optional(),
});
export type TGMPnlLeaderboardRequest = z.infer<typeof TGMPnlLeaderboardRequest>;

export const TGMPnlLeaderboardItem = z.object({
  trader_address: z.string(),
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
export type TGMPnlLeaderboardItem = z.infer<typeof TGMPnlLeaderboardItem>;

export const TGMPnlLeaderboardResponse = z.object({
  data: z.array(TGMPnlLeaderboardItem),
  pagination: PaginationInfo,
});
export type TGMPnlLeaderboardResponse = z.infer<typeof TGMPnlLeaderboardResponse>;

// ===========================================================================
// POST /api/v1/tgm/token-information  (docs/raw/tgm-token-information.md)
// Credit cost: 1.
// ===========================================================================

export const TGMTokenInformationRequest = z.object({
  chain: TGMChain,
  token_address: z.string(),
  timeframe: TGMFlowIntelligenceTimeframe,
});
export type TGMTokenInformationRequest = z.infer<typeof TGMTokenInformationRequest>;

export const TokenDetails = z.object({
  token_deployment_date: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  x: z.string().nullable().optional(),
  telegram: z.string().nullable().optional(),
  market_cap_usd: z.number().nullable().optional(),
  fdv_usd: z.number().nullable().optional(),
  circulating_supply: z.number().nullable().optional(),
  total_supply: z.number().nullable().optional(),
});
export type TokenDetails = z.infer<typeof TokenDetails>;

export const SpotMetrics = z.object({
  volume_total_usd: z.number().nullable().optional(),
  buy_volume_usd: z.number().nullable().optional(),
  sell_volume_usd: z.number().nullable().optional(),
  total_buys: z.number().int().nullable().optional(),
  total_sells: z.number().int().nullable().optional(),
  unique_buyers: z.number().int().nullable().optional(),
  unique_sellers: z.number().int().nullable().optional(),
  liquidity_usd: z.number().nullable().optional(),
  total_holders: z.number().int().nullable().optional(),
});
export type SpotMetrics = z.infer<typeof SpotMetrics>;

export const TGMTokenInformation = z.object({
  name: z.string().nullable().optional(),
  symbol: z.string().nullable().optional(),
  contract_address: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  token_details: TokenDetails.nullable().optional(),
  spot_metrics: SpotMetrics.nullable().optional(),
});
export type TGMTokenInformation = z.infer<typeof TGMTokenInformation>;

export const TGMTokenInformationResponse = z.object({
  data: TGMTokenInformation,
});
export type TGMTokenInformationResponse = z.infer<typeof TGMTokenInformationResponse>;

// ===========================================================================
// POST /api/v1/tgm/who-bought-sold  (docs/raw/tgm-who-bought-sold.md)
// Credit cost: 1.
// ===========================================================================

export const TGMWhoBoughtSoldFilters = z.object({
  include_smart_money_labels: z.array(LabelType).optional(),
  exclude_smart_money_labels: z.array(LabelType).optional(),
  address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  address_label: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  bought_token_volume: NumericRangeFilter.optional(),
  sold_token_volume: NumericRangeFilter.optional(),
  token_trade_volume: NumericRangeFilter.optional(),
  bought_volume_usd: NumericRangeFilter.optional(),
  sold_volume_usd: NumericRangeFilter.optional(),
  trade_volume_usd: NumericRangeFilter.optional(),
});
export type TGMWhoBoughtSoldFilters = z.infer<typeof TGMWhoBoughtSoldFilters>;

export const TGMWhoBoughtSoldSortField = z.enum([
  "bought_volume_usd",
  "sold_volume_usd",
  "token_trade_volume",
  "trade_volume_usd",
  "bought_token_volume",
  "sold_token_volume",
]);
export type TGMWhoBoughtSoldSortField = z.infer<typeof TGMWhoBoughtSoldSortField>;

export const TGMWhoBoughtSoldSortOrder = z.object({
  field: TGMWhoBoughtSoldSortField,
  direction: SortDirection,
});
export type TGMWhoBoughtSoldSortOrder = z.infer<typeof TGMWhoBoughtSoldSortOrder>;

export const TGMWhoBoughtSoldRequest = z.object({
  chain: TGMChain,
  token_address: z.string(),
  buy_or_sell: TGMWhoBoughtSoldType.optional().default("BUY"),
  /** Required. */
  date: DateRange,
  pagination: PaginationRequest.optional(),
  filters: TGMWhoBoughtSoldFilters.optional(),
  order_by: z.array(TGMWhoBoughtSoldSortOrder).optional(),
});
export type TGMWhoBoughtSoldRequest = z.infer<typeof TGMWhoBoughtSoldRequest>;

export const TGMWhoBoughtSoldItem = z.object({
  address: z.string(),
  address_label: z.string().nullable().optional(),
  bought_token_volume: z.number().nullable().optional(),
  sold_token_volume: z.number().nullable().optional(),
  token_trade_volume: z.number().nullable().optional(),
  bought_volume_usd: z.number().nullable().optional(),
  sold_volume_usd: z.number().nullable().optional(),
  trade_volume_usd: z.number().nullable().optional(),
});
export type TGMWhoBoughtSoldItem = z.infer<typeof TGMWhoBoughtSoldItem>;

export const TGMWhoBoughtSoldResponse = z.object({
  data: z.array(TGMWhoBoughtSoldItem),
  pagination: PaginationInfo,
});
export type TGMWhoBoughtSoldResponse = z.infer<typeof TGMWhoBoughtSoldResponse>;
