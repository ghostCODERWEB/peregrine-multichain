import { z } from "zod";

/**
 * Chain Rank family. Source: docs/raw/chain-rank.md
 *  - POST /api/v1/chains/chain-rank (ChainRankRequest / ChainRankListResponse)
 *
 * Credit cost: 1. No `chain`/`chains` request field — this endpoint ranks
 * ALL chains at once, so it's intentionally absent from
 * src/types/nansen/chain-enums.ts's CHAIN_ENUMS registry (see that file's
 * top comment).
 */

export const ChainRankTimeFrame = z.union([z.literal(7), z.literal(30), z.literal(365)]);
export type ChainRankTimeFrame = z.infer<typeof ChainRankTimeFrame>;

export const ChainRankChainType = z.enum(["all", "evm"]);
export type ChainRankChainType = z.infer<typeof ChainRankChainType>;

export const ChainRankRequest = z.object({
  time_frame: ChainRankTimeFrame.optional().default(7),
  chain_type: ChainRankChainType.optional().default("all"),
});
export type ChainRankRequest = z.infer<typeof ChainRankRequest>;

/**
 * Only `chain` is required per the docs; every metric field is optional and
 * anyOf-wrapped with no null variant shown — modeled as nullable+optional,
 * matching this codebase's convention for that pattern on non-required
 * response fields.
 */
export const ChainRankResponse = z.object({
  chain: z.string(),
  transaction_count: z.number().int().nullable().optional(),
  transaction_count_percent_change: z.number().nullable().optional(),
  successful_transaction_count: z.number().int().nullable().optional(),
  successful_transaction_count_percent_change: z.number().nullable().optional(),
  total_gas_used_usd: z.number().nullable().optional(),
  total_gas_used_usd_percent_change: z.number().nullable().optional(),
  total_dex_volume_usd: z.number().nullable().optional(),
  total_dex_volume_usd_percent_change: z.number().nullable().optional(),
  active_address_count_traces: z.number().int().nullable().optional(),
  active_address_count_traces_percent_change: z.number().nullable().optional(),
  active_address_count_txs: z.number().int().nullable().optional(),
  active_address_count_txs_percent_change: z.number().nullable().optional(),
  revenue_usd: z.number().nullable().optional(),
  revenue_usd_percent_change: z.number().nullable().optional(),
  tvl_usd: z.number().nullable().optional(),
  tvl_usd_percent_change: z.number().nullable().optional(),
});
export type ChainRankResponse = z.infer<typeof ChainRankResponse>;

export const ChainRankListResponse = z.object({
  data: z.array(ChainRankResponse),
});
export type ChainRankListResponse = z.infer<typeof ChainRankListResponse>;
