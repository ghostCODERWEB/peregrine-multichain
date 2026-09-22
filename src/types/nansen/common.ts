import { z } from "zod";

/**
 * Shared primitives reused verbatim across many Nansen API endpoint docs
 * (see docs/raw/filters.md, sorting.md, error-handling.md, credits.md).
 * Extracted here once instead of being redefined in every family file,
 * since the OpenAPI schemas embedded in the docs name these components
 * identically (e.g. "PaginationRequest", "NumericRangeFilter") across
 * dozens of endpoint pages.
 */

// --- Pagination --------------------------------------------------------

/** docs/raw/filters.md, sorting.md; embedded `PaginationRequest` component. */
export const PaginationRequest = z.object({
  page: z.number().int().min(1).optional().default(1),
  per_page: z.number().int().min(1).max(1000).optional().default(10),
});
export type PaginationRequest = z.infer<typeof PaginationRequest>;

/** Embedded `PaginationInfo` response component. */
export const PaginationInfo = z.object({
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(1000).default(10),
  is_last_page: z.boolean().default(true),
});
export type PaginationInfo = z.infer<typeof PaginationInfo>;

/**
 * docs/raw/profiler-transactions.md notes this endpoint's pagination caps
 * per_page at 100 (not the API-wide 1000) and defaults to 20.
 */
export const ProfilerTransactionsPaginationRequest = z.object({
  page: z.number().int().min(1).optional().default(1),
  per_page: z.number().int().min(1).max(100).optional().default(20),
});
export type ProfilerTransactionsPaginationRequest = z.infer<
  typeof ProfilerTransactionsPaginationRequest
>;

// --- Sorting -------------------------------------------------------------

/** docs/raw/sorting.md */
export const SortDirection = z.enum(["ASC", "DESC"]);
export type SortDirection = z.infer<typeof SortDirection>;

// --- Range filters (docs/raw/filters.md) ---------------------------------

export const NumericRangeFilter = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});
export type NumericRangeFilter = z.infer<typeof NumericRangeFilter>;

export const IntegerRangeFilter = z.object({
  min: z.number().int().optional(),
  max: z.number().int().optional(),
});
export type IntegerRangeFilter = z.infer<typeof IntegerRangeFilter>;

/**
 * Used by TGM DEX trades filters (`block_timestamp`) — distinct from the
 * bare `DateRange` request field in that it's a *filter* shape, but the
 * docs give it an identical {from, to} shape.
 */
export const DateRangeFilter = z.object({
  from: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
});
export type DateRangeFilter = z.infer<typeof DateRangeFilter>;

// --- Date range (top-level request field) ---------------------------------

/**
 * docs/raw/filters.md documents this as accepting either a full ISO 8601
 * datetime ("2025-01-01T00:00:00Z") or a bare date ("2025-01-01"). `from`
 * and `to` are independently optional in most endpoints' embedded schemas
 * (both `anyOf [string]`, no `required`), though several endpoints require
 * the whole `date`/`date_range` object itself. Each family file enforces
 * object-level requiredness at the call site.
 */
export const DateRange = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});
export type DateRange = z.infer<typeof DateRange>;

// --- Smart money / entity labels (docs/raw/filters.md, sm-*.md, tgm-*.md) --

/**
 * "SmartMoneyFilterType" — used by Smart Money netflows/holdings/dex-trades
 * and the Token Screener's smart-money label filters.
 */
export const SmartMoneyFilterType = z.enum([
  "Fund",
  "Smart Trader",
  "30D Smart Trader",
  "90D Smart Trader",
  "180D Smart Trader",
  "Smart HL Perps Trader",
]);
export type SmartMoneyFilterType = z.infer<typeof SmartMoneyFilterType>;

/**
 * "LabelType" — the broader entity-label enum used by TGM holders, TGM
 * DEX/perp/who-bought-sold filters, and Profiler counterparties. A superset
 * of SmartMoneyFilterType plus Exchange/Whale/Public Figure/bot labels.
 */
export const LabelType = z.enum([
  "30D Smart Trader",
  "90D Smart Trader",
  "180D Smart Trader",
  "Fund",
  "Smart Trader",
  "Public Figure",
  "Exchange",
  "Whale",
  "BananaGun Bot User",
  "Top Maestro Bot User",
  "Top BananaGun Bot User",
  "Maestro Bot User",
  "Early MAGIC Miner",
  "First Mover LP",
  "First Mover Staking",
  "Profitable LP",
  "Smart HL Perps Trader",
]);
export type LabelType = z.infer<typeof LabelType>;

/**
 * "HistoricalLabelType" — used by the Backtesting Data historical DEX
 * trades endpoint. A superset of LabelType that additionally includes
 * legacy "Smart Dex Trader" label variants that only appear in historical
 * data (see docs/raw/hist-dex-trades.md).
 */
export const HistoricalLabelType = z.enum([
  "30D Smart Trader",
  "90D Smart Trader",
  "180D Smart Trader",
  "Fund",
  "Smart Trader",
  "Smart Dex Trader",
  "30D Smart Dex Trader",
  "90D Smart Dex Trader",
  "180D Smart Dex Trader",
  "Public Figure",
  "Exchange",
  "Whale",
  "BananaGun Bot User",
  "Top Maestro Bot User",
  "Top BananaGun Bot User",
  "Maestro Bot User",
  "Early MAGIC Miner",
  "First Mover LP",
  "First Mover Staking",
  "Profitable LP",
  "Smart HL Perps Trader",
]);
export type HistoricalLabelType = z.infer<typeof HistoricalLabelType>;

/**
 * "HistoricalSmartMoneyFilterType" — used by the historical Token Screener
 * (docs/raw/hist-screener.md). A superset of SmartMoneyFilterType with the
 * legacy "Smart Dex Trader" variants.
 */
export const HistoricalSmartMoneyFilterType = z.enum([
  "Fund",
  "Smart Trader",
  "30D Smart Trader",
  "90D Smart Trader",
  "180D Smart Trader",
  "Smart Dex Trader",
  "30D Smart Dex Trader",
  "90D Smart Dex Trader",
  "180D Smart Dex Trader",
  "Smart HL Perps Trader",
]);
export type HistoricalSmartMoneyFilterType = z.infer<
  typeof HistoricalSmartMoneyFilterType
>;

// --- Errors (docs/raw/error-handling.md) -----------------------------------

export const NansenErrorCode = z.enum([
  "missing_field",
  "unknown_field",
  "invalid_field_value",
  "invalid_address_format",
  "invalid_date_format",
  "invalid_date_range",
  "mutually_exclusive_fields",
  "value_out_of_range",
  "too_many_items",
  "unauthenticated",
  "forbidden",
  "geo_blocked",
  "plan_upgrade_required",
  "insufficient_credits",
  "rate_limit_exceeded",
  "not_found",
  "method_not_allowed",
  "conflict",
  "payload_too_large",
  "query_timeout",
  "query_too_large",
  "upstream_unavailable",
  "internal_error",
]);
export type NansenErrorCode = z.infer<typeof NansenErrorCode>;

/** The stable JSON error envelope documented in docs/raw/error-handling.md. */
export const NansenErrorEnvelope = z.object({
  error: z.string(),
  message: z.string(),
  code: NansenErrorCode,
  status: z.number().int(),
  request_id: z.string().nullable(),
  doc_url: z.string(),
  param: z.string().optional(),
  retry_after: z.number().int().min(0).optional(),
});
export type NansenErrorEnvelope = z.infer<typeof NansenErrorEnvelope>;
