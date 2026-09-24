// The endpoint ledger: every Nansen API operation, its redistribution class
// (from Nansen's Data Redistribution Guidelines, docs/raw/guides__redistribution-guide.md)
// and where TIDE uses it. The superapp's coverage goal is measured here:
// an entry is either `usedBy` shipped modules, `planned` for a module not
// built yet, or `skipped` with a written reason. endpoint-ledger.test.ts
// fails if the docs list an operation this file doesn't account for.
//
// Classes:
//   free        — may be shown publicly, no conditions
//   attribution — public only with a visible "Powered by Nansen API" link
//   restricted  — smart-money data: public only with Nansen's approval AND
//                 significant modification combined with an independent
//                 source (which a Nansen-only app can't provide) — so, in
//                 practice, private mode only
//   prohibited  — never in any public or customer-facing surface
//   account     — acts on the key owner's own account (alerts, trading,
//                 balance); not data redistribution, private mode only
// Unlisted endpoints get the conservative class of their family.

export type RedistributionClass = 'free' | 'attribution' | 'restricted' | 'prohibited' | 'account';
export type ModuleId =
  | 'weather' | 'chain' | 'token' | 'wallet' | 'lab' | 'anchor' | 'alerts' | 'ride' | 'coverage'
  | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9' | 'M10';

export interface LedgerEntry {
  key: string;
  class: RedistributionClass;
  usedBy?: ModuleId[];
  planned?: ModuleId;
  skipped?: string;
  note?: string;
}

const e = (key: string, cls: RedistributionClass, rest: Omit<LedgerEntry, 'key' | 'class'> = {}): LedgerEntry => ({ key, class: cls, ...rest });

const PM_USE: Record<string, Omit<LedgerEntry, 'key' | 'class'>> = {
  'address-summary': { usedBy: ['M3', 'M6'], note: 'wallet desk record; /predict checks the largest holders\' records (cached a day)' },
  'trades-by-address': { usedBy: ['M3'], note: 'wallet desk predictions' },
  'pnl-by-address': { usedBy: ['M3'], note: 'wallet desk: PnL by market' },
  categories: { usedBy: ['M6'], note: 'category weather' },
  'event-screener': { usedBy: ['M6'], note: 'busiest events' },
  'market-screener': { usedBy: ['M6'], note: 'markets, implied probabilities, repricing' },
  ohlcv: { usedBy: ['M6'], note: 'market detail: YES probability, hourly' },
  orderbook: { usedBy: ['M6'], note: 'market detail: order book depth' },
  'top-holders': { usedBy: ['M6'], note: 'market detail: who holds each side' },
  'trades-by-market': { usedBy: ['M6'], note: 'market detail: largest trades (sorted by TIDE; the endpoint sorts only by time)' },
  'pnl-by-market': { usedBy: ['M6'], note: 'records check: who is winning in the market' },
  'position-detail': { skipped: 'for these views it repeats top-holders (sizes, entries) plus pnl-by-market (profit), at 5 credits more per market' },
};

