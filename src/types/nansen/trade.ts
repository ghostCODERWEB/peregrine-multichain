import { z } from "zod";
import { CHAIN_ENUMS } from "./chain-enums";

/**
 * Trade family. Source: docs/raw/trade-quote.md
 *  - GET /api/v1/trade/quote (query params; TradingQuoteResponse)
 *
 * Note: the doc's prose references a companion `POST /api/v1/trade/prepare`
 * endpoint ("pass the quote you pick to /api/v1/trade/prepare to get a
 * transaction ready to sign"), but that endpoint is NOT one of the 38 pages
 * fetched into docs/raw/*.md (no trade-prepare.md exists), so it is
 * intentionally not modeled here — only /trade/quote is documented in our
 * source material.
 *
 * Credit cost: not listed in docs/raw/credits.md's endpoint table for
 * `trade/quote` — undocumented. TODO: verify against live response.
 */

export const TradeQuoteChain = z.enum(CHAIN_ENUMS.tradeQuote);
export type TradeQuoteChain = z.infer<typeof TradeQuoteChain>;

/**
 * GET query parameters (not a JSON body — this is a `GET` endpoint).
 * `chain` and `to_chain` share the same `solana`/`base` enum per the docs.
 */
export const TradingQuoteRequest = z.object({
  /** Required. Source chain. */
  chain: TradeQuoteChain,
  /** Optional. Destination chain for a cross-chain (bridge) swap. */
  to_chain: TradeQuoteChain.optional(),
  /** Required. Sell token contract address. */
  from_token: z.string(),
  /** Required. Buy token contract address. */
  to_token: z.string(),
  /** Required. Amount in base units (integer string, e.g. "1000000000"). */
  amount: z.string(),
  /** Required. Wallet address used for quote personalisation. */
  wallet_address: z.string(),
  /**
   * Optional. Destination wallet address for cross-chain swaps — required
   * (by the endpoint's runtime validation, not enforced by this schema) when
   * bridging between EVM and Solana.
   */
  to_wallet_address: z.string().optional(),
  /** Optional. Slippage in bps, 0-10000. Default 50 (0.5%). */
  slippage: z.number().int().min(0).max(10000).optional().default(50),
});
export type TradingQuoteRequest = z.infer<typeof TradingQuoteRequest>;

/**
 * The docs give this response essentially no schema: `quotes` is an array of
 * `{}` (unspecified item shape) and the object allows `additionalProperties`.
 * The prose says each quote carries "unsigned transaction data ready to
 * sign" and that the `transaction` field's shape varies by route (a standard
 * EVM tx on Base, a serialized Solana tx, or routing instructions for
 * Solana-out cross-chain swaps), but no field-level schema is given.
 * TODO: verify against live response — docs do not enumerate quote item
 * fields (e.g. price, route, `transaction`) at all; modeled as an open
 * record rather than guessed.
 */
export const TradingQuote = z.record(z.string(), z.unknown());
export type TradingQuote = z.infer<typeof TradingQuote>;

export const TradingQuoteResponse = z
  .object({
    quotes: z.array(TradingQuote).optional().default([]),
  })
  .catchall(z.unknown());
export type TradingQuoteResponse = z.infer<typeof TradingQuoteResponse>;
