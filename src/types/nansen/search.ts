import { z } from "zod";

/**
 * Search family. Source: docs/raw/search.md
 *
 * 3 endpoints:
 *  - POST /api/v1/search/general        (GeneralSearchRequest / GeneralSearchResponse)
 *  - POST /api/v1/search/entity-name     (EntityNameSearchRequest / EntityNameSearchResponse)
 *  - GET  /api/v1/search/token-sectors   (no request body; TokenSectorsResponse)
 */

// ---------------------------------------------------------------------------
// POST /api/v1/search/general
// ---------------------------------------------------------------------------

/** docs/raw/search.md does not enumerate a fixed value list for `result_type`
 * beyond the three literals below (it's a plain 3-value enum). */
export const SearchResultType = z.enum(["token", "entity", "any"]);
export type SearchResultType = z.infer<typeof SearchResultType>;

export const GeneralSearchRequest = z.object({
  /** Required. 1-200 chars. Token name, symbol, contract address, or entity name. */
  search_query: z.string().min(1).max(200),
  /** Optional, default "any". */
  result_type: SearchResultType.optional().default("any"),
  /**
   * Optional chain filter (e.g. "ethereum", "solana", "base"). The doc's
   * OpenAPI schema types this as a bare `anyOf: [{type: string}]` with no
   * enum — i.e. any string is accepted, not validated against a fixed chain
   * list server-side per this endpoint's schema.
   * TODO: verify against live response — docs unclear on whether an invalid
   * chain string here 400s or is silently ignored.
   */
  chain: z.string().optional(),
  /** Optional, 1-50, default 25. */
  limit: z.number().int().min(1).max(50).optional().default(25),
});
export type GeneralSearchRequest = z.infer<typeof GeneralSearchRequest>;

export const TokenSearchResult = z.object({
  name: z.string(),
  symbol: z.string(),
  chain: z.string(),
  address: z.string(),
  /** Nullable/optional per docs — "may be delayed"; anyOf[number] with no default. */
  price: z.number().nullable().optional(),
  volume_24h: z.number().nullable().optional(),
  market_cap: z.number().nullable().optional(),
  /** Lower is better. */
  rank: z.number().int().nullable().optional(),
});
export type TokenSearchResult = z.infer<typeof TokenSearchResult>;

export const EntitySearchResult = z.object({
  name: z.string(),
  tags: z.array(z.string()).optional().default([]),
  rank: z.number().int().nullable().optional(),
});
export type EntitySearchResult = z.infer<typeof EntitySearchResult>;

export const GeneralSearchResponse = z.object({
  tokens: z.array(TokenSearchResult).optional().default([]),
  entities: z.array(EntitySearchResult).optional().default([]),
  total_results: z.number().int(),
});
export type GeneralSearchResponse = z.infer<typeof GeneralSearchResponse>;

// ---------------------------------------------------------------------------
// POST /api/v1/search/entity-name
// ---------------------------------------------------------------------------

export const EntityNameSearchRequest = z.object({
  /** Required, 2-100 chars, case-insensitive substring match. */
  search_query: z.string().min(2).max(100),
});
export type EntityNameSearchRequest = z.infer<typeof EntityNameSearchRequest>;

export const EntityNameSearchItem = z.object({
  entity_name: z.string(),
});
export type EntityNameSearchItem = z.infer<typeof EntityNameSearchItem>;

/** No pagination — capped at 100 results, ordered alphabetically, per docs. */
export const EntityNameSearchResponse = z.object({
  data: z.array(EntityNameSearchItem),
});
export type EntityNameSearchResponse = z.infer<typeof EntityNameSearchResponse>;

// ---------------------------------------------------------------------------
// GET /api/v1/search/token-sectors
// ---------------------------------------------------------------------------

/** No request body/query parameters. */
export const TokenSectorsRequest = z.object({});
export type TokenSectorsRequest = z.infer<typeof TokenSectorsRequest>;

export const TokenSectorItem = z.object({
  sector: z.string(),
});
export type TokenSectorItem = z.infer<typeof TokenSectorItem>;

export const TokenSectorsResponse = z.object({
  data: z.array(TokenSectorItem),
});
export type TokenSectorsResponse = z.infer<typeof TokenSectorsResponse>;
