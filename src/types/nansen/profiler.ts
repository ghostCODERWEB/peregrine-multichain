import { z } from "zod";
import {
  PaginationRequest,
  PaginationInfo,
  ProfilerTransactionsPaginationRequest,
  SortDirection,
  NumericRangeFilter,
  IntegerRangeFilter,
  DateRange,
  LabelType,
} from "./common";
import { CHAIN_ENUMS } from "./chain-enums";

/**
 * Profiler family. 8 endpoints, sources:
 *  - docs/raw/profiler-balances.md       -> POST /api/v1/profiler/address/current-balance
 *  - docs/raw/profiler-pnl.md            -> POST /api/v1/profiler/address/pnl-summary
 *                                         -> POST /api/v1/profiler/address/pnl
 *  - docs/raw/profiler-transactions.md   -> POST /api/v1/profiler/address/transactions
 *                                         -> POST /api/v1/transaction-with-token-transfer-lookup
 *  - docs/raw/profiler-counterparties.md -> POST /api/v1/profiler/address/counterparties
 *  - docs/raw/profiler-related-wallets.md -> POST /api/v1/profiler/address/related-wallets
 *  - docs/raw/profiler-first-funder.md   -> POST /api/v1/profiler/address/first-funder
 *
 * Note on nullability: several response schemas in this family mark a field
 * `required` (the key is always present) while ALSO wrapping its type in a
 * single-element `anyOf` with no explicit null variant (e.g.
 * ProfilerTopToken.realized_pnl, TransactionLookupResponse.native_value).
 * Elsewhere in this codebase, that same `anyOf` wrapping on a NON-required
 * field is treated as nullable+optional. Here the field can't be `.optional()`
 * (the docs say it's always present), so it's modeled as `.nullable()` only
 * (required key, nullable value). This is the FastAPI/Pydantic
 * `Optional[X]` (no default) pattern: required to be present, but the value
 * itself may be null. Flagged inline where it occurs.
 */

// ===========================================================================
// POST /api/v1/profiler/address/current-balance (docs/raw/profiler-balances.md)
// Credit cost: 1.
// ===========================================================================

export const ProfilerCurrentBalanceChain = z.enum(CHAIN_ENUMS.profilerCurrentBalance);
export type ProfilerCurrentBalanceChain = z.infer<typeof ProfilerCurrentBalanceChain>;

export const ProfilerAddressBalancesFilters = z.object({
  value_usd: NumericRangeFilter.optional(),
  price_usd: NumericRangeFilter.optional(),
  token_amount: IntegerRangeFilter.optional(),
  token_symbol: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_name: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
});
export type ProfilerAddressBalancesFilters = z.infer<typeof ProfilerAddressBalancesFilters>;

export const ProfilerAddressBalancesSortField = z.enum(["value_usd", "token_symbol"]);
export type ProfilerAddressBalancesSortField = z.infer<typeof ProfilerAddressBalancesSortField>;

export const ProfilerAddressBalancesSortOrder = z.object({
  field: ProfilerAddressBalancesSortField,
  direction: SortDirection,
});
export type ProfilerAddressBalancesSortOrder = z.infer<typeof ProfilerAddressBalancesSortOrder>;

export const ProfilerAddressBalancesRequest = z.object({
  /** Optional. Response's `address` field is empty when `entity_name` is used instead. */
  address: z.string().optional(),
  entity_name: z.string().optional(),
  /** Required. */
  chain: ProfilerCurrentBalanceChain,
  /** Removes suspicious tokens from the balance list. Default true. */
  hide_spam_token: z.boolean().optional().default(true),
  filters: ProfilerAddressBalancesFilters.optional(),
  pagination: PaginationRequest.optional(),
  order_by: z.array(ProfilerAddressBalancesSortOrder).optional(),
});
export type ProfilerAddressBalancesRequest = z.infer<typeof ProfilerAddressBalancesRequest>;

export const ProfilerBalance = z.object({
  chain: z.string(),
  /** Empty string if entity_name was used instead of address. EVM addresses are lowercase. */
  address: z.string(),
  token_address: z.string(),
  token_symbol: z.string(),
  token_name: z.string().nullable().optional(),
  token_amount: z.number().nullable().optional(),
  price_usd: z.number().nullable().optional(),
  value_usd: z.number().nullable().optional(),
});
export type ProfilerBalance = z.infer<typeof ProfilerBalance>;

