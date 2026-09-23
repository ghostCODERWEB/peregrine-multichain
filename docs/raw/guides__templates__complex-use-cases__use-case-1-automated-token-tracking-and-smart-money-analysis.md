> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-1-automated-token-tracking-and-smart-money-analysis.md).

# Use case 1: Automated Token Tracking & Smart Money Analysis

### Scenario

A DeFi trading team automated their token discovery and smart money analysis using Nansen's API. They built custom tools that combine multiple data sources to identify promising trading opportunities in real-time.

### Problem

* Manual Process: Hours spent cross-referencing multiple dashboards
* Fragmented Data: Token analysis scattered across different platforms
* Slow Decisions: Opportunities missed due to manual analysis delays
* Poor Scalability: Process couldn't handle growing portfolio needs

### Solution

The team built an automated system using three core Nansen API endpoints:

1. **Token Screener** **(**[**Link Here**](https://docs.nansen.ai/api/token-god-mode/token-screener)**)** - Find trending tokens
2. **Smart Money Netflow** **(**[**Link Here**](https://docs.nansen.ai/api/smart-money/netflows)**)** - Track institutional buying
3. **TGM PnL Leaderboard** **(**[**Link Here**](https://docs.nansen.ai/api/token-god-mode/pnl-leaderboard)**)** - Score trader credibility

### Step-by-Step Guide

**Step 1: Configure Your Token Screener Filters**

Start by selecting the chains you want to analyze (e.g., Ethereum, Solana). Apply filters to narrow down your search:

* Set market cap range (`min` and `max`) to target tokens with desired liquidity.
* Specify minimum liquidity and number of traders to focus on active, tradable tokens.
* Limit token age to capture new and trending assets.
* Enable “only\_smart\_money” to prioritize tokens held by sophisticated traders.
* Order results by volume (descending) for immediate visibility on high-activity tokens.

**Step 2: Analyze Smart Money Netflow**

Use the Smart Money Netflow endpoint to track institutional and expert activity:

* Select your chains.
* Include smart money labels such as “Fund”, “Smart Trader”, and “30D Smart Trader” for targeted analysis.
* Set a minimum market cap and trader count to filter out low-activity tokens.
* Order by net flow over the past 7 days to surface tokens with significant smart money movement.

**Step 3: Validate Trader Credibility with TGM PnL Leaderboard**

For any token of interest, use the TGM PnL Leaderboard:

* Specify the chain and token address.
* Set your date range for analysis.
* Filter for holders with significant USD value and realized profit.
* Use pagination to manage large datasets.
* This step helps you confirm which traders are consistently profitable, adding confidence to your token selection.

### Code Blocks

#### Token Screener API Call

```bash
curl -X POST "https://api.nansen.ai/api/v1/token-screener" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chains": ["ethereum", "solana"],
    "date": {
      "from": "2026-07-12T00:00:00Z",
      "to": "2026-07-13T23:59:59Z"
    },
    "pagination": {
      "page": 1,
      "per_page": 50
    },
    "filters": {
      "market_cap_usd": {
        "min": 1000000,
        "max": 100000000
      },
      "liquidity": {
        "min": 500000
      },
      "nof_traders": {
        "min": 100
      },
      "only_smart_money": true,
      "token_age_days": {
        "min": 1,
        "max": 30
      }
    },
    "order_by": [
      {
        "field": "volume",
        "direction": "DESC"
      }
    ]
  }'
```

#### Smart Money Netflow API Call

```bash
curl -L \
  --request POST \
  --url 'https://api.nansen.ai/api/v1/smart-money/netflow' \
  --header 'apikey: YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "chains": [
      "ethereum",
      "solana"
    ],
    "filters": {
      "include_smart_money_labels": [
        "Fund",
        "Smart Trader",
        "30D Smart Trader"
      ],
      "market_cap_usd": {
        "min": 1000000
      },
      "trader_count": {
        "min": 5
      }
    },
    "pagination": {
      "page": 1,
      "per_page": 10
    },
    "order_by": [
      {
        "field": "net_flow_7d_usd",
        "direction": "DESC"
      }
    ]
  }'

```

#### TGM PnL Leaderboard API Call

```bash
curl -L \
  --request POST \
  --url 'https://api.nansen.ai/api/v1/tgm/pnl-leaderboard' \
  --header 'apikey: YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "chain": "ethereum",
    "token_address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "date": {
      "from": "2026-04-14",
      "to": "2026-07-13"
    },
    "pagination": {
      "page": 1,
      "per_page": 100
    },
    "filters": {
      "holding_usd": {
        "min": 1000
      },
      "pnl_usd_realised": {
        "min": 1000
      }
    }
  }'

```


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-1-automated-token-tracking-and-smart-money-analysis.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
