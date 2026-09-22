# Nansen API Contract

Complete endpoint reference, compiled from `docs/raw/*.md` (38 fetched doc
pages, no live API calls — no API key was available while writing this).
This is the full reference: it covers every endpoint, including the ones
already modeled in `src/types/nansen/{search,smart-money,token-god-mode}.ts`
as well as the ones added alongside this doc
(`profiler.ts`, `chain-rank.ts`, `agent.ts`, `smart-alerts.ts`, `trade.ts`,
`backtesting.ts`).

Zod schemas for every endpoint below live in `src/types/nansen/*.ts`, grouped
into the same nine families as this doc. Per-endpoint chain enums live in
`src/types/nansen/chain-enums.ts`.

## Global conventions

- **Base URL**: `https://api.nansen.ai`.
- **Auth**: `apikey: <key>` request header (`ApiKeyAuth` security scheme).
- **Pay-per-request (x402 / MPP)**: every endpoint in this doc EXCEPT the
  Search family, all five Smart Alerts endpoints, and `GET /api/v1/trade/quote`
  also advertises `X402Payment` (send unauthenticated, get a `402` whose
  `Payment-Required` header lists options, retry with a signed x402 V2
  payload in `Payment-Signature`) and `MppPayment` (send
  `Authorization: Payment`, get a `402` with a `WWW-Authenticate: Payment ...`
  challenge, retry with the signed credential; successful responses carry a
  `Payment-Receipt` header) as alternatives to the API key. This is a
  header/payment-protocol detail, not a body field, and isn't repeated per
  endpoint below.
- **Error envelope** (`docs/raw/error-handling.md`, `NansenErrorEnvelope` in
  `common.ts`):
  ```json
  {
    "error": "string",
    "message": "string",
    "code": "missing_field | unknown_field | invalid_field_value | invalid_address_format | invalid_date_format | invalid_date_range | mutually_exclusive_fields | value_out_of_range | too_many_items | unauthenticated | forbidden | geo_blocked | plan_upgrade_required | insufficient_credits | rate_limit_exceeded | not_found | method_not_allowed | conflict | payload_too_large | query_timeout | query_too_large | upstream_unavailable | internal_error",
    "status": 400,
    "request_id": "string | null",
    "doc_url": "string",
    "param": "string (optional)",
    "retry_after": "integer >= 0 (optional)"
  }
  ```
  A `422` validation error additionally carries an `errors: [{field, message, code}]`
  array (truncated with a summary entry if very large).
- **Credit-cost headers**: `X-Nansen-Credits-Cost` (quoted cost, present on
  successful responses and priced errors), `X-Nansen-Credits-Used`,
  `X-Nansen-Credits-Remaining`, `X-Request-Id`. A cost of `0` means the
  request doesn't use plan credits (still subject to plan access/usage
  limits). Costs below are identical on Free and Pro plans unless noted.
- **Pagination**: two shapes appear across this API:
  - Standard — request `{page?: int >=1 = 1, per_page?: int 1-1000 = 10}`,
    response `{page, per_page, is_last_page: boolean}`
    (`PaginationRequest`/`PaginationInfo` in `common.ts`).
  - Profiler Transactions' own cap — request
    `{page?: int >=1 = 1, per_page?: int 1-100 = 20}` (same response shape)
    (`ProfilerTransactionsPaginationRequest` in `common.ts`).
  Endpoints with neither are called out explicitly.
- **Rate limits** (`docs/raw/rate-limits.md`): Free = 15 req/s, 300 req/min;
  Pro = 75 req/s, 1,500 req/min, per API key. `GET /api/v1/search/token-sectors`
  additionally caps at 60 req/min on both plans (no other endpoint in this
  doc has a documented per-endpoint override). `429` responses carry
  `Retry-After` and `X-Nansen-RateLimit-Scope` (`second` | `minute` | `endpoint`).

---

## 1. Search — `src/types/nansen/search.ts`

