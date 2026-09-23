> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-2-find-and-copytrade-wallets-on-hyperliquid.md).

# Use Case 2: Find & Copytrade Wallets on Hyperliquid

Use Nansen API To Find and Copytrade Profitable Wallets on Hyperliquid

### 1. Scenario

Identify and replicate trades from successful perpetual traders on Hyperliquid by monitoring their positions and trade activity in real-time.

**Goal:** Build an automated copytrading system that:

1. **Discovers** profitable traders using the Hyperliquid leaderboard
2. **Monitors** their perpetual positions and recent trades
3. **Replicates** their trading activity in your own account

### 2. Solution

Use three Nansen API endpoints:

1. **Perp Leaderboard** [**(Link Here)**](https://docs.nansen.ai/api/hyperliquid/hyperliquid-leaderboard) - Discover top performing traders by PnL and ROI
2. **Perp Positions** [**(Link Here)**](https://docs.nansen.ai/api/hyperliquid/address-perp-positions) - Monitor current open positions for selected wallets
3. **Perp Trades** [**(Link Here)**](https://docs.nansen.ai/api/hyperliquid/address-perp-trades) - Track all trades executed by profitable wallets

**Optional:** Filter the leaderboard to smart money wallets only for higher quality signals.

**Example workflow:**

1. Discover top Smart Money traders from Step 1
2. Every 30 minutes to an hour:
   1. Fetch recent trades (last 1 hour) for all traders
   2. Identify new "Open" or "Add" Actions
   3. Execute matching trades on your account
3. **Every couple of hours**
   1. **Check current positions vs tracked wallets**
   2. **Close any positions where traders have exited**
   3. **Rebalance position sizes if needed**

### 3. Step-by-Step Guide

**Step 1: Find Profitable Traders on Hyperliquid**

Use the Perp Leaderboard endpoint to discover the most profitable perpetual traders over a specific timeframe.

**Call the perp leaderboard endpoint:**

```bash
curl -X POST "https://api.nansen.ai/api/v1/perp-leaderboard" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "date": {
      "from": "2026-06-13",
      "to": "2026-07-13"
    },
    "filters": {
      "total_pnl": { "min": 10000 },
      "roi": { "min": 20 },
      "account_value": { "min": 50000 },
      "include_smart_money_labels": ["Fund", "Smart Trader"]
    },
    "pagination": { "page": 1, "per_page": 20 },
    "order_by": [{ "field": "total_pnl", "direction": "DESC" }]
  }'
```

**Process the response:**

* Extract `trader_address` from top performers
* Note their `total_pnl`, `roi`, and `account_value` for ranking
* Filter by `trader_address_label` to identify known smart money wallets
* Store addresses for monitoring in the next steps

**Example response:**

```json
{
  "data": [
    {
      "trader_address": "0x28c6c06298d514db089934071355e5743bf21d60",
      "trader_address_label": "Smart Money Trader [0x28c6c0]",
      "total_pnl": 45230.50,
      "roi": 35.2,
      "account_value": 150000.0
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

**Step 2: Monitor Current Positions**

For each profitable trader identified, check their current open positions to understand what they're actively trading.

**Call the perp positions endpoint:**

```bash
curl -X POST "https://api.nansen.ai/api/v1/profiler/perp-positions" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x28c6c06298d514db089934071355e5743bf21d60",
    "order_by": [{ "field": "position_value_usd", "direction": "DESC" }]
  }'
```

**Process the response:**

* Identify active positions by `token_symbol` (e.g., BTC, ETH, SOL)
* Note position direction from `size` (positive = long, negative = short)
* Review `unrealized_pnl_usd` to gauge current profitability
* Check `leverage_value` to understand risk levels
* Use `entry_price_usd` and `liquidation_price_usd` for position context

**Key fields to monitor:**

* `token_symbol`: The perpetual contract being traded
* `size`: Position size (negative for short, positive for long)
* `position_value_usd`: Total position value
* `unrealized_pnl_usd`: Current unrealized profit/loss
* `leverage_value`: Leverage multiplier used
* `entry_price_usd`: Average entry price
* `mark_price_usd`: Current market price

**Step 3: Track Trading Activity**

Monitor recent trades to identify entry and exit signals you can replicate.

**Call the perp trades endpoint:**

```bash
curl -X POST "https://api.nansen.ai/api/v1/profiler/perp-trades" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x28c6c06298d514db089934071355e5743bf21d60",
    "date": {
      "from": "2026-07-12T00:00:00Z",
      "to": "2026-07-13T23:59:59Z"
    },
    "filters": {
      "value_usd": { "min": 5000 }
    },
    "pagination": { "page": 1, "per_page": 100 },
    "order_by": [{ "field": "timestamp", "direction": "DESC" }]
  }'
```

**Process the response:**

* Identify new positions from trades where `action` = "Open"
* Detect position increases where `action` = "Add"
* Track exits where `action` = "Close" or "Reduce"
* Note the `side` (Long/Short) and `token_symbol` for each trade
* Monitor `price`, `size`, and `value_usd` to replicate sizing
* Check `closed_pnl` to understand profitability of closed trades

**Key fields for copytrading:**

* `timestamp`: When the trade occurred
* `token_symbol`: What contract was traded (e.g., BTC, ETH)
* `side`: Position direction (Long or Short)
* `action`: Trade action (Open, Add, Close, Reduce)
* `price`: Execution price
* `size`: Trade size in token units
* `value_usd`: USD value of the trade
* `start_position`: Position size before this trade
* `closed_pnl`: Realized profit/loss (for closing trades)


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-2-find-and-copytrade-wallets-on-hyperliquid.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
