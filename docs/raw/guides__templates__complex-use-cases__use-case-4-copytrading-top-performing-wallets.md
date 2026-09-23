> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-4-copytrading-top-performing-wallets.md).

# Use case 4: Copytrading Top Performing Wallets

### Scenario

A copy trading workflow that uses the Nansen API to deliver structured, real-time onchain token insights. This enables traders to understand token flows, track smart money activity, and evaluate token performance across multiple chains.

### Core Components

* **Flow Intelligence (**[**Link Here**](https://docs.nansen.ai/api/token-god-mode/flow-intelligence)**)**: Real-time tracking of wallet inflows and outflows for each token
* **PnL Leaderboard (**[**Link Here**](https://docs.nansen.ai/api/token-god-mode/pnl-leaderboard)**)**: Identification of top-performing wallets by token
* **PnL Summary (**[**Link Here**](https://docs.nansen.ai/api/profiler/address-pnl-and-trade-performance#post-api-v1-profiler-address-pnl-summary)**)**: Cross-chain wallet performance analysis
* **TGM Holders (**[**Link Here**](https://docs.nansen.ai/api/token-god-mode/holders)**)**: Identify top holders of any token

### Step-by-Step Guide

#### Step 1: Track Token Flow Intelligence

* Select your target blockchain (`chain: "ethereum"`) and token address (`token_address: "0x6982508145454ce325ddbe47a25d4ec3d2311933"`).
* Call the Flow Intelligence endpoint with `timeframe: "7d"` to monitor weekly inflows and outflows.
* Review net flows by wallet type - check `smart_trader_net_flow_usd`, `whale_net_flow_usd`, and `public_figure_net_flow_usd` fields to spot accumulation (positive values) or distribution (negative values) trends.

#### Step 2: Find Top-Performing Wallets For a Token

* Use the PnL Leaderboard endpoint with `chain: "ethereum"` and your token address.
* Set date range with `date: { "from": "2026-04-14", "to": "2026-07-13" }` for 3-month analysis.
* Apply filter `pnl_usd_realised: { "min": 1000 }` to find wallets with over $1,000 realized profits.
* Review the `roi_percent_realised` and `nof_trades` fields to identify consistent performers.

#### Step 3: Assess Cross-Chain Wallet Performance

* For any wallet, use PnL Summary with `address: "0x39d52da6beec991f075eebe577474fd105c5caec"` and `chain: "ethereum"`.
* Set `date: { "from": "2026-01-14", "to": "2026-07-13" }` for 6-month performance history.
* Check `win_rate` (target > 0.5), `realized_pnl_usd`, and `top5_tokens` array to judge trader reliability.

#### Step 4: Monitor Smart Money DEX Trades

* Call Smart Money DEX Trades with `chains: ["ethereum", "base", "arbitrum"]` for multi-chain coverage.
* Apply filters: `token_bought_address: "0x6982508145454ce325ddbe47a25d4ec3d2311933"` and `trade_value_usd: { "min": 10000 }`.
* Include `include_smart_money_labels: ["Smart Trader", "Fund"]` to focus on sophisticated traders.
* Monitor `token_bought_amount` and `estimated_swap_price_usd` for entry points.

#### Step 5: Analyze Token Holder Distribution

* Access Token Holders endpoint with `chain: "ethereum"` and your token address.
* Set `label_type: "smart_money"` and filter with `include_smart_money_labels: ["Smart Trader", "Fund", "30D Smart Trader"]`.
* Apply `filters: { "ownership_percentage": { "min": 0.1 }, "value_usd": { "min": 50000 } }` to find significant holders.
* Check `balance_change_7d` and `balance_change_30d` fields to see if smart money is accumulating (positive) or exiting (negative).

#### Step 6: Implement and Refine Copy Trading

* Select wallets with `roi_percent_realised > 50` and `win_rate > 0.6` from your PnL analysis.
* Set up monitoring with `pagination: { "page": 1, "per_page": 20 }` to track the top 20 performers.
* Use `order_by: [{ "field": "pnl_usd_realised", "direction": "DESC" }]` to prioritize highest profit wallets.
* Refresh Flow Intelligence data with `timeframe: "1h"` for intraday monitoring during volatile periods.

### Code Examples

#### 1. Get Token Flow Intelligence

Track real-time capital flows to identify accumulation or distribution patterns:

```bash
curl -X POST "https://api.nansen.ai/api/v1/tgm/flow-intelligence" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "solana",
    "token_address": "token_address_here",
    "timeframe": "7d"
  }'
```

This endpoint reveals net flows across different wallet segments (smart traders, whales, public figures) helping identify whether sophisticated players are accumulating or distributing.

#### 2. Get PnL Leaderboard (Find Highest Performing Wallets)

Identify the most profitable traders for any token:

```bash
curl -X POST "https://api.nansen.ai/api/v1/tgm/pnl-leaderboard" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "solana",
    "token_address": "token_address_here",
    "date": {
      "from": "2026-04-14",
      "to": "2026-07-13"
    },
    "filters": {
      "pnl_usd_realised": {
        "min": 1000
      }
    }
  }'
```

This leaderboard shows which wallets have the highest realized profits, enabling copy traders to identify successful trading patterns.

#### 3. Get Wallet PnL Summary (Cross-Chain Performance)

Analyze a trader's overall performance and success rate:

```bash
curl -X POST "https://api.nansen.ai/api/v1/profiler/address/pnl-summary" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "wallet_address_here",
    "chain": "solana",
    "date": {
      "from": "2024-10-23",
      "to": "2025-01-21"
    }
  }'
```

This provides win-rate, realized PnL, and top profitable tokens for any wallet, helping assess trader quality before copying their strategies.

#### 4. Track Smart Money DEX Trades

Monitor real-time trading activity from sophisticated traders:

```bash
curl -X POST "https://api.nansen.ai/api/v1/smart-money/dex-trades" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chains": ["solana"],
    "filters": {
      "token_bought_address": "token_address_here",
      "trade_value_usd": {
        "min": 10000
      }
    }
  }'
```

Real-time smart money trades provide copy trading signals by showing what experienced traders are buying or selling right now.

#### 5. Analyze Token Holder Distribution

Understand token concentration and holder quality:

```bash
curl -X POST "https://api.nansen.ai/api/v1/tgm/holders" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "solana",
    "token_address": "token_address_here",
    "label_type": "smart_money",
    "filters": {
      "include_smart_money_labels": ["Smart Trader", "Fund"]
    }
  }'
```

This shows smart money concentration in any token, helping traders assess whether sophisticated investors are holding or have exited.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-4-copytrading-top-performing-wallets.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