export const ProfilerAddressBalancesResponse = z.object({
  pagination: PaginationInfo,
  data: z.array(ProfilerBalance),
});
export type ProfilerAddressBalancesResponse = z.infer<typeof ProfilerAddressBalancesResponse>;

// ===========================================================================
// POST /api/v1/profiler/address/pnl-summary (docs/raw/profiler-pnl.md)
// Credit cost: 1. Aggregate summary is cached server-side up to ~1 hour.
// ===========================================================================

export const ProfilerPnlSummaryChain = z.enum(CHAIN_ENUMS.profilerPnlSummary);
export type ProfilerPnlSummaryChain = z.infer<typeof ProfilerPnlSummaryChain>;

export const ProfilerAddressPnlSummaryRequest = z.object({
  address: z.string().optional(),
  entity_name: z.string().optional(),
  /** Required. */
  chain: ProfilerPnlSummaryChain,
  /** Required. */
  date: DateRange,
});
export type ProfilerAddressPnlSummaryRequest = z.infer<typeof ProfilerAddressPnlSummaryRequest>;

/**
 * `realized_pnl` and `realized_roi` are both `required` in the docs' schema
 * despite being wrapped in a single-element `anyOf` with no null variant
 * (see file-level note) — modeled as required-but-nullable.
 */
export const ProfilerTopToken = z.object({
  realized_pnl: z.number().nullable(),
  realized_roi: z.number().nullable(),
  token_address: z.string(),
  token_symbol: z.string(),
  chain: z.string(),
});
export type ProfilerTopToken = z.infer<typeof ProfilerTopToken>;

export const ProfilerAddressPnlSummaryResponse = z.object({
  pagination: PaginationInfo,
  /** Top 5 tokens by realized profit. */
  top5_tokens: z.array(ProfilerTopToken),
  traded_token_count: z.number().int(),
  /** Total number of sales (outflow or dex sell). */
  traded_times: z.number().int(),
  realized_pnl_usd: z.number(),
  /** Not multiplied by 100. */
  realized_pnl_percent: z.number(),
  win_rate: z.number(),
});
export type ProfilerAddressPnlSummaryResponse = z.infer<typeof ProfilerAddressPnlSummaryResponse>;

// ===========================================================================
// POST /api/v1/profiler/address/pnl (docs/raw/profiler-pnl.md)
// Credit cost: 1.
// ===========================================================================

export const ProfilerPnlChain = z.enum(CHAIN_ENUMS.profilerPnl);
export type ProfilerPnlChain = z.infer<typeof ProfilerPnlChain>;

export const ProfilerAddressPnlFilters = z.object({
  /** Include realized profit/loss in results. Default false. */
  show_realized: z.boolean().optional().default(false),
  /** Single token address only (unlike other endpoints' filters, no array/list form documented here). */
  token_address: z.string().optional(),
});
export type ProfilerAddressPnlFilters = z.infer<typeof ProfilerAddressPnlFilters>;

export const ProfilerAddressPnlSortField = z.enum([
  "pnl_usd_realised",
  "roi_percent_realised",
  "pnl_usd_unrealised",
  "roi_percent_unrealised",
  "bought_usd",
  "sold_usd",
  "holding_usd",
]);
export type ProfilerAddressPnlSortField = z.infer<typeof ProfilerAddressPnlSortField>;

export const ProfilerAddressPnlSortOrder = z.object({
  field: ProfilerAddressPnlSortField,
  direction: SortDirection,
});
export type ProfilerAddressPnlSortOrder = z.infer<typeof ProfilerAddressPnlSortOrder>;

export const ProfilerAddressPnlRequest = z.object({
  address: z.string().optional(),
  entity_name: z.string().optional(),
  /** Required. */
  chain: ProfilerPnlChain,
  /** Optional despite the endpoint's PnL semantics — omitting it is accepted by the schema. */
  date: DateRange.optional(),
  filters: ProfilerAddressPnlFilters.optional(),
  pagination: PaginationRequest.optional(),
  /**
   * Default: pnl_usd_realised DESC. If filters.show_realized is false, the
   * default sort order is pnl_usd_unrealised DESC instead.
   */
  order_by: z.array(ProfilerAddressPnlSortOrder).optional(),
});
export type ProfilerAddressPnlRequest = z.infer<typeof ProfilerAddressPnlRequest>;

