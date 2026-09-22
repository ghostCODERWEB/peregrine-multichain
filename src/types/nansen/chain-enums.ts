/**
 * Per-endpoint supported-chain enums, captured verbatim from docs/raw/*.md.
 *
 * IMPORTANT: chain support varies by endpoint family AND by individual endpoint
 * within a family. Do NOT assume two endpoints share a chain list just because
 * they belong to the same product area — several near-identical-looking lists
 * differ by one or two chains (e.g. TokenScreenerChain includes "citrea" but
 * TGMHoldersChain does not). Each key below is sourced from the specific
 * OpenAPI enum embedded in that endpoint's doc page. Where two endpoints'
 * OpenAPI schemas reference the literal same named component (e.g. "TGMChain"
 * is reused by /tgm/dex-trades, /tgm/indicators, /tgm/token-information,
 * /tgm/who-bought-sold, and /tgm/historical-token-quant-scores), the arrays
 * are equal by construction — this is verified from the docs, not assumed.
 *
 * This file intentionally does NOT export one shared "all chains" list for
 * request validation — use the specific endpoint key. `ALL_SUPPORTED_CHAINS`
 * at the bottom is the reference/master list from docs/raw/chains.md and is
 * for display/reference only (e.g. building a chain picker UI), not for
 * validating any single endpoint's `chain`/`chains` field.
 */

// ---------------------------------------------------------------------------
// Smart Money family — docs/raw/sm-netflows.md, sm-holdings.md, sm-dex-trades.md
// All three endpoints reference the same "SmartMoneyChain" OpenAPI component.
// ---------------------------------------------------------------------------
const SMART_MONEY_CHAIN = [
  "all",
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bnb",
  "ethereum",
  "hyperevm",
  "iotaevm",
  "linea",
  "mantle",
  "monad",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
] as const;

// ---------------------------------------------------------------------------
// Token God Mode family
// ---------------------------------------------------------------------------

// docs/raw/tgm-screener.md — TokenScreenerChain
const TOKEN_SCREENER_CHAIN = [
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bitcoin",
  "bnb",
  "citrea",
  "ethereum",
  "hyperevm",
  "injective",
  "iotaevm",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "starknet",
  "sui",
  "ton",
  "tron",
] as const;

// docs/raw/tgm-flow-intelligence.md — TGMFlowIntelligenceChain
const TGM_FLOW_INTELLIGENCE_CHAIN = [
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bnb",
  "ethereum",
  "hyperevm",
  "injective",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "starknet",
  "sui",
  "ton",
  "tron",
] as const;

// docs/raw/tgm-holders.md — TGMHoldersChain (note: no "citrea", unlike TokenScreenerChain)
const TGM_HOLDERS_CHAIN = [
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bitcoin",
  "bnb",
  "ethereum",
  "hyperevm",
  "injective",
  "iotaevm",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "starknet",
  "sui",
  "ton",
  "tron",
] as const;

// docs/raw/tgm-dex-trades.md, tgm-indicators.md, tgm-token-information.md,
// tgm-who-bought-sold.md — all reference the shared "TGMChain" OpenAPI component.
const TGM_CHAIN = [
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bnb",
  "ethereum",
  "hyperevm",
  "hyperliquid",
  "injective",
  "iotaevm",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "starknet",
  "sui",
  "ton",
  "tron",
] as const;

// docs/raw/tgm-flows.md — TGMFlowsChain (values currently identical to TGM_CHAIN,
// but kept as a distinct named component per the docs — do not merge).
const TGM_FLOWS_CHAIN = [
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bnb",
  "ethereum",
  "hyperevm",
  "hyperliquid",
  "injective",
  "iotaevm",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "starknet",
  "sui",
  "ton",
  "tron",
] as const;

// docs/raw/tgm-ohlcv.md — TGMOHLCVChain (much broader: includes non-EVM chains
// with no other TGM support, e.g. algorand, aptos, stacks, stellar, viction).
const TGM_OHLCV_CHAIN = [
  "algorand",
  "aptos",
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bitcoin",
  "bitlayer",
  "bnb",
  "chiliz",
  "ethereum",
  "gravity",
  "hyperevm",
  "hyperliquid",
  "injective",
  "iotaevm",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "stacks",
  "starknet",
  "stellar",
  "sui",
  "ton",
  "tron",
  "viction",
] as const;

