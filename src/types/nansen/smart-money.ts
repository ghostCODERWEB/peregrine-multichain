import { z } from "zod";
import {
  PaginationRequest,
  PaginationInfo,
  SortDirection,
  NumericRangeFilter,
  SmartMoneyFilterType,
} from "./common";
import { CHAIN_ENUMS } from "./chain-enums";

/**
 * Smart Money family. Sources:
 *  - docs/raw/sm-netflows.md    -> POST /api/v1/smart-money/netflow
 *  - docs/raw/sm-holdings.md    -> POST /api/v1/smart-money/holdings
 *  - docs/raw/sm-dex-trades.md  -> POST /api/v1/smart-money/dex-trades
 *
 * All three request bodies share the "SmartMoneyChain" chain enum
 * (CHAIN_ENUMS.smartMoneyNetflows / smartMoneyHoldings / smartMoneyDexTrades
 * — identical values, kept as separate registry keys per endpoint).
 *
 * Credit cost: 5 credits per call for all three (docs/raw/credits.md).
 * All three also advertise x402 / MPP pay-per-request support (extra
 * security schemes in the OpenAPI block) in addition to the standard
 * `apikey` header — see docs/raw/sm-netflows.md's `X402Payment` / `MppPayment`
 * security schemes. That's a header/payment-protocol detail, not a body field.
 */

// ---------------------------------------------------------------------------
// POST /api/v1/smart-money/netflow
// ---------------------------------------------------------------------------

export const SmartMoneyNetflowsChain = z.enum(CHAIN_ENUMS.smartMoneyNetflows);
export type SmartMoneyNetflowsChain = z.infer<typeof SmartMoneyNetflowsChain>;

export const SmartMoneyNetflowsFilters = z.object({
  include_smart_money_labels: z.array(SmartMoneyFilterType).optional(),
  exclude_smart_money_labels: z.array(SmartMoneyFilterType).optional(),
  /** Token address or symbol filter; string or array of strings. */
  token_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  include_stablecoins: z.boolean().optional().default(false),
  include_native_tokens: z.boolean().optional().default(false),
  token_sector: z.array(z.string()).optional(),
  trader_count: NumericRangeFilter.optional(),
  token_age_days: NumericRangeFilter.optional(),
  market_cap_usd: NumericRangeFilter.optional(),
});
export type SmartMoneyNetflowsFilters = z.infer<typeof SmartMoneyNetflowsFilters>;

export const SmartMoneyNetflowsSortField = z.enum([
  "chain",
  "token_address",
  "token_symbol",
  "net_flow_1h_usd",
  "net_flow_24h_usd",
  "net_flow_7d_usd",
  "net_flow_30d_usd",
  "token_sectors",
  "trader_count",
  "token_age_days",
  "market_cap_usd",
]);
export type SmartMoneyNetflowsSortField = z.infer<typeof SmartMoneyNetflowsSortField>;

export const SmartMoneyNetflowsSortOrder = z.object({
  field: SmartMoneyNetflowsSortField,
  direction: SortDirection,
});
export type SmartMoneyNetflowsSortOrder = z.infer<typeof SmartMoneyNetflowsSortOrder>;

export const SmartMoneyNetflowsRequest = z.object({
  /** Required. Use ["all"] to include every smart-money-supported chain. */
  chains: z.array(SmartMoneyNetflowsChain).min(1),
  filters: SmartMoneyNetflowsFilters.optional(),
  pagination: PaginationRequest.optional(),
  order_by: z.array(SmartMoneyNetflowsSortOrder).optional(),
});
export type SmartMoneyNetflowsRequest = z.infer<typeof SmartMoneyNetflowsRequest>;

export const SmartMoneyNetflow = z.object({
  token_address: z.string(),
  token_symbol: z.string(),
  net_flow_1h_usd: z.number(),
  net_flow_24h_usd: z.number(),
  net_flow_7d_usd: z.number(),
  net_flow_30d_usd: z.number(),
  chain: z.string(),
  token_sectors: z.array(z.string()),
  trader_count: z.number().int(),
  token_age_days: z.number().int(),
  market_cap_usd: z.number().nullable().optional(),
});
export type SmartMoneyNetflow = z.infer<typeof SmartMoneyNetflow>;