export const ProfilerAddressPnl = z.object({
  token_address: z.string(),
  token_symbol: z.string(),
  /** Price of the token on date_to. */
  token_price: z.number().nullable().optional(),
  roi_percent_realised: z.number().nullable().optional(),
  pnl_usd_realised: z.number().nullable().optional(),
  pnl_usd_unrealised: z.number().nullable().optional(),
  roi_percent_unrealised: z.number().nullable().optional(),
  bought_amount: z.number().nullable().optional(),
  bought_usd: z.number().nullable().optional(),
  cost_basis_usd: z.number().nullable().optional(),
  sold_amount: z.number().nullable().optional(),
  sold_usd: z.number().nullable().optional(),
  avg_sold_price_usd: z.number().nullable().optional(),
  holding_amount: z.number().nullable().optional(),
  holding_usd: z.number().nullable().optional(),
  /**
   * Docs type this as a plain string ("Number of buys (either inflow or dex
   * sell)"), not an integer — preserved verbatim rather than guessed.
   * TODO: verify against live response — docs unclear on why a count is
   * string-typed here (elsewhere in this API counts are integers).
   */
  nof_buys: z.string(),
  nof_sells: z.string(),
  max_balance_held: z.number().nullable().optional(),
  max_balance_held_usd: z.number().nullable().optional(),
});
export type ProfilerAddressPnl = z.infer<typeof ProfilerAddressPnl>;

export const ProfilerAddressPnlResponse = z.object({
  pagination: PaginationInfo,
  data: z.array(ProfilerAddressPnl),
});
export type ProfilerAddressPnlResponse = z.infer<typeof ProfilerAddressPnlResponse>;

// ===========================================================================
// POST /api/v1/profiler/address/transactions (docs/raw/profiler-transactions.md)
// Credit cost: 1. Pagination caps per_page at 100 (see
// ProfilerTransactionsPaginationRequest in common.ts).
// ===========================================================================

export const ProfilerTransactionsChain = z.enum(CHAIN_ENUMS.profilerTransactions);
export type ProfilerTransactionsChain = z.infer<typeof ProfilerTransactionsChain>;

export const ProfilerAddressTransactionsFilters = z.object({
  token_symbol: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  token_address: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  counterparty_name: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  /** Single address only — unlike the other filters here, no array/null variant documented. */
  counterparty_address: z.string().optional(),
  volume_usd: NumericRangeFilter.optional(),
  method: z.string().optional(),
  source_type: z.string().optional(),
});
export type ProfilerAddressTransactionsFilters = z.infer<
  typeof ProfilerAddressTransactionsFilters
>;

/** Docs list only one sortable field for this endpoint. */
export const ProfilerAddressTransactionsSortField = z.enum(["block_timestamp"]);
export type ProfilerAddressTransactionsSortField = z.infer<
  typeof ProfilerAddressTransactionsSortField
>;

export const ProfilerAddressTransactionsSortOrder = z.object({
  field: ProfilerAddressTransactionsSortField,
  direction: SortDirection,
});
export type ProfilerAddressTransactionsSortOrder = z.infer<
  typeof ProfilerAddressTransactionsSortOrder
>;

export const ProfilerAddressTransactionsRequest = z.object({
  /** Required. */
  address: z.string(),
  /** Required. */
  chain: ProfilerTransactionsChain,
  /** Required. */
  date: DateRange,
  /** Removes suspicious tokens from the transaction list. Default true. */
  hide_spam_token: z.boolean().optional().default(true),
  filters: ProfilerAddressTransactionsFilters.optional(),
  /** This endpoint caps per_page at 100 (default 20), lower than the API-wide 1000/10. */
  pagination: ProfilerTransactionsPaginationRequest.optional(),
  order_by: z.array(ProfilerAddressTransactionsSortOrder).optional(),
});
export type ProfilerAddressTransactionsRequest = z.infer<
  typeof ProfilerAddressTransactionsRequest
>;

