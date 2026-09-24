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

export const LEDGER: LedgerEntry[] = [
  // Agents
  e('POST /api/v1/agent/fast', 'restricted', { usedBy: ['anchor'], note: 'output inherits the class of its inputs; public mode feeds it public-class facts only' }),
  e('POST /api/v1/agent/expert', 'restricted', { planned: 'M7' }),
  // Chains
  e('POST /api/v1/chains/chain-rank', 'attribution', { usedBy: ['chain'] }),
  // Perps / Hyperliquid
  e('POST /api/v1/perp-leaderboard', 'prohibited', { planned: 'M5' }),
  e('POST /api/v1/perp-screener', 'attribution', { planned: 'M5' }),
  e('POST /api/v1/tgm/perp-pnl-leaderboard', 'prohibited', { planned: 'M5' }),
  e('POST /api/v1/tgm/perp-positions', 'restricted', { usedBy: ['token'], note: 'restricted with a smart-money label filter; attribution without. The token page\'s liquidation ladder uses all_traders only (publicSafe)' }),
  e('POST /api/v1/tgm/perp-trades', 'attribution', { planned: 'M5' }),
  e('POST /api/v1/profiler/perp-pnl-summary', 'free', { usedBy: ['M3'], note: 'wallet desk perps' }),
  e('POST /api/v1/profiler/perp-positions', 'free', { usedBy: ['M3'], note: 'wallet desk perps' }),
  e('POST /api/v1/profiler/perp-trades', 'free', { usedBy: ['M3'], note: 'wallet desk perps' }),
  e('POST /api/v1/smart-money/perp-trades', 'prohibited', { usedBy: ['M4'], note: 'desk perp tilt, private only; M5 reuses it' }),
  // Portfolio
  e('POST /api/v1/portfolio/defi-holdings', 'free', { usedBy: ['M3'], note: 'balance-type data; account-tied (no x402); wallet desk DeFi positions' }),
  // Prediction markets
  ...[
    'address-summary', 'categories', 'event-screener', 'market-screener', 'ohlcv', 'orderbook', 'pnl-by-address',
    'pnl-by-market', 'position-detail', 'top-holders', 'trades-by-address', 'trades-by-market',
  ].map((p) => e(`POST /api/v1/prediction-market/${p}`, 'attribution', ['address-summary', 'trades-by-address'].includes(p)
    ? { usedBy: ['M3'], planned: 'M6', note: 'wallet desk predictions; the M6 prediction desk adds more' }
    : { planned: 'M6' })),
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
  e('PATCH /api/v1/smart-alert', 'account', { planned: 'M7' }),
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
  e('GET /api/v1/trade/bridge-status', 'account', { planned: 'M8' }),
  e('POST /api/v1/trade/execute', 'account', { planned: 'M8', note: 'submits a transaction the user signed in their own wallet; TIDE never signs' }),
  e('POST /api/v1/trade/prepare', 'account', { planned: 'M8' }),
  e('GET /api/v1/trade/quote', 'account', { usedBy: ['ride'] }),
  // Backtesting (v1beta1)
  e('POST /api/v1beta1/profiler/address/historical-token-balances', 'free', { planned: 'M9' }),
  e('POST /api/v1beta1/profiler/address/historical-transactions', 'attribution', { planned: 'M9' }),
  e('POST /api/v1beta1/profiler/historical-transaction-lookup', 'attribution', { planned: 'M9' }),
  e('POST /api/v1beta1/smart-money/historical-token-balances', 'prohibited', { planned: 'M9' }),
  e('POST /api/v1beta1/tgm/historical-dex-trades', 'attribution', { planned: 'M9' }),
  e('POST /api/v1beta1/tgm/historical-pnl-leaderboard', 'prohibited', { planned: 'M9' }),
  e('POST /api/v1beta1/tgm/historical-token-flow-summary', 'attribution', { planned: 'M9' }),
  e('POST /api/v1beta1/tgm/historical-token-ohlcv', 'attribution', { planned: 'M9' }),
  e('POST /api/v1beta1/tgm/historical-token-quant-scores', 'attribution', { planned: 'M9' }),
  e('POST /api/v1beta1/tgm/historical-top-holders', 'attribution', { planned: 'M9' }),
  e('POST /api/v1beta1/tgm/historical-who-bought-sold', 'attribution', { planned: 'M9' }),
  e('POST /api/v1beta1/token-screener/historical', 'attribution', { usedBy: ['lab'] }),
];