### `POST /api/v1/search/general`
Credit cost: 0 (Free and Pro). Chain enum: none — `chain` is an unconstrained
string (docs don't enumerate a fixed list for this field specifically).
Pagination: none (flat `limit`).

Request (`GeneralSearchRequest`):
```json
{
  "search_query": "string, 1-200 chars, required",
  "result_type": "\"token\" | \"entity\" | \"any\", optional, default \"any\"",
  "chain": "string, optional, unconstrained",
  "limit": "integer 1-50, optional, default 25"
}
```
Response (`GeneralSearchResponse`):
```json
{
  "tokens": [
    {
      "name": "string", "symbol": "string", "chain": "string", "address": "string",
      "price": "number | null, optional", "volume_24h": "number | null, optional",
      "market_cap": "number | null, optional", "rank": "integer | null, optional"
    }
  ],
  "entities": [
    { "name": "string", "tags": "string[], default []", "rank": "integer | null, optional" }
  ],
  "total_results": "integer, required"
}
```

### `POST /api/v1/search/entity-name`
Credit cost: 0. Chain enum: none. Pagination: none — capped at 100 results,
alphabetical.

Request (`EntityNameSearchRequest`): `{"search_query": "string, 2-100 chars, required, case-insensitive substring match"}`
Response (`EntityNameSearchResponse`): `{"data": [{"entity_name": "string"}]}`

### `GET /api/v1/search/token-sectors`
Credit cost: 1 (Free) / 0 (Pro) — the one endpoint in this API priced
differently by plan. Chain enum: none. Pagination: none. No query params.
Rate limit: additionally capped at 60 req/min on both plans (see Global
conventions).

Response (`TokenSectorsResponse`): `{"data": [{"sector": "string"}]}`

---

## 2. Smart Money — `src/types/nansen/smart-money.ts`

All three request bodies require a non-empty `chains` array from the shared
`SmartMoneyChain` enum (`CHAIN_ENUMS.smartMoneyNetflows` /
`smartMoneyHoldings` / `smartMoneyDexTrades` — identical values):
`["all", "arbitrum", "arc", "avalanche", "base", "bnb", "ethereum", "hyperevm", "iotaevm", "linea", "mantle", "monad", "optimism", "plasma", "polygon", "robinhood", "sei", "solana", "sonic"]`.
Credit cost: 5 for all three. Pagination: standard.

### `POST /api/v1/smart-money/netflow`
Request (`SmartMoneyNetflowsRequest`):
```json
{
  "chains": "SmartMoneyChain[], required, min 1 (use [\"all\"] for every supported chain)",
  "filters": {
    "include_smart_money_labels": "SmartMoneyFilterType[], optional",
    "exclude_smart_money_labels": "SmartMoneyFilterType[], optional",
    "token_address": "string | string[] | null, optional",
    "include_stablecoins": "boolean, optional, default false",
    "include_native_tokens": "boolean, optional, default false",
    "token_sector": "string[], optional",
    "trader_count": "{min?, max?: number}, optional",
    "token_age_days": "{min?, max?: number}, optional",
    "market_cap_usd": "{min?, max?: number}, optional"
  },
  "pagination": "PaginationRequest, optional",
  "order_by": "[{field: chain|token_address|token_symbol|net_flow_1h_usd|net_flow_24h_usd|net_flow_7d_usd|net_flow_30d_usd|token_sectors|trader_count|token_age_days|market_cap_usd, direction: ASC|DESC}], optional"
}
```
Response (`SmartMoneyNetflowsResponse`): `{"data": [SmartMoneyNetflow], "pagination": PaginationInfo}` where
`SmartMoneyNetflow = {token_address, token_symbol, net_flow_1h_usd, net_flow_24h_usd, net_flow_7d_usd, net_flow_30d_usd: number, chain: string, token_sectors: string[], trader_count: integer, token_age_days: integer, market_cap_usd: number|null}`.

### `POST /api/v1/smart-money/holdings`
Request (`SmartMoneyHoldingsRequest`) filters add `value_usd`,
`balance_24h_percent_change`, `holders_count`, `share_of_holdings_percent`
range filters plus `token_symbol`, `token_sectors` on top of the netflow
shape (no `token_sector`/`trader_count` singular fields). Sort fields:
`chain|token_address|token_symbol|value_usd|balance_24h_percent_change|holders_count|share_of_holdings_percent|token_age_days|market_cap_usd`.
Response data rows (`SmartMoneyHolding`): `{chain, token_address, token_symbol, token_sectors: string[], value_usd, balance_24h_percent_change, holders_count: integer, share_of_holdings_percent, token_age_days: integer, market_cap_usd}` (numeric fields nullable except holders_count/token_age_days).

### `POST /api/v1/smart-money/dex-trades`
Only the trailing 24 hours is queryable (no date-range parameter). Filters
add `chain`, `transaction_hash`, `trader_address`, `trader_address_label`,
`token_bought_address`, `token_sold_address`, `token_bought_amount`,
`token_sold_amount`, `token_bought_symbol`, `token_sold_symbol`,
`token_bought_age_days`, `token_sold_age_days`, `token_bought_market_cap`,
`token_sold_market_cap`, `token_bought_fdv`, `token_sold_fdv`,
`trade_value_usd`. Response rows (`SmartMoneyDexTrade`):
`{chain, block_timestamp, transaction_hash, trader_address, trader_address_label, token_bought_address, token_sold_address, token_bought_symbol, token_sold_symbol, token_bought_age_days: integer, token_sold_age_days: integer, token_bought_amount, token_sold_amount, token_bought_market_cap, token_sold_market_cap, token_bought_fdv, token_sold_fdv, trade_value_usd}` (strings required; numerics nullable).

---

## 3. Token God Mode — `src/types/nansen/token-god-mode.ts`

12 endpoints. Chain enums vary by endpoint (see `chain-enums.ts` — do not
assume two endpoints share a list). Two endpoints (`perp-screener`,
`perp-positions`) are Hyperliquid-only and have **no** `chain`/`chains` field.

### `POST /api/v1/token-screener`
Credit cost: 1. Chain enum `TokenScreenerChain` (27 chains, includes
`citrea`; docs at `docs/raw/tgm-screener.md`). Pagination: standard.
```json
{
  "chains": "TokenScreenerChain[], required, 1-5",
  "timeframe": "\"5m\"|\"10m\"|\"1h\"|\"6h\"|\"24h\"|\"7d\"|\"30d\", optional (mutually exclusive with date; recommended)",
  "date": "{from?, to?: string}, optional, deprecated — use timeframe",
  "pagination": "PaginationRequest, optional",
  "filters": {
    "token_address": "string|string[]|null", "token_symbol": "string|string[]|null",
    "only_smart_money": "boolean, deprecated — use trader_type",
    "trader_type": "\"all\"|\"sm\"|\"whale\"|\"public_figure\"|\"trending\"|\"consistent_perps_winner\"|\"high_winrate_hl_perps_trader\"|\"predicted_winner\"",
    "sectors": "string[]", "exclude_sectors": "string[]",
    "token_age_days, market_cap_usd, liquidity, price_usd, price_change, fdv, fdv_mc_ratio": "{min?,max?}",
    "nof_buyers, nof_traders, nof_sellers, nof_buys, nof_sells": "{min?,max?: integer}",
    "buy_volume, sell_volume, volume, netflow, inflow_fdv_ratio, outflow_fdv_ratio": "{min?,max?}",
    "include_stablecoins": "boolean, default true", "include_native_tokens": "boolean, default false",
    "include_smart_money_labels, exclude_smart_money_labels": "SmartMoneyFilterType[]"
  },
  "order_by": "[{field, direction}], optional"
}
```
Response: `{"data": [TokenScreenerItem], "pagination": PaginationInfo}`. Row
shape varies by query (default / smart-money / non-default 3-way `anyOf` per
docs) — modeled as the union of all fields, all nullable except
`chain`/`token_address`/`token_symbol` (see TODO in `token-god-mode.ts`).

### `POST /api/v1/perp-screener`
Credit cost: 1. **No chain field** — Hyperliquid perps only. Pagination:
standard. `date: {from?, to?}` is **required** (unlike token-screener's
optional `date`). Filters: `trader_type` (`all|sm|whale|public_figure|high_winrate_hl_perps_trader`),
deprecated `only_smart_money`, `sectors_filter` (category:subcategory form,
e.g. `"Crypto:DeFi"` — differs from token-screener's bare sector names),
`sm_label_filter`, `trader_label_filter`, `token_symbol`, and range filters
on `volume, buy_volume, sell_volume, buy_sell_pressure, trader_count,
mark_price, funding, previous_price_usd, open_interest, smart_money_volume,
smart_money_buy_volume, smart_money_sell_volume, net_position_change,
current_smart_money_position_longs_usd, current_smart_money_position_shorts_usd,
smart_money_longs_count, smart_money_shorts_count`. Sortable fields depend on
`trader_type` (`buy_sell_pressure` only for `all`; `net_position_change` for
others) — union modeled, not enforced client-side. Response rows
(`PerpScreenerItem`) vary similarly by `trader_type`; only `token_symbol` is
guaranteed present.

### `POST /api/v1/tgm/flow-intelligence`
Credit cost: 1. Chain enum `TGMFlowIntelligenceChain` (24 chains, no
`bitcoin`/`citrea`). Single `chain` (not `chains`). No pagination (single
object per token/timeframe).
```json
{
  "chain": "TGMFlowIntelligenceChain, required",
  "token_address": "string, required",
  "timeframe": "\"5m\"|\"1h\"|\"6h\"|\"12h\"|\"1d\"|\"7d\", optional, default \"1d\"",
  "filters": "{<segment>_net_flow_usd, <segment>_avg_flow_usd: {min?,max?}, <segment>_wallet_count: {min?,max?: integer} for segment in public_figure|top_pnl|whale|smart_trader|exchange|fresh_wallets}"
}
```
Response: `{"data": [TGMFlowIntelligenceItem], "warnings"?: string[]}` — one
row per request, all fields nullable. `exchange_wallet_count` is always 0
(not tracked). `fresh_wallets_*` only populated for 1d/7d timeframes;
`fresh_wallets_wallet_count` always 0 even then.

### `POST /api/v1/tgm/holders`
Credit cost: 5 (**150 if `premium_labels: true`** — requires a paid plan;
same multiplier pattern as pnl-leaderboard below). Chain enum
`TGMHoldersChain` (26 chains, no `citrea`). Pagination: standard.
```json
{
  "chain": "TGMHoldersChain, required",
  "token_address": "string, required",
  "aggregate_by_entity": "boolean, optional, default false",
  "label_type": "\"whale\"|\"public_figure\"|\"smart_money\"|\"all_holders\"|\"exchange\", optional, default \"all_holders\"",
  "pagination": "PaginationRequest, optional",
  "filters": {
    "include_smart_money_labels, exclude_smart_money_labels": "LabelType[]",
    "address, address_label": "string|string[]|null",
    "token_amount, total_outflow, total_inflow, balance_change_24h, balance_change_7d, balance_change_30d, ownership_percentage": "{min?,max?}",
    "value_usd": "{min?,max?}, defaults server-side to {min:1.0} to exclude dust (except native tokens under all_holders); pass {min:0} to include all"
  },
  "premium_labels": "boolean | null, optional",
  "order_by": "[{field, direction}], optional"
}
```
When `label_type != "all_holders"`, `filters.include_smart_money_labels`
must include the matching label set. For native tokens under
`all_holders`, the endpoint uses an optimized model: only `token_amount` is
sortable and filters are limited to
`token_amount/total_outflow/total_inflow/address/include_smart_money_labels/exclude_smart_money_labels`.
Response: `{"data": [TGMHolder], "pagination": PaginationInfo, "warnings"?: string[]}`, all fields nullable.

### `POST /api/v1/tgm/dex-trades`
Credit cost: 1. Chain enum `TGMChain` (26 chains, shared component also used
by `indicators`, `token-information`, `who-bought-sold`,
`historical-token-quant-scores`). Pagination: standard. `date: {from?,to?}`
is **required**.
```json
{
  "chain": "TGMChain, required", "token_address": "string, required",
  "only_smart_money": "boolean, default false",
  "date": "{from?, to?}, required",
  "pagination": "PaginationRequest, optional",
  "filters": {
    "include_smart_money_labels, exclude_smart_money_labels": "LabelType[]",
    "block_timestamp": "{from?, to?}",
    "transaction_hash, trader_address, trader_address_label, token_address, traded_token_address": "string|string[]|null",
    "action": "\"BUY\"|\"SELL\"", "token_name, traded_token_name": "string",
    "token_amount, traded_token_amount, estimated_swap_price_usd, estimated_value_usd": "{min?,max?}"
  },
  "order_by": "[{field, direction}], optional"
}
```
Response rows (`TGMDexTrade`): `{block_timestamp, transaction_hash, trader_address, action: BUY|SELL, token_address, token_name, traded_token_address, traded_token_name}` required;
`trader_address_label, token_amount, traded_token_amount, estimated_swap_price_usd, estimated_value_usd` nullable
(`estimated_swap_price_usd` falls back to the daily median price if the counterpart price is unavailable).

### `POST /api/v1/tgm/flows`
Credit cost: 1. Chain enum `TGMFlowsChain` (values identical to `TGMChain`
but kept a distinct named component per docs). Pagination: standard. `date`
required.
```json
{
  "chain": "TGMFlowsChain, required", "token_address": "string, required",
  "date": "{from?, to?}, required",
  "label": "\"whale\"|\"public_figure\"|\"smart_money\"|\"top_100_holders\"|\"exchange\", optional, default \"top_100_holders\"",
  "pagination": "PaginationRequest, optional",
  "filters": "{price_usd, token_amount, value_usd: {min?,max?}, holders_count, total_inflows_count, total_outflows_count: {min?,max?: integer}}",
  "order_by": "[{field: date|price_usd|token_amount|value_usd|holders_count|total_inflows_count|total_outflows_count|total_inflows_dex|total_outflows_dex|total_inflows_cex|total_outflows_cex, direction}], optional"
}
```
Response rows (`TGMFlowsItem`, one bucket per row): `{date (bucket start, RFC3339), bucket_end?, is_complete?, price_usd?, token_amount?, value_usd?, holders_count?, total_inflows_count?, total_outflows_count?, total_inflows_dex?, total_outflows_dex?, total_inflows_cex?, total_outflows_cex?}` — `total_*_dex`/`total_*_cex` only populated when `label="exchange"`.

### `POST /api/v1/tgm/indicators`
Credit cost: 5. Chain enum `TGMChain`. No pagination.
Request: `{"chain": "TGMChain, required", "token_address": "string, required"}`.
Response:
```json
{
  "token_address": "string", "chain": "string",
  "token_info": {"market_cap_usd?": "number", "market_cap_group?": "string", "is_stablecoin?": "boolean"},
  "risk_indicators": "[{indicator_type, score?, signal?, signal_percentile?, last_trigger_on?}] — btc-reflexivity, liquidity-risk, concentration-risk, token-supply-inflation",
  "reward_indicators": "same shape — chain-tvl, trading-range, price-momentum, chain-fees, protocol-fees, cex-flows, funding-rate"
}
```
`score` is `low|medium|high` for risk / `bearish|neutral|bullish` for reward per docs prose, but no closed enum is given in the schema — kept as `string`.

### `POST /api/v1/tgm/token-ohlcv`
Credit cost: 1. Chain enum `TGMOHLCVChain` (33 chains — the broadest in
the API; includes non-EVM chains like algorand/aptos/stacks/stellar/viction
with no other TGM support). No pagination.
```json
{
  "chain": "TGMOHLCVChain, required",
  "token_address": "string, optional (mutually exclusive with token_addresses)",
  "token_addresses": "string[], max 10 (max 5 for Hyperliquid), optional — batch mode",
  "date_range": "{start, end}, optional, deprecated — use date",
  "date": "{from?, to?}, optional, defaults to last 30 days",
  "timeframe": "\"1m\"|\"5m\"|\"15m\"|\"30m\"|\"1h\"|\"4h\"|\"1d\"|\"1w\"|\"1M\", required"
}
```
Response is single-token OR batch shape depending on which request field was
used:
- Single: `{chain, token_address, timeframe: string, data: [OHLCVCandle], truncated: boolean=false, truncation_note?}`.
- Batch: `{chain, timeframe: string, tokens: [{token_address, data: [OHLCVCandle]}] (tokens with no data are omitted, not empty rows), truncated=false, truncation_note?}`.

`OHLCVCandle = {interval_start, open?, high?, low?, close?, volume?, volume_usd?, market_cap: {open?,high?,low?,close?}}`.

### `POST /api/v1/tgm/perp-positions`
Credit cost: 5. **No chain field** — Hyperliquid only. Pagination: standard.
```json
{
  "token_symbol": "string, required",
  "label_type": "\"smart_money\"|\"all_traders\"|\"whale\"|\"public_figure\", optional, default \"all_traders\"",
  "pagination": "PaginationRequest, optional",
  "filters": {
    "include_smart_money_labels, exclude_smart_money_labels": "LabelType[]",
    "address, address_label": "string|string[]|null",
    "side": "\"Long\"|\"Short\" | (\"Long\"|\"Short\")[] | null",
    "position_value_usd, position_size, entry_price, upnl_usd, funding_usd": "{min?,max?}"
  },
  "order_by": "[{field: address|address_label|side|position_value_usd|position_size|size_base|leverage|entry_price|mark_price|liquidation_price|funding_usd|upnl_usd, direction}], optional — note position_size is signed (short=negative, ranks all longs above all shorts); size_base sorts both sides by magnitude"
}
```
Response rows (`TGMPerpPosition`): `{address?, address_label?, side?, position_value_usd?, position_size?, leverage: string, leverage_type?, entry_price?, mark_price?, liquidation_price?, funding_usd?, upnl_usd?}`.

### `POST /api/v1/tgm/pnl-leaderboard`
Credit cost: 5 (**150 if `premium_labels: true`**, paid plan required).
Chain enum `TGMPnLLeaderboardChain` (19 chains, no
`injective/iotaevm/mantra/near/starknet/ton/tron`). Pagination: standard.
`date` required.
```json
{
  "chain": "TGMPnLLeaderboardChain, required", "token_address": "string, required",
  "date": "{from?, to?}, required",
  "pagination": "PaginationRequest, optional",
  "filters": {
    "trader_address, trader_address_label": "string|string[]|null",
    "token_price, pnl_usd_realised, pnl_usd_unrealised, holding_amount, holding_usd, max_balance_held, max_balance_held_usd, still_holding_balance_ratio, nof_trades": "{min?,max?}"
  },
  "premium_labels": "boolean | null, optional",
  "order_by": "[{field, direction}], optional"
}
```
Response rows (`TGMPnlLeaderboardItem`): `{trader_address: string, trader_address_label?, price_usd? (latest spot if date_to>=today, else daily median), pnl_usd_realised?, pnl_usd_unrealised?, holding_amount?, holding_usd?, max_balance_held?, max_balance_held_usd?, still_holding_balance_ratio?, netflow_amount_usd?, netflow_amount?, roi_percent_total?, roi_percent_realised?, roi_percent_unrealised?, pnl_usd_total?, nof_trades?: integer}`.

### `POST /api/v1/tgm/token-information`
Credit cost: 1. Chain enum `TGMChain`. No pagination.
Request: `{"chain": "TGMChain, required", "token_address": "string, required", "timeframe": "5m|1h|6h|12h|1d|7d, required"}` (reuses `TGMFlowIntelligenceTimeframe`).
Response: `{"data": {name?, symbol?, contract_address?, logo?, token_details?: {token_deployment_date?, website?, x?, telegram?, market_cap_usd?, fdv_usd?, circulating_supply?, total_supply?}, spot_metrics?: {volume_total_usd?, buy_volume_usd?, sell_volume_usd?, total_buys?: integer, total_sells?: integer, unique_buyers?: integer, unique_sellers?: integer, liquidity_usd?, total_holders?: integer}}}`.

### `POST /api/v1/tgm/who-bought-sold`
Credit cost: 1. Chain enum `TGMChain`. Pagination: standard. `date` required.
```json
{
  "chain": "TGMChain, required", "token_address": "string, required",
  "buy_or_sell": "\"BUY\"|\"SELL\", optional, default \"BUY\"",
  "date": "{from?, to?}, required",
  "pagination": "PaginationRequest, optional",
  "filters": {
    "include_smart_money_labels, exclude_smart_money_labels": "LabelType[]",
    "address, address_label": "string|string[]|null",
    "bought_token_volume, sold_token_volume, token_trade_volume, bought_volume_usd, sold_volume_usd, trade_volume_usd": "{min?,max?}"
  },
  "order_by": "[{field, direction}], optional"
}
```
Response rows (`TGMWhoBoughtSoldItem`): `{address: string, address_label?, bought_token_volume?, sold_token_volume?, token_trade_volume?, bought_volume_usd?, sold_volume_usd?, trade_volume_usd?}`.

---

## 4. Profiler — `src/types/nansen/profiler.ts`

8 endpoints. Every chain enum here was already present in `chain-enums.ts`
before this doc was written (`profilerCurrentBalance`, `profilerCounterparties`,
`profilerFirstFunder`, `profilerPnlSummary`, `profilerPnl`,
`profilerRelatedWallets`, `profilerTransactions`,
`transactionWithTokenTransferLookup`) — no new chain-enum entries were added
for this family.

### `POST /api/v1/profiler/address/current-balance`
Credit cost: 1. Chain enum `ProfilerChain` (27 chains incl. `all`).
Pagination: standard.
```json
{
  "address": "string, optional", "entity_name": "string, optional",
  "chain": "ProfilerChain, required",
  "hide_spam_token": "boolean, optional, default true",
  "filters": {
    "value_usd, price_usd": "{min?,max?}", "token_amount": "{min?,max?: integer}",
    "token_symbol, token_address, token_name": "string|string[]|null"
  },
  "pagination": "PaginationRequest, optional",
  "order_by": "[{field: value_usd|token_symbol, direction}], optional"
}
```
Response: `{"pagination": PaginationInfo, "data": [{chain, address (empty if entity_name used; EVM lowercase), token_address, token_symbol: string, token_name?, token_amount?, price_usd?, value_usd?}]}`.

### `POST /api/v1/profiler/address/pnl-summary`
Credit cost: 1. Chain enum `ProfilerPnLChain` (18 chains incl. `all`, a
narrower list than `ProfilerChain` — no bitcoin/hyperevm/injective/etc.).
No pagination info in the request, but the response DOES include a
`pagination` object regardless. Aggregate summary cached server-side up to
~1 hour.
Request: `{"address"?: "string", "entity_name"?: "string", "chain": "ProfilerPnLChain, required", "date": "{from?, to?}, required"}`.
Response:
```json
{
  "pagination": "PaginationInfo",
  "top5_tokens": "[{realized_pnl: number|null, realized_roi: number|null, token_address, token_symbol, chain: string}] — required-but-nullable fields, see profiler.ts note",
  "traded_token_count": "integer", "traded_times": "integer (sales: outflow or dex sell)",
  "realized_pnl_usd": "number", "realized_pnl_percent": "number (not x100)",
  "win_rate": "number"
}
```

### `POST /api/v1/profiler/address/pnl`
Credit cost: 1. Chain enum `ProfilerPnLChain` (same as pnl-summary).
Pagination: standard.
```json
{
  "address": "string, optional", "entity_name": "string, optional",
  "chain": "ProfilerPnLChain, required",
  "date": "{from?, to?}, optional (despite PnL semantics)",
  "filters": {"show_realized": "boolean, default false", "token_address": "string, optional (single token only)"},
  "pagination": "PaginationRequest, optional",
  "order_by": "[{field: pnl_usd_realised|roi_percent_realised|pnl_usd_unrealised|roi_percent_unrealised|bought_usd|sold_usd|holding_usd, direction}], optional — default pnl_usd_realised DESC, or pnl_usd_unrealised DESC if show_realized=false"
}
```
Response rows (`ProfilerAddressPnl`): `{token_address, token_symbol: string, nof_buys, nof_sells: string (!) — docs type these counts as strings, not integers, token_price?, roi_percent_realised?, pnl_usd_realised?, pnl_usd_unrealised?, roi_percent_unrealised?, bought_amount?, bought_usd?, cost_basis_usd?, sold_amount?, sold_usd?, avg_sold_price_usd?, holding_amount?, holding_usd?, max_balance_held?, max_balance_held_usd?}`.

### `POST /api/v1/profiler/address/transactions`
Credit cost: 1. Chain enum `ProfilerTransactionsChain` (26 chains incl.
`all`, no `hyperevm`). **Pagination caps `per_page` at 100** (default 20) —
`ProfilerTransactionsPaginationRequest` in `common.ts`, not the API-wide
1000/10.
```json
{
  "address": "string, required", "chain": "ProfilerTransactionsChain, required",
  "date": "{from?, to?}, required",
  "hide_spam_token": "boolean, optional, default true",
  "filters": {
    "token_symbol, token_address, counterparty_name": "string|string[]|null",
    "counterparty_address": "string, optional (single only)",
    "volume_usd": "{min?,max?}", "method, source_type": "string"
  },
  "pagination": "{page?:int>=1=1, per_page?:int 1-100=20}, optional",
  "order_by": "[{field: \"block_timestamp\" (only sortable field), direction}], optional"
}
```
Response: `{"pagination": PaginationInfo, "data": [{chain, method (\"sent\"/\"received\"), block_timestamp, transaction_hash, source_type: string, tokens_sent?, tokens_received?: [{token_symbol, token_amount: number, token_address, chain, from_address, to_address: string, price_usd?, value_usd?, from_address_label?, to_address_label?}], volume_usd?}]}`.

### `POST /api/v1/transaction-with-token-transfer-lookup`
Credit cost: 1. Chain enum `TransactionLookupChain` (24 chains incl. `all`,
notably **no `solana`** — matches `data-coverage.md`'s note that Solana
transaction lookup isn't supported here). No pagination.
```json
{
  "chain": "TransactionLookupChain, required",
  "transaction_hash": "string, required",
  "block_timestamp": "string ('YYYY-MM-DD HH:MM:SS'), optional for most EVM chains (auto-resolved); required for non-EVM chains (bitcoin, tron, ton, starknet, sui) per docs prose, not enforced by the schema"
}
```
Response: `{"data": [TransactionLookupResponse]}` (a list, even though the
request looks up one hash) where every field below is `required` by the
docs' schema, but several are nullable per the required-but-anyOf-wrapped
pattern (see `profiler.ts`'s file-level note):
```json
{
  "chain": "string", "transaction_hash": "string",
  "from_address": "string", "from_address_label": "string | null",
  "to_address": "string", "to_address_label": "string | null",
  "native_value": "number | null", "dated_native_price": "number | null",
  "dated_native_value_usd": "number | null", "current_native_price": "number | null",
  "current_native_value_usd": "number | null",
  "receipt_status": "integer | null (1=success, 0=failure)",
  "block_timestamp": "string",
  "token_transfer_array": "TokenTransfer[] | null",
  "nft_transfer_array": "NFTTransfer[] | null"
}
```
`TokenTransfer = {from_address, from_address_label, to_address, to_address_label, token_address, token_symbol: string, token_amount: number, dated_price_usd, dated_value_usd, current_price_usd, current_value_usd: number|null, transfer_id: string}` (all required-but-some-nullable).
`NFTTransfer = {from_address, from_address_label, to_address, to_address_label, project_id, collection_name, nft_id: string}` (all required, all plain strings).

### `POST /api/v1/profiler/address/counterparties`
Credit cost: 5. Chain enum `ProfilerChain` (same as current-balance).
Pagination: standard. `date` required — high-volume addresses (e.g. WETH on
Base) capped at 180 days; very high-activity wallets can be slow over wide
ranges.
```json
{
  "address": "string, optional", "entity_name": "string, optional",
  "chain": "ProfilerChain, required", "date": "{from?, to?}, required",
  "source_input": "\"Combined\"|\"Tokens\"|\"ETH\", optional, default \"Combined\"",
  "group_by": "\"wallet\"|\"entity\", optional, default \"wallet\"",
  "filters": {
    "interaction_count": "{min?,max?: integer}",
    "total_volume_usd, volume_in_usd, volume_out_usd": "{min?,max?}",
    "include_smart_money_labels, exclude_smart_money_labels": "LabelType[]"
  },
  "pagination": "PaginationRequest, optional",
  "order_by": "[{field: interaction_count|total_volume_usd|volume_in_usd|volume_out_usd, direction}], optional"
}
```
Response rows (`ProfilerCounterparty`): `{counterparty_address: string, interaction_count: integer, counterparty_address_label?: string[], total_volume_usd?, volume_in_usd?, volume_out_usd?, tokens_info?: [{token_address, token_symbol, token_name, num_transfer: string (!) — same string-typed-count quirk as PnL's nof_buys/nof_sells, total_token_amount?, token_in_amount?, token_out_amount?}]}`.
Different tokens are never combined in `tokens_info`; incoming+outgoing of
the *same* token ARE combined into `total_token_amount`.

### `POST /api/v1/profiler/address/related-wallets`
Credit cost: 1. Chain enum `ProfilerAddressRelatedWalletsChain` (25 chains,
no `all`, no `hyperevm` — differs from `ProfilerChain`). Pagination: standard.
Request: `{"address": "string, required", "chain": "ProfilerAddressRelatedWalletsChain, required", "pagination"?: "PaginationRequest", "order_by"?: "[{field: \"order\" (only sortable field), direction}]"}`.
Response: `{"pagination": PaginationInfo, "data": [{address, relation, transaction_hash, block_timestamp: string, order: integer, chain: string, address_label?: string}]}`.

### `POST /api/v1/profiler/address/first-funder`
Credit cost: **not listed in `docs/raw/credits.md`'s endpoint table** —
undocumented; do not assume a specific value. Chain enum
`ProfilerAddressFirstFunderChain`, fixed to `["all"]` — the lookup is
resolved across all chains regardless.
Request: `{"address": "string, required (EVM address)", "chain"?: "\"all\", default \"all\""}`.
Response: `{"pagination": PaginationInfo, "data": [{wallet_address, first_funder_address, transaction_hash, block_timestamp, chain: string, first_funder_name?: string}]}`.
"First funder" = earliest address to send native gas to the input wallet
(the gas-funder, not necessarily the source of any stablecoin balance).

---

## 5. Chain Rank — `src/types/nansen/chain-rank.ts`

### `POST /api/v1/chains/chain-rank`
Credit cost: 1. **No chain enum** — this endpoint ranks every chain at once
(intentionally absent from `CHAIN_ENUMS`). No pagination.
```json
{
  "time_frame": "7 | 30 | 365 (integer, days), optional, default 7",
  "chain_type": "\"all\" | \"evm\", optional, default \"all\""
}
```
Response: `{"data": [ChainRankResponse]}`, one row per chain, only `chain`
required — every metric is optional/nullable:
```json
{
  "chain": "string",
  "transaction_count?": "integer", "transaction_count_percent_change?": "number",
  "successful_transaction_count?": "integer", "successful_transaction_count_percent_change?": "number",
  "total_gas_used_usd?": "number", "total_gas_used_usd_percent_change?": "number",
  "total_dex_volume_usd?": "number", "total_dex_volume_usd_percent_change?": "number",
  "active_address_count_traces?": "integer", "active_address_count_traces_percent_change?": "number",
  "active_address_count_txs?": "integer", "active_address_count_txs_percent_change?": "number",
  "revenue_usd?": "number", "revenue_usd_percent_change?": "number",
  "tvl_usd?": "number", "tvl_usd_percent_change?": "number"
}
```

---

## 6. Agent — `src/types/nansen/agent.ts`

Both endpoints share the same request body and response shape — an SSE
stream, not a single JSON object. **No chain field.**

### `POST /api/v1/agent/fast`
Credit cost: 200. Lighter model, optimized for low latency.

### `POST /api/v1/agent/expert`
Credit cost: 750. More capable model, deeper multi-step analysis.

Request (both, `AgentResearchRequest`):
```json
{
  "text": "string, min length 1, required — the research question",
  "conversation_id": "string, optional — from a prior finish event, to continue that conversation"
}
```

**Response — SSE shape**: `Content-Type: text/event-stream`. Each line is
`data: {json}`; the stream ends with a literal `data: [DONE]` sentinel
(not JSON — check for this exact string before parsing). Four JSON event
types, each with a `type` discriminator:

| `type` | Shape | Notes |
| --- | --- | --- |
| `delta` | `{"type": "delta", "text": "string"}` | Incremental answer text chunk. |
| `tool_call` | `{"type": "tool_call", "name": "string"}` | Emitted once per unique Nansen tool invoked. |
| `finish` | `{"type": "finish", "conversation_id": "string", "tool_calls": "string[]"}` | Final event; `tool_calls` item shape isn't spelled out beyond the tool-call event's `name` field — see TODO in `agent.ts`. |
| `error` | `{"type": "error", "error": "string", "status_code": "integer"}` | Upstream agent service unavailable/timeout. |

Modeled in `agent.ts` as `AgentDeltaEvent` / `AgentToolCallEvent` /
`AgentFinishEvent` / `AgentErrorEvent` plus a `z.discriminatedUnion` over
`type` (`AgentStreamEvent`), per the task's instruction to model the stream
as multiple event schemas rather than one response object.

---

## 7. Smart Alerts — `src/types/nansen/smart-alerts.ts`

5 endpoints, none priced in `docs/raw/credits.md` (undocumented cost for the
whole family). **No chain enum in `chain-enums.ts`** — `chains` is a bare
`string[]` inside the type-specific `data` object, not a fixed enum.
**Response bodies for all five endpoints are entirely undocumented** — the
embedded OpenAPI gives an empty schema (`{}`, "Successful Response") with no
fields at all. Modeled as `z.unknown()` throughout; do not assume a shape
(see file-level note in `smart-alerts.ts`).

Shared channel shape — `channels: AlertChannel[]`, a discriminated union on
`type`:
```json
[
  {"type": "telegram", "data": {"chatId": "string (prefix \"-\" for group chats)"}},
  {"type": "slack", "data": {"webhookUrl": "string, https only"}},
  {"type": "discord", "data": {"webhookUrl": "string, https only"}},
  {"type": "webhook", "data": {"webhookUrl": "string, https only", "secret?": "string, 16-512 chars — enables an HMAC-SHA256 signature header on delivered payloads"}}
]
```

Shared alert `type` values and their `data` shape (`common-token-transfer` |
`sm-token-flows` | `smart-contract-call`) — the wire schema types `data` as
an open `additionalProperties: true` object, but the doc's prose gives an
explicit per-type field table:

- **`common-token-transfer`**: `{chains: string[], subjects: Target[], events: ("buy"|"sell"|"swap"|"send"|"receive")[], counterparties?: Target[], usdValue?: MinMax, tokenAmount?: MinMax, inclusion?: {tokens?, tokenSectors?, tokenAge?, marketCap?}, exclusion?: same}`.
- **`sm-token-flows`**: `{chains: string[], events: ["sm-token-flows"], inflow_15m/30m/1h/1d/7d?: MinMax, outflow_15m/30m/1h/1d/7d?: MinMax, netflow_15m/30m/1h/1d/7d?: MinMax, inclusion?: {tokens?, tokenSectors?, tokenAge?, marketCap?, fdvUsd?}, exclusion?: {tokens?, tokenSectors?}}`.
- **`smart-contract-call`**: `{chains: string[], events: ["smart-contract-call"], usdValue?: MinMax, signatureHash?: string[] (4-byte selectors, e.g. "0x128acb08"), inclusion?: {caller: Target[], smartContract: Target[]}, exclusion?: same}`.

Where `MinMax = {min?: number, max?: number}` and
`Target = {type: "address"|"entity"|"label"|"custom-label"|"watchlist", value: string}`.
The exact types of `inclusion`/`exclusion`'s nested `tokens`/`tokenSectors`/
`tokenAge`/`marketCap`/`fdvUsd` fields are inferred (not explicitly
documented) — see TODOs in `smart-alerts.ts`.

### `POST /api/v1/smart-alert` — Create
```json
{
  "name": "string, required", "type": "common-token-transfer|sm-token-flows|smart-contract-call, required",
  "timeWindow": "realtime|1m|5m|10m|30m|1h|4h|12h|1d|1w, required",
  "channels": "AlertChannel[], required", "data": "object, required (type-specific, see above)",
  "description?": "string", "isEnabled?": "boolean, default true",
  "createdBy?": "string, defaults to \"agent\" when omitted"
}
```

### `PATCH /api/v1/smart-alert` — Update
`{"id": "string, required", "name/type/timeWindow/channels/data/description/isEnabled": "all optional — only provided fields are changed"}`.

### `GET /api/v1/smart-alert/list` — List
No request body/query params. Response: entirely undocumented.

### `PATCH /api/v1/smart-alert/toggle` — Enable/disable
`{"id": "string, required", "isEnabled": "boolean, required"}`.

### `DELETE /api/v1/smart-alert/{alert_id}` — Delete
Path parameter `alert_id: string`, required. No request body.

---

## 8. Trade — `src/types/nansen/trade.ts`

### `GET /api/v1/trade/quote`
Credit cost: **not listed in `docs/raw/credits.md`** — undocumented. Chain
enum `TradeQuoteChain = ["solana", "base"]` (both `chain` and `to_chain` use
it). Query parameters, not a JSON body:
```json
{
  "chain": "\"solana\"|\"base\", required — source chain",
  "to_chain": "\"solana\"|\"base\", optional — destination chain for a bridge swap",
  "from_token": "string, required — sell token contract address",
  "to_token": "string, required — buy token contract address",
  "amount": "string, required — base units, integer string (e.g. \"1000000000\")",
  "wallet_address": "string, required",
  "to_wallet_address": "string, optional — required by runtime validation when bridging EVM<->Solana",
  "slippage": "integer 0-10000 (bps), optional, default 50 (0.5%)"
}
```
Special notes:
- At least one side must be USDC or the chain's native token (SOL/ETH); non-native-to-non-native swaps aren't supported (swap to USDC first).
- Cross-chain minimum ~$5/trade; not every pair/direction routes — a `400` means no aggregator route (not a worse price).
- Pass the chosen quote to `POST /api/v1/trade/prepare` to get a transaction ready to sign — **that endpoint's doc page was not among the 38 fetched pages** (no `trade-prepare.md`), so it is intentionally not modeled in this codebase.
- The `transaction` field on a quote varies by route: a standard EVM tx (Base), a serialized Solana tx (Solana same-chain), or routing instructions (Solana-out cross-chain) — swaps out of Solana to another chain must go through `/trade/prepare` since their payload isn't directly signable.

Response (`TradingQuoteResponse`): essentially undocumented at the field
level — `{"quotes": "array of {} (unspecified item shape), default []"}`
with `additionalProperties: true` on the envelope itself. Modeled as an open
record per quote (`TradingQuote = z.record(...)`); do not assume specific
fields like `price` or `route` exist.

---

## 9. Backtesting Data (Beta) — `src/types/nansen/backtesting.ts`

7 endpoints, all under `/api/v1beta1/*` and explicitly marked **Beta —
subject to breaking changes** by the docs. All chain enums here were already
present in `chain-enums.ts` before this doc was written
(`histProfilerTokenBalances`, `histTgmDexTrades`, `histTgmTokenFlowSummary`,
`histTgmPnlLeaderboard`, `histTgmTokenOhlcv`, `histTgmTokenQuantScores`,
`histTokenScreener`).

### `POST /api/v1beta1/token-screener/historical`
Credit cost: 5. Chain enum `TokenScreenerChain` (same 27-chain list as the
live token-screener). Pagination: standard.
```json
{
  "to_date": "string (date), required", "timeframe_days": "integer 1-365, required",
  "chains": "TokenScreenerChain[], required, non-empty",
  "sectors_filter?": "string[] (empty = all)", "exclude_sectors?": "string[]",
  "only_smart_money?": "boolean, default false, deprecated — use trader_type",
  "trader_type?": "all|sm|whale|public_figure|trending|consistent_perps_winner|high_winrate_hl_perps_trader|predicted_winner",
  "filters?": {
    "sm_label_filter, exclude_sm_labels_filter": "HistoricalSmartMoneyFilterType[], default [] — only applied when trader_type='sm'",
    "volume_usd, buy_volume_usd, sell_volume_usd, market_cap_usd, fdv_usd, fdv_mc_ratio, liquidity_usd, netflow_usd (can be negative), inflow_fdv_ratio, outflow_fdv_ratio": "{min?,max?}",
    "nof_traders, nof_buyers, nof_sellers, nof_buys, nof_sells, token_age_days": "{min?,max?: integer}"
  },
  "pagination?": "PaginationRequest",
  "order_by?": "[{field, direction}] — defaults to netflow DESC; only the first element is used",
  "apply_blacklist_filter?": "boolean, default true"
}
```
Response rows (`TokenScreenerHistoricalItem`): `{token_address, token_symbol, chain: string, price_usd?, price_change? (ratio), market_cap_usd? (falls back to FDV if zero), fdv?, fdv_mc_ratio?, volume?, buy_volume?, sell_volume?, netflow?, inflow_fdv_ratio?, outflow_fdv_ratio?, token_age_days?: integer, liquidity?, sectors: string[] default []}`.

### `POST /api/v1beta1/tgm/historical-token-ohlcv`
Credit cost: 5. Chain enum `HistoricalTokenOHLCVChain` (5 chains:
base/bnb/ethereum/hyperliquid/solana). No pagination.
```json
{
  "chain": "HistoricalTokenOHLCVChain, required",
  "token_address": "string, required (for hyperliquid, pass the coin symbol, e.g. \"BTC\"/\"HYPE\"/\"@1\"/\"XYZ/USDC\")",
  "date_from": "string (ISO 8601), required",
  "as_of_date?": "string — snapshot anchor, semantically = date_to; date-only values = end-of-day",
  "as_of_ts?": "string (date-time) — exact UTC cutoff for Hyperliquid; exactly one of as_of_date/as_of_ts",
  "timeframe": "5m|15m|30m|1h|4h|1d|1w, required — 1m and 1M documented as unsupported here (unlike the live endpoint's full ResolutionEnum)",
  "apply_blacklist_filter?": "boolean — high-tf-only (1d/1w); a low-tf timeframe + this flag returns 400"
}
```
Response (single-token only — no batch mode on this endpoint): `{chain, token_address, timeframe: string, data: [OHLCVCandle] (ordered by interval_start), truncated: boolean=false, truncation_note?}`. Truncation caps: ~50,000 candles most chains (omits most-recent), ~5,000 for Hyperliquid (omits oldest, from its own upstream feed).

### `POST /api/v1beta1/tgm/historical-token-flow-summary`
Credit cost: 5. Chain enum `TGMHistoricalChain` (4 chains:
base/bnb/ethereum/solana — shared by this, `historical-dex-trades`, and
`historical-pnl-leaderboard`). No pagination.
```json
{
  "chain": "TGMHistoricalChain, required", "token_address": "string, required",
  "date_range": "{from?, to?}, required — `to` is the as-of date for label resolution; the span sets bucket resolution and avg_flow_usd's lookback window",
  "apply_blacklist_filter?": "boolean, default true"
}
```
Response: `{"data": [TGMHistoricalTokenFlowSummary] (single aggregated row per (token_address, date_to)), "warnings"?: string[]}`.
Every field in the row — including `token_symbol` — is optional/nullable
(no `required` list at all in the docs, unusually). Segment columns
(`public_figure_*`, `top_pnl_*`, `whale_*`, `exchange_*`, `smart_trader_*`,
`fresh_wallets_*`) mirror `/tgm/flow-intelligence` but resolved against
temporal label history (who held a label *at* `date_to`, not today) — NULL
means the segment's temporal label data isn't available yet for that
`date_to` (e.g. before 2025-03-11 for whale/public_figure/top_pnl/exchange),
distinct from a genuine zero net flow. `exchange_wallet_count` and
`fresh_wallets_wallet_count` are always 0 (not tracked), matching the live
endpoint.

### `POST /api/v1beta1/tgm/historical-dex-trades`
Credit cost: 5. Chain enum `TGMHistoricalDexTradesChain` (4 chains:
base/bnb/ethereum/solana). Pagination: standard.
```json
{
  "chain": "TGMHistoricalDexTradesChain, required", "token_address": "string, required",
  "date_range": "{from?, to?}, required",
  "pagination?": "PaginationRequest",
  "filters?": {
    "action?": "\"BUY\"|\"SELL\" (omit for all trades)",
    "include_labels?": "HistoricalLabelType[] (legacy \"Smart Dex Trader\" variants included)",
    "value_usd?": "{min?,max?}", "trader_address?": "string (single only)"
  },
  "order_by?": "[{field: block_timestamp|estimated_value_usd|token_amount|estimated_swap_price_usd, direction}] — defaults block_timestamp DESC; only first element used",
  "apply_blacklist_filter?": "boolean, default true"
}
```
Response rows (`TGMHistoricalDexTrade`): `{block_timestamp, transaction_hash, trader_address, action: BUY|SELL, token_name, traded_token_name: string (required); trader_address_label: string|null (optional); token_amount, traded_token_amount, estimated_swap_price_usd, estimated_value_usd: number|null (required-but-nullable — see backtesting.ts note)}`.
Differs from the live `/tgm/dex-trades` response: **no** `token_address`/
`traded_token_address` columns; labels are resolved at the trade date via
temporal label tables (avoids forward-looking bias).

### `POST /api/v1beta1/tgm/historical-pnl-leaderboard`
Credit cost: 25. Chain enum `TGMHistoricalChain` (same 4 chains as
flow-summary). Pagination: standard.
```json
{
  "chain": "TGMHistoricalChain, required", "token_address": "string, required",
  "date_range": "{from?, to?}, required — dates truncated to YYYY-MM-DD server-side",
  "pagination?": "PaginationRequest",
  "filters?": {
    "trader_address?": "string[] (empty = all traders)",
    "pnl_usd_total, roi_percent_total, pnl_usd_realised, roi_percent_realised, pnl_usd_unrealised, roi_percent_unrealised, netflow_amount_usd, holding_usd, nof_trades, still_holding_balance_ratio, holding_amount, nof_buys, nof_sells, bought_amount, sold_amount, bought_usd, sold_usd, max_balance_held, max_balance_held_usd": "{min?,max?}"
  },
  "order_by?": "[{field, direction}] — defaults pnl_usd_total DESC; only first element used",
  "apply_blacklist_filter?": "boolean, default true"
}
```
Response rows (named `TGMPnlLeaderboard` in the docs, `HistoricalTGMPnlLeaderboardItem` in this codebase to avoid a name collision with the live endpoint's item type): `{trader_address: string (required); trader_address_label?, price_usd? (latest spot if date_to is today+, else daily median), pnl_usd_realised?, pnl_usd_unrealised?, holding_amount?, holding_usd?, max_balance_held?, max_balance_held_usd?, still_holding_balance_ratio?, netflow_amount_usd?, netflow_amount?, roi_percent_total?, roi_percent_realised?, roi_percent_unrealised?, pnl_usd_total?, nof_trades?: integer}` — all optional/nullable except `trader_address`.

### `POST /api/v1beta1/tgm/historical-token-quant-scores`
Credit cost: 25. Chain enum reuses the shared `TGMChain` component (26
chains, identical to the live indicators/dex-trades/who-bought-sold chain
list). **No pagination field on this response** — unlike almost every other
list endpoint in this API.
```json
{
  "as_of_date": "string (date), required",
  "chain": "TGMChain, required", "token_address": "string, required"
}
```
Response: `{"data": [{indicator_type: string (required); signal?, signal_percentile? (0-100, vs same market-cap group), score? (string, no closed enum given), last_trigger_on?, is_stablecoin?, market_cap_usd?, market_cap_group?, model_type? (string, "risk" or "reward" per prose but no closed enum given)}]}`.

### `POST /api/v1beta1/profiler/address/historical-token-balances`
Credit cost: 5. Chain enum `ProfilerHistoricalTokenBalancesChain` (6 chains:
all/base/bnb/ethereum/mantra/solana). Pagination: standard.
```json
{
  "address": "string (EVM hex or Solana base58), required",
  "as_of_date": "string (date), required — balances computed up to this date",
  "chain": "ProfilerHistoricalTokenBalancesChain, required",
  "apply_blacklist_filter?": "boolean, default true",
  "pagination?": "PaginationRequest"
}
```
Response: `{"pagination": PaginationInfo, "data": [{chain, token_address: string (required); token_symbol?, name?, token_amount? (decimals-adjusted), price_usd? (at as_of_date), value_usd? (token_amount * price_usd)}] — ordered by value_usd DESC}`.

---

## Summary: thin/unclear documentation flagged with TODOs

- **`profiler/address/pnl`** and **`profiler/address/counterparties`**:
  `nof_buys`/`nof_sells`/`num_transfer` are documented as plain strings for
  what are semantically counts — preserved verbatim, not coerced to integer.
- **`profiler/address/pnl-summary`**'s `top5_tokens[].realized_pnl` /
  `.realized_roi`, and the whole **`transaction-with-token-transfer-lookup`**
  response: fields marked `required` while type-wrapped as if optional
  (anyOf-with-no-null) — modeled as required-but-nullable.
- **`agent/*`**'s `finish` event `tool_calls` item shape isn't specified
  beyond the sibling `tool_call` event's `name` field.
- **`trade/quote`**: response `quotes[]` item shape is entirely
  undocumented (`additionalProperties: true`, `items: {}`); credit cost is
  also absent from `credits.md`.
- **`profiler/address/first-funder`**: credit cost absent from `credits.md`.
- **`smart-alert/*`** (all 5 endpoints): response bodies are completely
  undocumented (`{}` schema, "Successful Response") and endpoint credit
  costs are absent from `credits.md`; the `data` field's per-`type` nested
  `inclusion`/`exclusion` sub-shapes (`tokens`, `tokenSectors`, `tokenAge`,
  `marketCap`, `fdvUsd`) are inferred from naming/context, not an explicit
  schema.
- **`search/general`**'s `chain` filter: no fixed enum given for this
  specific field (unlike almost every other `chain`/`chains` field in this
  API), and it's unclear whether an invalid value 400s or is ignored.
- **`tgm/token-screener`** and **`perp-screener`**: response row shape is a
  3-way `anyOf` that varies by query mode (default / smart-money /
  notable-label); modeled as the permissive union of all fields rather than
  three separate discriminated variants, since the docs don't specify a
  discriminator field to switch on.