export const ProfilerTokenInfo = z.object({
  token_symbol: z.string(),
  token_amount: z.number(),
  price_usd: z.number().nullable().optional(),
  value_usd: z.number().nullable().optional(),
  token_address: z.string(),
  chain: z.string(),
  from_address: z.string(),
  to_address: z.string(),
  from_address_label: z.string().nullable().optional(),
  to_address_label: z.string().nullable().optional(),
});
export type ProfilerTokenInfo = z.infer<typeof ProfilerTokenInfo>;

export const ProfilerTransaction = z.object({
  chain: z.string(),
  /** Transaction method, e.g. "sent"/"received". */
  method: z.string(),
  tokens_sent: z.array(ProfilerTokenInfo).nullable().optional(),
  tokens_received: z.array(ProfilerTokenInfo).nullable().optional(),
  volume_usd: z.number().nullable().optional(),
  block_timestamp: z.string(),
  transaction_hash: z.string(),
  source_type: z.string(),
});
export type ProfilerTransaction = z.infer<typeof ProfilerTransaction>;

export const ProfilerAddressTransactionsResponse = z.object({
  pagination: PaginationInfo,
  data: z.array(ProfilerTransaction),
});
export type ProfilerAddressTransactionsResponse = z.infer<
  typeof ProfilerAddressTransactionsResponse
>;

// ===========================================================================
// POST /api/v1/transaction-with-token-transfer-lookup (docs/raw/profiler-transactions.md,
// second endpoint on that page). Credit cost: 1.
// ===========================================================================

export const TransactionLookupChain = z.enum(CHAIN_ENUMS.transactionWithTokenTransferLookup);
export type TransactionLookupChain = z.infer<typeof TransactionLookupChain>;

export const TransactionLookupRequest = z.object({
  /** Required. */
  chain: TransactionLookupChain,
  /** Required. */
  transaction_hash: z.string(),
  /**
   * Format: 'YYYY-MM-DD HH:MM:SS'. Optional for most EVM chains (resolved
   * automatically). Required for non-EVM chains (bitcoin, tron, ton,
   * starknet, sui) — not enforced at the schema level here, per docs.
   */
  block_timestamp: z.string().optional(),
});
export type TransactionLookupRequest = z.infer<typeof TransactionLookupRequest>;

export const TokenTransfer = z.object({
  from_address: z.string(),
  from_address_label: z.string(),
  to_address: z.string(),
  to_address_label: z.string(),
  token_address: z.string(),
  token_symbol: z.string(),
  token_amount: z.number(),
  /** Required but anyOf-wrapped in the docs — see file-level note. */
  dated_price_usd: z.number().nullable(),
  dated_value_usd: z.number().nullable(),
  current_price_usd: z.number().nullable(),
  current_value_usd: z.number().nullable(),
  transfer_id: z.string(),
});
export type TokenTransfer = z.infer<typeof TokenTransfer>;

export const NFTTransfer = z.object({
  from_address: z.string(),
  from_address_label: z.string(),
  to_address: z.string(),
  to_address_label: z.string(),
  project_id: z.string(),
  collection_name: z.string(),
  nft_id: z.string(),
});
export type NFTTransfer = z.infer<typeof NFTTransfer>;

/**
 * Every field is `required` per the docs, but several are anyOf-wrapped with
 * no null variant shown (from_address_label, to_address_label, native_value,
 * dated_native_price, dated_native_value_usd, current_native_price,
 * current_native_value_usd, receipt_status, token_transfer_array,
 * nft_transfer_array) — modeled as required-but-nullable, see file-level note.
 */
export const TransactionLookupResponse = z.object({
  chain: z.string(),
  transaction_hash: z.string(),
  from_address: z.string(),
  from_address_label: z.string().nullable(),
  to_address: z.string(),
  to_address_label: z.string().nullable(),
  native_value: z.number().nullable(),
  dated_native_price: z.number().nullable(),
  dated_native_value_usd: z.number().nullable(),
  current_native_price: z.number().nullable(),
  current_native_value_usd: z.number().nullable(),
  /** 1 for success, 0 for failure. */
  receipt_status: z.number().int().nullable(),
  block_timestamp: z.string(),
  token_transfer_array: z.array(TokenTransfer).nullable(),
  nft_transfer_array: z.array(NFTTransfer).nullable(),
});
export type TransactionLookupResponse = z.infer<typeof TransactionLookupResponse>;