export const LEDGER: LedgerEntry[] = [
  // Agents
  e('POST /api/v1/agent/fast', 'restricted', { usedBy: ['anchor'], note: 'output inherits the class of its inputs; public mode feeds it public-class facts only' }),
  e('POST /api/v1/agent/expert', 'restricted', { usedBy: ['M7'], note: 'research agent: owner or members, price confirmed per question, EXPERT_DAILY_CAP; answers saved privately, never published' }),
  // Chains
  e('POST /api/v1/chains/chain-rank', 'attribution', { usedBy: ['chain'] }),
  // Perps / Hyperliquid
  e('POST /api/v1/perp-leaderboard', 'prohibited', { usedBy: ['M5'], note: 'copy-trade candidate scores (7d and 30d), private only' }),
  e('POST /api/v1/perp-screener', 'attribution', { usedBy: ['M5', 'weather'], note: 'hourly scanner snapshots for the Perp Pressure Index; restricted with trader_type=sm (owner view only)' }),
  e('POST /api/v1/tgm/perp-pnl-leaderboard', 'prohibited', { usedBy: ['M5'], note: 'coin PnL leaders on /perps, private only' }),
  e('POST /api/v1/tgm/perp-positions', 'restricted', { usedBy: ['token', 'M5'], note: 'restricted with a smart-money label filter; attribution without. The token page\'s liquidation ladder uses all_traders only (publicSafe)' }),
  e('POST /api/v1/tgm/perp-trades', 'attribution', { usedBy: ['M5'], note: 'coin trade tape on /perps; labels stripped in public views' }),
  e('POST /api/v1/profiler/perp-pnl-summary', 'free', { usedBy: ['M3'], note: 'wallet desk perps' }),
  e('POST /api/v1/profiler/perp-positions', 'free', { usedBy: ['M3'], note: 'wallet desk perps' }),
  e('POST /api/v1/profiler/perp-trades', 'free', { usedBy: ['M3'], note: 'wallet desk perps' }),
  e('POST /api/v1/smart-money/perp-trades', 'prohibited', { usedBy: ['M4'], note: 'desk perp tilt, private only; M5 reuses it' }),
  // Portfolio
  e('POST /api/v1/portfolio/defi-holdings', 'free', { usedBy: ['M3'], note: 'balance-type data; account-tied (no x402); wallet desk DeFi positions' }),
  // Prediction markets (M6 /predict; the wallet desk reads a wallet's own record)
  ...[
    'address-summary', 'categories', 'event-screener', 'market-screener', 'ohlcv', 'orderbook', 'pnl-by-address',
    'pnl-by-market', 'position-detail', 'top-holders', 'trades-by-address', 'trades-by-market',
  ].map((p) => e(`POST /api/v1/prediction-market/${p}`, 'attribution', PM_USE[p])),
  // Profiler
  e('POST /api/v1/profiler/address/counterparties', 'attribution', { usedBy: ['wallet', 'M1'], note: 'entity pages: entity_name, grouped by entity' }),
  e('POST /api/v1/profiler/address/counterparties/batch', 'attribution', { usedBy: ['M3'], note: 'portfolio: counterparties shared across a watch set' }),
  e('POST /api/v1/profiler/address/current-balance', 'free', { usedBy: ['wallet', 'M1'], note: 'entity pages: entity_name' }),
  e('POST /api/v1/profiler/address/first-funder', 'attribution', { usedBy: ['token', 'wallet'] }),
  e('POST /api/v1/profiler/address/historical-balances', 'free', { usedBy: ['M1', 'M3'], note: 'entity holdings trend (top 5 tokens, 30 days); wallet page in M3; wallet desk net worth over time' }),
  e('POST /api/v1/profiler/address/labels', 'prohibited', { usedBy: ['M3'], note: '100 credits; explicit per-address click only, private mode; on an explicit click with the price confirmed (428 otherwise)' }),
  e('POST /api/v1/profiler/address/premium-labels', 'prohibited', { usedBy: ['M3'], note: '500 credits; explicit per-address click only, private mode; on an explicit click with the price confirmed' }),
  e('POST /api/v1/profiler/address/pnl', 'free', { usedBy: ['M3'], note: 'wallet desk per-token PnL' }),
  e('POST /api/v1/profiler/address/pnl-summary', 'free', { usedBy: ['wallet', 'M1'], note: 'entity pages: entity_name' }),
  e('POST /api/v1/profiler/address/related-wallets', 'attribution', { usedBy: ['token', 'wallet'] }),
  e('POST /api/v1/profiler/address/transactions', 'attribution', { usedBy: ['wallet'] }),
  e('POST /api/v1/profiler/dex-trades', 'attribution', { usedBy: ['M3'], note: 'wallet desk DEX trades, one chain at a time (chain all is refused live)' }),
  e('POST /api/v1/transaction-with-token-transfer-lookup', 'attribution', { usedBy: ['M2'], note: 'token terminal: transaction drill-down on click' }),
  // Search
  e('POST /api/v1/search/entity-name', 'attribution', { usedBy: ['M1'], note: 'entity page name resolution and suggestions' }),
  e('POST /api/v1/search/general', 'attribution', { usedBy: ['M1'], note: 'the ⌘K omnibox (tokens, entities, contract addresses) and entity resolution' }),
  e('GET /api/v1/search/token-sectors', 'attribution', { usedBy: ['M1'], note: 'sector list for daily sector membership and the omnibox' }),
  // Smart alerts (the key owner's own account)
  e('POST /api/v1/smart-alert', 'account', { usedBy: ['alerts'] }),
  e('PATCH /api/v1/smart-alert', 'account', { usedBy: ['M7'], note: 'alert builder: rename, window, destination of TIDE\'s own alerts' }),
  e('DELETE /api/v1/smart-alert/{alert_id}', 'account', { usedBy: ['alerts'] }),
  e('GET /api/v1/smart-alert/list', 'account', { usedBy: ['alerts'] }),
  e('PATCH /api/v1/smart-alert/toggle', 'account', { usedBy: ['alerts'] }),
  // Smart money
  e('POST /api/v1/smart-money/dcas', 'prohibited', { usedBy: ['M4'], note: 'smart-money desk, private only' }),
  e('POST /api/v1/smart-money/dex-trades', 'prohibited', { usedBy: ['weather', 'chain', 'wallet'], note: 'rotation fronts, trade tape, migration trail: private mode only' }),
  e('POST /api/v1/smart-money/historical-holdings', 'prohibited', { usedBy: ['M4'], note: '1 credit per token, 30 daily rows; desk history on click, private only' }),
  e('POST /api/v1/smart-money/holdings', 'prohibited', { usedBy: ['M4'], note: 'conviction map and crowding, private only; Fund filter deprecated 23 Sep 2026' }),
  e('POST /api/v1/smart-money/netflow', 'restricted', { usedBy: ['chain'], note: '"smart-money inflows" in the guide' }),
  e('POST /api/v1/smart-money/pnl-leaderboard', 'prohibited', { usedBy: ['M4'], note: 'leaderboard, follow list and top-trader backing, private only' }),
  // Token God Mode
  e('POST /api/v1/tgm/dex-trades', 'attribution', { usedBy: ['M2'], note: 'token terminal: live DEX tape (labels stripped publicly)' }),
  e('POST /api/v1/tgm/flow-intelligence', 'attribution', { usedBy: ['token'] }),
  e('POST /api/v1/tgm/flows', 'attribution', { usedBy: ['token'] }),
  e('POST /api/v1/tgm/holders', 'attribution', { usedBy: ['token'], note: 'restricted when filtered to smart-money labels; holder labels are stripped in public mode' }),
  e('POST /api/v1/tgm/indicators', 'attribution', { usedBy: ['token'] }),
  e('POST /api/v1/tgm/jup-dca', 'attribution', { usedBy: ['M2'], note: 'token terminal: Solana DCA ladders and the DCA-overhang Storm candidate' }),
  e('POST /api/v1/tgm/pnl-leaderboard', 'prohibited', { usedBy: ['M2'], note: 'token terminal: owner and members only; never premium_labels' }),
  e('POST /api/v1/tgm/position-intelligence', 'restricted', { usedBy: ['M2'], note: 'perp tide gauge by cohort (smart traders, whales, public figures): owner and members only' }),
  e('POST /api/v1/tgm/token-information', 'attribution', { usedBy: ['token'] }),
  e('POST /api/v1/tgm/token-ohlcv', 'attribution', { usedBy: ['token', 'lab'] }),
  e('POST /api/v1/tgm/transfers', 'attribution', { usedBy: ['M2'], note: 'token terminal: whale-transfer river and anomalies (cohorts private only)' }),
  e('POST /api/v1/tgm/who-bought-sold', 'attribution', { usedBy: ['token'] }),
  e('POST /api/v1/token-screener', 'attribution', { usedBy: ['weather', 'chain', 'token', 'M1'], note: 'restricted with trader_type=sm (the CPI smart-money numerator); sectors filter builds sector membership' }),
  // Trading (the key owner's own account; user-signed only)
  e('GET /api/v1/trade/bridge-status', 'account', { skipped: 'tracks cross-chain spot routes, and TIDE\'s spot trading is same-chain on Base: nothing it offers creates one. It also rejects hyperliquid as to_chain, so Hyperliquid deposits use perp/bridge/status instead', note: 'still wired in /api/trade (action "bridge") for a future cross-chain spot route' }),
  e('POST /api/v1/trade/execute', 'account', { usedBy: ['M8'], note: 'broadcasts a swap the user signed in their own wallet (wallets that sign without sending); TIDE never signs' }),
  e('POST /api/v1/trade/prepare', 'account', { usedBy: ['M8'], note: 'builds and simulates the swap; nothing is broadcast' }),
  e('GET /api/v1/trade/quote', 'account', { usedBy: ['ride', 'M8'] }),
  // Backtesting (v1beta1)
  e('POST /api/v1beta1/profiler/address/historical-token-balances', 'free', { skipped: 'wallet balances at a past date: no TIDE score is rebuilt per wallet; the live net-worth chart uses profiler/address/historical-balances' }),
  e('POST /api/v1beta1/profiler/address/historical-transactions', 'attribution', { skipped: 'per-wallet transaction history at a date: no Storm input or forward check needs it' }),
  e('POST /api/v1beta1/profiler/historical-transaction-lookup', 'attribution', { skipped: 'the transaction drawer uses transaction-with-token-transfer-lookup, which resolves a hash without a block timestamp' }),
  e('POST /api/v1beta1/smart-money/historical-token-balances', 'prohibited', { skipped: 'Storm has no smart-money balance input; the conviction history uses smart-money/historical-holdings' }),
  e('POST /api/v1beta1/tgm/historical-dex-trades', 'attribution', { skipped: 'Storm v2 reads sell pressure from historical who-bought-sold; per-trade history adds cost without a new input' }),
  e('POST /api/v1beta1/tgm/historical-pnl-leaderboard', 'prohibited', { skipped: '25 credits a token-date for an input the Storm model does not have; the fit is budget-bound already (see the Lab)' }),
  e('POST /api/v1beta1/tgm/historical-token-flow-summary', 'attribution', { usedBy: ['M9'], note: 'Storm v2: wind shear as of a date' }),
  e('POST /api/v1beta1/tgm/historical-token-ohlcv', 'attribution', { usedBy: ['M9'], note: 'Storm v2: the 7 days after each date (labels)' }),
  e('POST /api/v1beta1/tgm/historical-token-quant-scores', 'attribution', { usedBy: ['M9'], note: 'Storm v2: Nansen risk and liquidity-risk percentiles as of a date (empty for unscored tokens)' }),
  e('POST /api/v1beta1/tgm/historical-top-holders', 'attribution', { usedBy: ['M9'], note: 'Storm v2: concentration as of a date' }),
  e('POST /api/v1beta1/tgm/historical-who-bought-sold', 'attribution', { usedBy: ['M9'], note: 'Storm v2: sell pressure over the 7 days before a date' }),
  e('POST /api/v1beta1/token-screener/historical', 'attribution', { usedBy: ['lab'] }),
];