/** Documented operations that ship without an embedded OpenAPI schema. */
export interface ExtraEndpoint extends LedgerEntry { credits: number | null; notes: string }

export const EXTRA_ENDPOINTS: ExtraEndpoint[] = [
  { key: 'GET /api/v1/account', class: 'account', credits: 0, usedBy: ['coverage'], notes: 'credit balance and plan in the header; free, API key only. Live: {user_id, plan, credits_remaining}' },
  { key: 'POST /api/v1/ra-agent/posts-by-token', class: 'attribution', credits: 5, usedBy: ['M2'], notes: 'body {date, token_symbol, pagination, order_by} → {data: [{username, timestamp, text, likes, views, tweet_id}]}; token social pulse and the social-heat Storm candidate' },
  { key: 'POST /api/v1/ra-agent/posts-by-user', class: 'attribution', credits: 5, planned: 'M2', notes: 'social posts by an account; shape to be probed live' },
  { key: 'POST /api/v1/search/web-search', class: 'attribution', credits: 5, usedBy: ['M2'], notes: 'body {queries: string[], num_results} → {results: [{query, organic: [{title, link, snippet, date}]}]}; token news on click, 15 requests/minute' },
  { key: 'POST /api/v1/search/web-fetch', class: 'attribution', credits: 20, usedBy: ['M2'], notes: 'body {urls: string[], question} → {analysis, retrieved_urls, failed_urls}; article summary on click, owner and members only, hourly cap' },
  { key: 'GET /api/v1/perp/builder-fee', class: 'account', credits: 0, planned: 'M8', notes: 'Hyperliquid builder-fee status' },
  { key: 'POST /api/v1/perp/approve-builder-fee', class: 'account', credits: 0, planned: 'M8', notes: 'user-signed approval' },
  { key: 'POST /api/v1/perp/order', class: 'account', credits: 0, planned: 'M8', notes: 'prepare a perp order for the user to sign' },
  { key: 'POST /api/v1/perp/close', class: 'account', credits: 0, planned: 'M8', notes: 'prepare a close for the user to sign' },
  { key: 'POST /api/v1/perp/execute', class: 'account', credits: 0, planned: 'M8', notes: 'submit a user-signed perp action' },
  { key: 'POST /api/v1/perp/bridge/quote', class: 'account', credits: 0, planned: 'M8', notes: 'bridge to Hyperliquid quote' },
  { key: 'GET app.nansen.ai/api/points-leaderboard/api', class: 'free', credits: null, planned: 'M3', notes: 'public, keyless points leaderboard' },
  { key: 'GET app.nansen.ai/api/points-leaderboard/{address}', class: 'free', credits: null, usedBy: ['M3'], notes: 'public, keyless tier lookup; wallet desk points tier' },
];

export const ALL_LEDGER: LedgerEntry[] = [...LEDGER, ...EXTRA_ENDPOINTS];

export function coverageStats() {
  const used = ALL_LEDGER.filter((l) => l.usedBy?.length).length;
  const planned = ALL_LEDGER.filter((l) => !l.usedBy?.length && l.planned).length;
  const skipped = ALL_LEDGER.filter((l) => !l.usedBy?.length && !l.planned && l.skipped).length;
  return { total: ALL_LEDGER.length, used, planned, skipped, usedPct: used / ALL_LEDGER.length };
}