export const TransactionLookupListResponse = z.object({
  data: z.array(TransactionLookupResponse),
});
export type TransactionLookupListResponse = z.infer<typeof TransactionLookupListResponse>;

// ===========================================================================
// POST /api/v1/profiler/address/counterparties (docs/raw/profiler-counterparties.md)
// Credit cost: 5.
// ===========================================================================

export const ProfilerCounterpartiesChain = z.enum(CHAIN_ENUMS.profilerCounterparties);
export type ProfilerCounterpartiesChain = z.infer<typeof ProfilerCounterpartiesChain>;

export const SourceInput = z.enum(["Combined", "Tokens", "ETH"]);
export type SourceInput = z.infer<typeof SourceInput>;

export const CounterpartiesGroupBy = z.enum(["wallet", "entity"]);
export type CounterpartiesGroupBy = z.infer<typeof CounterpartiesGroupBy>;

export const ProfilerAddressCounterpartiesFilters = z.object({
  interaction_count: IntegerRangeFilter.optional(),
  total_volume_usd: NumericRangeFilter.optional(),
  volume_in_usd: NumericRangeFilter.optional(),
  volume_out_usd: NumericRangeFilter.optional(),
  include_smart_money_labels: z.array(LabelType).optional(),
  exclude_smart_money_labels: z.array(LabelType).optional(),
});
export type ProfilerAddressCounterpartiesFilters = z.infer<
  typeof ProfilerAddressCounterpartiesFilters
>;

export const ProfilerAddressCounterpartiesSortField = z.enum([
  "interaction_count",
  "total_volume_usd",
  "volume_in_usd",
  "volume_out_usd",
]);
export type ProfilerAddressCounterpartiesSortField = z.infer<
  typeof ProfilerAddressCounterpartiesSortField
>;

export const ProfilerAddressCounterpartiesSortOrder = z.object({
  field: ProfilerAddressCounterpartiesSortField,
  direction: SortDirection,
});
export type ProfilerAddressCounterpartiesSortOrder = z.infer<
  typeof ProfilerAddressCounterpartiesSortOrder
>;

export const ProfilerAddressCounterpartiesRequest = z.object({
  address: z.string().optional(),
  entity_name: z.string().optional(),
  /** Required. */
  chain: ProfilerCounterpartiesChain,
  /**
   * Required. Note: high-volume addresses (e.g. WETH on Base) are limited to
   * 180 days; very high-activity wallets (exchange hot wallets) can be slow
   * over wide ranges.
   */
  date: DateRange,
  source_input: SourceInput.optional().default("Combined"),
  group_by: CounterpartiesGroupBy.optional().default("wallet"),
  filters: ProfilerAddressCounterpartiesFilters.optional(),
  pagination: PaginationRequest.optional(),
  order_by: z.array(ProfilerAddressCounterpartiesSortOrder).optional(),
});
export type ProfilerAddressCounterpartiesRequest = z.infer<
  typeof ProfilerAddressCounterpartiesRequest
>;

/**
 * Named `TokenInfo` in the docs, distinct from the `ProfilerTokenInfo` shape
 * used by the transactions endpoint above (same doc-family, different
 * fields) — renamed here to avoid a collision.
 */
export const ProfilerCounterpartyTokenInfo = z.object({
  token_address: z.string(),
  token_symbol: z.string(),
  token_name: z.string(),
  /**
   * Docs type this as a plain string despite representing a count — see the
   * same pattern on ProfilerAddressPnl.nof_buys/nof_sells above.
   * TODO: verify against live response.
   */
  num_transfer: z.string(),
  /** Null when transferred token units cannot be determined. */
  total_token_amount: z.number().nullable().optional(),
  token_in_amount: z.number().nullable().optional(),
  token_out_amount: z.number().nullable().optional(),
});
export type ProfilerCounterpartyTokenInfo = z.infer<typeof ProfilerCounterpartyTokenInfo>;

export const ProfilerCounterparty = z.object({
  counterparty_address: z.string(),
  counterparty_address_label: z.array(z.string()).nullable().optional(),
  interaction_count: z.number().int(),
  total_volume_usd: z.number().nullable().optional(),
  volume_in_usd: z.number().nullable().optional(),
  volume_out_usd: z.number().nullable().optional(),
  /** Per-token transfers with this counterparty; different tokens are not combined. */
  tokens_info: z.array(ProfilerCounterpartyTokenInfo).nullable().optional(),
});
export type ProfilerCounterparty = z.infer<typeof ProfilerCounterparty>;

