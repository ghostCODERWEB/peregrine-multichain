> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/prediction-market.md).

# Prediction Market

Nansen's Prediction Market API endpoints provide comprehensive access to onchain prediction market data. Track positions, analyze market activity, find top traders, and discover trending events on Polymarket

### What can you do? <a href="#what-can-you-do" id="what-can-you-do"></a>

With Prediction Market endpoints, you can:

* **Discover trending markets and events:** Screen markets by volume, liquidity, and activity to find what's moving
* **Analyze wallet performance:** Track any address's prediction market trades, positions, and PnL
* **Find top traders:** Identify the most profitable participants on specific markets
* **Monitor market dynamics:** Access orderbooks, price history (OHLCV), and trade flows for any market
* **Browse by category:** Filter markets by topic: politics, crypto, sports, and more

### Which endpoints can I use? <a href="#which-endpoints-can-i-use" id="which-endpoints-can-i-use"></a>

| I want to...                                              | Use this endpoint | Best for                                 |
| --------------------------------------------------------- | ----------------- | ---------------------------------------- |
| Find high-volume or trending prediction markets           | Market Screener   | Market discovery and trends              |
| Browse and filter events by category, status, or volume   | Event Screener    | Event discovery                          |
| View price history for a specific market                  | OHLCV             | Charting and trend analysis              |
| See the current orderbook depth for a market              | Orderbook         | Liquidity analysis and entry/exit sizing |
| Find the largest position holders in a market             | Top Holders       | Identifying conviction holders           |
| See all trades made by a wallet across prediction markets | Trades by Address | Wallet activity breakdown                |
| View all trades on a specific market                      | Trades by Market  | Market-level trade flow                  |
| See a wallet's PnL and win rate across all markets        | PnL by Address    | Trader performance analysis              |
| See profitability rankings for a specific market          | PnL by Market     | Find top performers per market           |
| Get full details on a wallet's open position in a market  | Position Detail   | Position monitoring                      |
| Browse available market categories                        | Categories        | Navigation and filtering                 |
| PnL, Win rate and age of a wallet                         | Address Summary   | Screening wallets                        |

### Key Concepts <a href="#key-concepts" id="key-concepts"></a>

**Market vs Event**

Prediction markets are organised into two levels:

| Concept    | Description                                                    | Example                                                 |
| ---------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| **Market** | The fundamental tradable unit: a single binary Yes/No question | "Will ETH reach $5k in 2025?"                           |
| **Event**  | A container that groups one or more related markets            | "2025 Crypto Predictions" (containing multiple markets) |

**Positions and Shares**

Unlike perp trading, prediction market positions are expressed as **shares** in a YES/NO outcome:

* A positive position = holding YES shares (bullish on the event)
* A negative position = holding NO shares (bearish on the event)
* Price ranges from $0 to $1, representing the implied probability

**Platforms Covered**

Nansen currently only supports data across Polymarket. We will be adding more platforms in the future.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/prediction-market.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