// docs/raw/tgm-pnl-leaderboard.md — TGMPnLLeaderboardChain
const TGM_PNL_LEADERBOARD_CHAIN = [
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bnb",
  "ethereum",
  "hyperevm",
  "hyperliquid",
  "linea",
  "mantle",
  "monad",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "sui",
] as const;

// docs/raw/tgm-perp-screener.md — no `chain` field at all (Hyperliquid perps
// dataset only; the request has no chain/chains parameter).

// docs/raw/tgm-perp-positions.md — no `chain` field (Hyperliquid only).

// ---------------------------------------------------------------------------
// Profiler family
// ---------------------------------------------------------------------------

// docs/raw/profiler-balances.md, profiler-counterparties.md — ProfilerChain
const PROFILER_CHAIN = [
  "all",
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bitcoin",
  "bnb",
  "ethereum",
  "hyperevm",
  "injective",
  "iotaevm",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "starknet",
  "sui",
  "ton",
  "tron",
] as const;

// docs/raw/profiler-first-funder.md — fixed to "all" only
const PROFILER_FIRST_FUNDER_CHAIN = ["all"] as const;

// docs/raw/profiler-pnl.md — ProfilerPnLChain (used by both pnl-summary and pnl)
const PROFILER_PNL_CHAIN = [
  "all",
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bnb",
  "ethereum",
  "linea",
  "mantle",
  "monad",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "sui",
] as const;

// docs/raw/profiler-related-wallets.md — ProfilerAddressRelatedWalletsChain
// (no "all", no "hyperevm" — differs from PROFILER_CHAIN)
const PROFILER_RELATED_WALLETS_CHAIN = [
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bitcoin",
  "bnb",
  "ethereum",
  "injective",
  "iotaevm",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "starknet",
  "sui",
  "ton",
  "tron",
] as const;

// docs/raw/profiler-transactions.md — ProfilerTransactionsChain
// (has "all" but, unlike PROFILER_CHAIN, no "hyperevm")
const PROFILER_TRANSACTIONS_CHAIN = [
  "all",
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bitcoin",
  "bnb",
  "ethereum",
  "injective",
  "iotaevm",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "polygon",
  "robinhood",
  "sei",
  "solana",
  "sonic",
  "starknet",
  "sui",
  "ton",
  "tron",
] as const;

// docs/raw/profiler-transactions.md — TransactionLookupChain, for
// POST /api/v1/transaction-with-token-transfer-lookup. Notably has NO "solana"
// (matches chains.md's note that Solana transaction lookup is not supported).
const TRANSACTION_LOOKUP_CHAIN = [
  "all",
  "arbitrum",
  "arc",
  "avalanche",
  "base",
  "bitcoin",
  "bnb",
  "ethereum",
  "hyperevm",
  "injective",
  "iotaevm",
  "linea",
  "mantle",
  "mantra",
  "monad",
  "near",
  "optimism",
  "plasma",
  "robinhood",
  "sei",
  "sonic",
  "starknet",
  "sui",
  "ton",
  "tron",
] as const;

// ---------------------------------------------------------------------------
// Trade family — docs/raw/trade-quote.md
// ---------------------------------------------------------------------------
const TRADE_QUOTE_CHAIN = ["solana", "base"] as const;

// ---------------------------------------------------------------------------
// Backtesting Data family (all under /api/v1beta1/*, Beta — subject to
// breaking changes per the docs)
// ---------------------------------------------------------------------------

// docs/raw/hist-address-balance.md — ProfilerHistoricalTokenBalancesChain
const HIST_PROFILER_TOKEN_BALANCES_CHAIN = [
  "all",
  "base",
  "bnb",
  "ethereum",
  "mantra",
  "solana",
] as const;

// docs/raw/hist-dex-trades.md — TGMHistoricalDexTradesChain
const HIST_TGM_DEX_TRADES_CHAIN = ["base", "bnb", "ethereum", "solana"] as const;

// docs/raw/hist-flow-summary.md and hist-pnl-leaderboard.md — both reference
// the shared "TGMHistoricalChain" OpenAPI component.
const HIST_TGM_CHAIN = ["base", "bnb", "ethereum", "solana"] as const;

// docs/raw/hist-ohlcv.md — HistoricalTokenOHLCVChain (adds hyperliquid)
const HIST_TGM_TOKEN_OHLCV_CHAIN = [
  "base",
  "bnb",
  "ethereum",
  "hyperliquid",
  "solana",
] as const;