export const SmartMoneyNetflowsResponse = z.object({
  data: z.array(SmartMoneyNetflow),
  pagination: PaginationInfo,
});
export type SmartMoneyNetflowsResponse = z.infer<typeof SmartMoneyNetflowsResponse>;

// ---------------------------------------------------------------------------
// POST /api/v1/smart-money/holdings
// ---------------------------------------------------------------------------

export const SmartMoneyHoldingsChain = z.enum(CHAIN_ENUMS.smartMoneyHoldings);
export type SmartMoneyHoldingsChain = z.infer<typeof SmartMoneyHoldingsChain>;

export const SmartMoneyHoldingsFilters = z.object({
  include_smart_money_labels: z.array(SmartMoneyFilterType).optional(),
  exclude_smart_money_labels: z.array(SmartMoneyFilterType).optional(),
  include_stablecoins: z.boolean().optional().default(false),
  include_native_tokens: z.boolean().optional().default(false),
  value_usd: NumericRangeFilter.optional(),
  balance_24h_percent_change: NumericRangeFilter.optional(),
  holders_count: NumericRangeFilter.optional(),
  share_of_holdings_percent: NumericRangeFilter.optional(),
  token_age_days: NumericRangeFilter.optional(),
  market_cap_usd: NumericRangeFilter.optional(),
  token_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_symbol: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_sectors: z.array(z.string()).optional(),
});
export type SmartMoneyHoldingsFilters = z.infer<typeof SmartMoneyHoldingsFilters>;

export const SmartMoneyHoldingsSortField = z.enum([
  "chain",
  "token_address",
  "token_symbol",
  "value_usd",
  "balance_24h_percent_change",
  "holders_count",
  "share_of_holdings_percent",
  "token_age_days",
  "market_cap_usd",
]);
export type SmartMoneyHoldingsSortField = z.infer<typeof SmartMoneyHoldingsSortField>;

export const SmartMoneyHoldingsSortOrder = z.object({
  field: SmartMoneyHoldingsSortField,
  direction: SortDirection,
});
export type SmartMoneyHoldingsSortOrder = z.infer<typeof SmartMoneyHoldingsSortOrder>;

export const SmartMoneyHoldingsRequest = z.object({
  chains: z.array(SmartMoneyHoldingsChain).min(1),
  filters: SmartMoneyHoldingsFilters.optional(),
  pagination: PaginationRequest.optional(),
  order_by: z.array(SmartMoneyHoldingsSortOrder).optional(),
});
export type SmartMoneyHoldingsRequest = z.infer<typeof SmartMoneyHoldingsRequest>;

export const SmartMoneyHolding = z.object({
  chain: SmartMoneyHoldingsChain,
  token_address: z.string(),
  token_symbol: z.string(),
  token_sectors: z.array(z.string()),
  value_usd: z.number().nullable().optional(),
  balance_24h_percent_change: z.number().nullable().optional(),
  holders_count: z.number().int(),
  share_of_holdings_percent: z.number().nullable().optional(),
  token_age_days: z.number().int(),
  market_cap_usd: z.number().nullable().optional(),
});
export type SmartMoneyHolding = z.infer<typeof SmartMoneyHolding>;

export const SmartMoneyHoldingsResponse = z.object({
  data: z.array(SmartMoneyHolding),
  pagination: PaginationInfo,
});
export type SmartMoneyHoldingsResponse = z.infer<typeof SmartMoneyHoldingsResponse>;

// ---------------------------------------------------------------------------
// POST /api/v1/smart-money/dex-trades
// ---------------------------------------------------------------------------

export const SmartMoneyDexTradesChain = z.enum(CHAIN_ENUMS.smartMoneyDexTrades);
export type SmartMoneyDexTradesChain = z.infer<typeof SmartMoneyDexTradesChain>;