/** Documented operations that ship without an embedded OpenAPI schema. */
export interface ExtraEndpoint extends LedgerEntry { credits: number | null; notes: string }

export const EXTRA_ENDPOINTS: ExtraEndpoint[] = [
  { key: 'GET /api/v1/account', class: 'account', credits: 0, usedBy: ['coverage'], notes: 'credit balance and plan in the header; free, API key only. Live: {user_id, plan, credits_remaining}' },
  { key: 'POST /api/v1/ra-agent/posts-by-token', class: 'attribution', credits: 5, usedBy: ['M2'], notes: 'body {date, token_symbol, pagination, order_by} → {data: [{username, timestamp, text, likes, views, tweet_id}]}; token social pulse and the social-heat Storm candidate' },
  { key: 'POST /api/v1/ra-agent/posts-by-user', class: 'attribution', credits: 5, usedBy: ['M2'], notes: 'token terminal: an author\'s week on click (reach, cashtag breadth); body {date, username, pagination}; cached an hour' },
  { key: 'POST /api/v1/search/web-search', class: 'attribution', credits: 5, usedBy: ['M2'], notes: 'body {queries: string[], num_results} → {results: [{query, organic: [{title, link, snippet, date}]}]}; token news on click, 15 requests/minute' },
  { key: 'POST /api/v1/search/web-fetch', class: 'attribution', credits: 20, usedBy: ['M2'], notes: 'body {urls: string[], question} → {analysis, retrieved_urls, failed_urls}; article summary on click, owner and members only, hourly cap' },
  { key: 'GET /api/v1/perp/builder-fee', class: 'account', credits: 1, usedBy: ['M8'], notes: 'Hyperliquid builder-fee status (1 credit): {approved, max_fee_rate, required_fee (tenths of a bp), builder_address}' },
  { key: 'POST /api/v1/perp/approve-builder-fee', class: 'account', credits: 0, usedBy: ['M8'], notes: 'prepares the one-time approval the wallet signs itself' },
  { key: 'POST /api/v1/perp/order', class: 'account', credits: 0, usedBy: ['M8'], notes: 'prepares a market order; EIP-712 domain "Exchange", chainId 1337 (browser wallets bound to their network may refuse)' },
  { key: 'POST /api/v1/perp/close', class: 'account', credits: 0, usedBy: ['M8'], notes: 'prepares a reduce-only close' },
  { key: 'POST /api/v1/perp/execute', class: 'account', credits: 0, usedBy: ['M8'], notes: 'submits the prepared action, nonce and the user\'s signature, byte-for-byte' },
  { key: 'POST /api/v1/perp/bridge/quote', class: 'account', credits: 0, usedBy: ['M8'], notes: '/trade: deposit USDC to perps from Base, Arbitrum, Ethereum or Polygon; the quote is checked (amount and scale, perps destination, wallet, chain, exact approval to the deposit contract) before the wallet sees a transaction' },
  { key: 'GET /api/v1/perp/account', class: 'account', credits: 1, usedBy: ['M8'], notes: 'perps margin and spot USDC for the connected wallet' },
  { key: 'GET /api/v1/perp/positions', class: 'account', credits: 1, usedBy: ['M8'], notes: 'open positions for the connected wallet; source of truth for closing' },
  { key: 'GET /api/v1/perp/orders', class: 'account', credits: 1, usedBy: ['M8'], notes: '/trade resting orders with cancel (perp coins only; spot orders like "@156" share the list); header reported 0 credits live' },
  { key: 'GET /api/v1/perp/meta', class: 'account', credits: 1, skipped: 'TIDE uses its own perp-screener snapshots for symbols and marks; prepare echoes the rounded size and price', notes: 'symbols, size precision, max leverage' },
  { key: 'POST /api/v1/perp/leverage', class: 'account', credits: 0, usedBy: ['M8'], notes: '/trade: body {wallet_address, coin, leverage 1-200, is_cross}; applies to positions opened afterwards' },
  { key: 'POST /api/v1/perp/cancel', class: 'account', credits: 0, usedBy: ['M8'], notes: '/trade: body {wallet_address, coin, order_id}; one order per call' },
  { key: 'POST /api/v1/perp/transfer', class: 'account', credits: 0, usedBy: ['M8'], notes: '/trade: body {wallet_address, amount, to_perp}; wallet-signed domain HyperliquidSignTransaction, chainId 421614' },
  { key: 'POST /api/v1/perp/bridge/execute', class: 'account', credits: 0, skipped: 'withdrawals only: a generic {target_url, body} proxy, and the quote names only relative paths (a Relay "/authorize" plus a Hyperliquid sendAsset), so TIDE would be guessing third-party URLs for a funds-moving flow it cannot verify without moving real money. Withdraw on Hyperliquid', notes: 'body {target_url (HTTPS only), body}' },
  { key: 'GET /api/v1/perp/bridge/status', class: 'account', credits: 0, usedBy: ['M8'], notes: '/trade: polls a deposit by the quote\'s request_id until success, refund or failure' },
  { key: 'GET app.nansen.ai/api/points-leaderboard/api', class: 'free', credits: null, usedBy: ['M3'], notes: 'wallet desk: rank, percentile and eligibility floor by bisection (addresses dropped, cached 12 h); offset is page × recordsPerPage, so the top page is unreadable' },
  { key: 'GET app.nansen.ai/api/points-leaderboard/{address}', class: 'free', credits: null, usedBy: ['M3'], notes: 'public, keyless tier lookup; wallet desk points tier' },
];

export const ALL_LEDGER: LedgerEntry[] = [...LEDGER, ...EXTRA_ENDPOINTS];

export function coverageStats() {
  const used = ALL_LEDGER.filter((l) => l.usedBy?.length).length;
  const planned = ALL_LEDGER.filter((l) => !l.usedBy?.length && l.planned).length;
  const skipped = ALL_LEDGER.filter((l) => !l.usedBy?.length && !l.planned && l.skipped).length;
  return { total: ALL_LEDGER.length, used, planned, skipped, usedPct: used / ALL_LEDGER.length };
}