// docs/raw/hist-quant-scores.md — reuses the shared "TGMChain" component
// (identical to TGM_CHAIN above).
const HIST_TGM_TOKEN_QUANT_SCORES_CHAIN = TGM_CHAIN;

// docs/raw/hist-screener.md — reuses the shared "TokenScreenerChain" component
// (identical to TOKEN_SCREENER_CHAIN above).
const HIST_TOKEN_SCREENER_CHAIN = TOKEN_SCREENER_CHAIN;

// ---------------------------------------------------------------------------
// Registry: one key per endpoint (see the per-family Zod files in this
// directory for how each key is consumed). Endpoints with no chain/chains
// parameter at all (Chain Rank, Agent fast/expert, Smart Alerts, TGM Perp
// Screener, TGM Perp Positions) are intentionally absent.
// ---------------------------------------------------------------------------
export const CHAIN_ENUMS = {
  // Smart Money
  smartMoneyNetflows: SMART_MONEY_CHAIN,
  smartMoneyHoldings: SMART_MONEY_CHAIN,
  smartMoneyDexTrades: SMART_MONEY_CHAIN,

  // Token God Mode
  tokenScreener: TOKEN_SCREENER_CHAIN,
  tgmFlowIntelligence: TGM_FLOW_INTELLIGENCE_CHAIN,
  tgmHolders: TGM_HOLDERS_CHAIN,
  tgmDexTrades: TGM_CHAIN,
  tgmFlows: TGM_FLOWS_CHAIN,
  tgmIndicators: TGM_CHAIN,
  tgmTokenInformation: TGM_CHAIN,
  tgmWhoBoughtSold: TGM_CHAIN,
  tgmTokenOhlcv: TGM_OHLCV_CHAIN,
  tgmPnlLeaderboard: TGM_PNL_LEADERBOARD_CHAIN,

  // Profiler
  profilerCurrentBalance: PROFILER_CHAIN,
  profilerCounterparties: PROFILER_CHAIN,
  profilerFirstFunder: PROFILER_FIRST_FUNDER_CHAIN,
  profilerPnlSummary: PROFILER_PNL_CHAIN,
  profilerPnl: PROFILER_PNL_CHAIN,
  profilerRelatedWallets: PROFILER_RELATED_WALLETS_CHAIN,
  profilerTransactions: PROFILER_TRANSACTIONS_CHAIN,
  transactionWithTokenTransferLookup: TRANSACTION_LOOKUP_CHAIN,

  // Trade
  tradeQuote: TRADE_QUOTE_CHAIN,

  // Backtesting Data (Beta)
  histProfilerTokenBalances: HIST_PROFILER_TOKEN_BALANCES_CHAIN,
  histTgmDexTrades: HIST_TGM_DEX_TRADES_CHAIN,
  histTgmTokenFlowSummary: HIST_TGM_CHAIN,
  histTgmPnlLeaderboard: HIST_TGM_CHAIN,
  histTgmTokenOhlcv: HIST_TGM_TOKEN_OHLCV_CHAIN,
  histTgmTokenQuantScores: HIST_TGM_TOKEN_QUANT_SCORES_CHAIN,
  histTokenScreener: HIST_TOKEN_SCREENER_CHAIN,
} as const satisfies Record<string, readonly string[]>;

export type ChainEnumKey = keyof typeof CHAIN_ENUMS;

/**
 * Reference-only master list of all 38 chains Nansen documents in
 * docs/raw/chains.md, split by EVM / non-EVM as the doc does. NOT tied to any
 * single endpoint — do not use this to validate a request's `chain` field;
 * use the matching key in `CHAIN_ENUMS` instead.
 */
export const ALL_SUPPORTED_CHAINS = {
  evm: [
    "arbitrum",
    "arc",
    "avalanche",
    "base",
    "bitlayer",
    "bnb",
    "chiliz",
    "citrea",
    "ethereum",
    "gravity",
    "hyperevm",
    "iotaevm",
    "katana",
    "linea",
    "mantle",
    "metis",
    "monad",
    "optimism",
    "plasma",
    "polygon",
    "robinhood",
    "sei",
    "sonic",
    "viction",
  ],
  nonEvm: [
    "algorand",
    "aptos",
    "bitcoin",
    "hyperliquid",
    "injective",
    "mantra",
    "near",
    "solana",
    "stacks",
    "starknet",
    "stellar",
    "sui",
    "ton",
    "tron",
  ],
} as const;
