// Schemas for the Nansen endpoints the published OpenAPI does not describe
// (the "schema-less" rows of the endpoint ledger). Written from live
// responses and the API's own validation errors (2026-09-23); loose, so a
// new field never breaks parsing, and checked at runtime like the rest.
import { z } from 'zod';

/** POST /api/v1/ra-agent/posts-by-token — body: { date: {from, to},
 *  token_symbol, pagination, order_by }. Social posts mentioning the
 *  token's symbol. 5 credits. */
export const S_RaPost = z.looseObject({
  username: z.string(),
  timestamp: z.string(),
  text: z.string().nullish(),
  likes: z.number().nullish(),
  views: z.number().nullish(),
  tweet_id: z.string().nullish(),
});
export type RaPost = z.infer<typeof S_RaPost>;
export const S_RaPostsResponse = z.looseObject({
  data: z.array(S_RaPost),
  pagination: z.looseObject({ page: z.number().nullish(), per_page: z.number().nullish(), is_last_page: z.boolean().nullish() }).nullish(),
});
export type RaPostsResponse = z.infer<typeof S_RaPostsResponse>;

/** POST /api/v1/search/web-search — body: { queries: string[], num_results }.
 *  5 credits, 15 requests/minute. */
export const S_WebSearchResult = z.looseObject({
  title: z.string().nullish(),
  link: z.string(),
  snippet: z.string().nullish(),
  date: z.string().nullish(),
});
export const S_WebSearchResponse = z.looseObject({
  results: z.array(z.looseObject({ query: z.string().nullish(), organic: z.array(S_WebSearchResult).nullish() })),
});
export type WebSearchResponse = z.infer<typeof S_WebSearchResponse>;

/** POST /api/v1/search/web-fetch — body: { urls: string[], question }.
 *  Nansen fetches the pages and answers the question. 20 credits. */
export const S_WebFetchResponse = z.looseObject({
  analysis: z.string(),
  urls_requested: z.number().nullish(),
  retrieved_urls: z.array(z.string()).nullish(),
  failed_urls: z.array(z.string()).nullish(),
});
export type WebFetchResponse = z.infer<typeof S_WebFetchResponse>;