export const SmartMoneyDexTradesFilters = z.object({
  include_smart_money_labels: z.array(SmartMoneyFilterType).optional(),
  exclude_smart_money_labels: z.array(SmartMoneyFilterType).optional(),
  chain: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
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
  token_bought_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_sold_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_bought_amount: NumericRangeFilter.optional(),
  token_sold_amount: NumericRangeFilter.optional(),
  token_bought_symbol: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_sold_symbol: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_bought_age_days: NumericRangeFilter.optional(),
  token_sold_age_days: NumericRangeFilter.optional(),
  token_bought_market_cap: NumericRangeFilter.optional(),
  token_sold_market_cap: NumericRangeFilter.optional(),
  token_bought_fdv: NumericRangeFilter.optional(),
  token_sold_fdv: NumericRangeFilter.optional(),
  trade_value_usd: NumericRangeFilter.optional(),
});
export type SmartMoneyDexTradesFilters = z.infer<typeof SmartMoneyDexTradesFilters>;

export const SmartMoneyDexTradesSortField = z.enum([
  "chain",
  "block_timestamp",
  "transaction_hash",
  "trader_address",
  "trader_address_label",
  "token_bought_address",
  "token_sold_address",
  "token_bought_amount",
  "token_sold_amount",
  "token_bought_symbol",
  "token_sold_symbol",
  "token_bought_age_days",
  "token_sold_age_days",
  "token_bought_market_cap",
  "token_sold_market_cap",
  "token_bought_fdv",
  "token_sold_fdv",
  "trade_value_usd",
]);
export type SmartMoneyDexTradesSortField = z.infer<typeof SmartMoneyDexTradesSortField>;

export const SmartMoneyDexTradesSortOrder = z.object({
  field: SmartMoneyDexTradesSortField,
  direction: SortDirection,
});
export type SmartMoneyDexTradesSortOrder = z.infer<typeof SmartMoneyDexTradesSortOrder>;

export const SmartMoneyDexTradesRequest = z.object({
  /** Only the trailing 24 hours is queryable; no date-range parameter exists. */
  chains: z.array(SmartMoneyDexTradesChain).min(1),
  filters: SmartMoneyDexTradesFilters.optional(),
  pagination: PaginationRequest.optional(),
  order_by: z.array(SmartMoneyDexTradesSortOrder).optional(),
});
export type SmartMoneyDexTradesRequest = z.infer<typeof SmartMoneyDexTradesRequest>;

export const SmartMoneyDexTrade = z.object({
  chain: z.string(),
  block_timestamp: z.string(),
  transaction_hash: z.string(),
  trader_address: z.string(),
  trader_address_label: z.string(),
  token_bought_address: z.string(),
  token_sold_address: z.string(),
  token_bought_amount: z.number().nullable().optional(),
  token_sold_amount: z.number().nullable().optional(),
  token_bought_symbol: z.string(),
  token_sold_symbol: z.string(),
  token_bought_age_days: z.number().int(),
  token_sold_age_days: z.number().int(),
  /** Null when circulating supply data is unavailable. */
  token_bought_market_cap: z.number().nullable().optional(),
  token_sold_market_cap: z.number().nullable().optional(),
  /** May be very large for tokens with no circulating supply data. */
  token_bought_fdv: z.number().nullable().optional(),
  token_sold_fdv: z.number().nullable().optional(),
  /** Either token_bought_in_usd or token_sold_in_usd, whichever is nonzero. */
  trade_value_usd: z.number().nullable().optional(),
});
export type SmartMoneyDexTrade = z.infer<typeof SmartMoneyDexTrade>;

export const SmartMoneyDexTradesResponse = z.object({
  data: z.array(SmartMoneyDexTrade),
  pagination: PaginationInfo,
});
export type SmartMoneyDexTradesResponse = z.infer<typeof SmartMoneyDexTradesResponse>;