export const ProfilerAddressCounterpartiesResponse = z.object({
  pagination: PaginationInfo,
  data: z.array(ProfilerCounterparty),
});
export type ProfilerAddressCounterpartiesResponse = z.infer<
  typeof ProfilerAddressCounterpartiesResponse
>;

// ===========================================================================
// POST /api/v1/profiler/address/related-wallets (docs/raw/profiler-related-wallets.md)
// Credit cost: 1.
// ===========================================================================

export const ProfilerRelatedWalletsChain = z.enum(CHAIN_ENUMS.profilerRelatedWallets);
export type ProfilerRelatedWalletsChain = z.infer<typeof ProfilerRelatedWalletsChain>;

/** Docs list only one sortable field for this endpoint. */
export const ProfilerAddressRelatedWalletsSortField = z.enum(["order"]);
export type ProfilerAddressRelatedWalletsSortField = z.infer<
  typeof ProfilerAddressRelatedWalletsSortField
>;

export const ProfilerAddressRelatedWalletsSortOrder = z.object({
  field: ProfilerAddressRelatedWalletsSortField,
  direction: SortDirection,
});
export type ProfilerAddressRelatedWalletsSortOrder = z.infer<
  typeof ProfilerAddressRelatedWalletsSortOrder
>;

export const ProfilerAddressRelatedWalletsRequest = z.object({
  /** Required. */
  address: z.string(),
  /** Required. */
  chain: ProfilerRelatedWalletsChain,
  pagination: PaginationRequest.optional(),
  order_by: z.array(ProfilerAddressRelatedWalletsSortOrder).optional(),
});
export type ProfilerAddressRelatedWalletsRequest = z.infer<
  typeof ProfilerAddressRelatedWalletsRequest
>;

export const ProfilerRelatedWallet = z.object({
  address: z.string(),
  address_label: z.string().nullable().optional(),
  /** Type of relation between this address and the input address. */
  relation: z.string(),
  transaction_hash: z.string(),
  block_timestamp: z.string(),
  order: z.number().int(),
  chain: z.string(),
});
export type ProfilerRelatedWallet = z.infer<typeof ProfilerRelatedWallet>;

export const ProfilerAddressRelatedWalletsResponse = z.object({
  pagination: PaginationInfo,
  data: z.array(ProfilerRelatedWallet),
});
export type ProfilerAddressRelatedWalletsResponse = z.infer<
  typeof ProfilerAddressRelatedWalletsResponse
>;

// ===========================================================================
// POST /api/v1/profiler/address/first-funder (docs/raw/profiler-first-funder.md)
// Credit cost: not listed in docs/raw/credits.md's endpoint table — undocumented.
// TODO: verify against live response / support before relying on a specific cost.
// ===========================================================================

/** Fixed to "all" — the first funder is resolved across chains. */
export const ProfilerFirstFunderChain = z.enum(CHAIN_ENUMS.profilerFirstFunder);
export type ProfilerFirstFunderChain = z.infer<typeof ProfilerFirstFunderChain>;

export const ProfilerAddressFirstFunderRequest = z.object({
  /** Required. EVM address. */
  address: z.string(),
  chain: ProfilerFirstFunderChain.optional().default("all"),
});
export type ProfilerAddressFirstFunderRequest = z.infer<typeof ProfilerAddressFirstFunderRequest>;

export const ProfilerAddressFirstFunderData = z.object({
  wallet_address: z.string(),
  first_funder_address: z.string(),
  first_funder_name: z.string().nullable().optional(),
  transaction_hash: z.string(),
  block_timestamp: z.string(),
  chain: z.string(),
});
export type ProfilerAddressFirstFunderData = z.infer<typeof ProfilerAddressFirstFunderData>;

export const ProfilerAddressFirstFunderResponse = z.object({
  pagination: PaginationInfo,
  data: z.array(ProfilerAddressFirstFunderData),
});
export type ProfilerAddressFirstFunderResponse = z.infer<
  typeof ProfilerAddressFirstFunderResponse
>;
