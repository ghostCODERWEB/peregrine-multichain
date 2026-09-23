> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/backtesting-data.md).

# Backtesting Data

Backtest your strategies against the same onchain intelligence that powers Nansen at any point in time.

The Nansen API introduces a family of **historical endpoints:** point-in-time versions of our most-used endpoints. Pass a past date, and the API reconstructs holders, flows, PnL, screener results, and wallet state using the onchain data, prices, and label cohorts available for that historical cutoff.

In short: you can now backtest. No look-ahead bias, no manual snapshotting, no rebuilding label history.

### Why it matters

* **Validate strategies before deploying capital.** Replay any thesis, "buy when Smart Money accumulates," "exit when top holders concentrate", against real history.
* **Audit and attribution.** Show stakeholders, auditors, or LPs what a wallet, token, or cohort looked like on a specific date.
* **Train and evaluate models.** Generate clean training sets and out-of-sample test windows without leaking future information.
* **Research and reporting.** Quote on-chain facts as of a historical cutoff, while accounting for documented restatements or corrections.

### What's available

> ⚠️ **Beta notice.** These are historical endpoints released under V1 Beta (`/api/v1beta1/`). Request shapes, response fields, and pricing may change as we iterate based on feedback.

All historical endpoints live under `/api/v1beta1/` and follow the same conventions as the rest of the Nansen API.

<table><thead><tr><th width="190.49609375">Category</th><th width="368.64453125">Endpoints</th><th>Use case</th></tr></thead><tbody><tr><td><strong>Token God Mode</strong></td><td><code>tgm/historical-top-holders</code>, <code>tgm/historical-dex-trades</code>, <code>tgm/historical-who-bought-sold</code>, <code>tgm/historical-token-flow-summary</code>, <code>tgm/historical-pnl-leaderboard</code>, <code>tgm/historical-token-ohlcv</code>, <code>tgm/historical-token-quant-scores</code></td><td>Reconstruct a token's market structure, holder base, and trading activity on any past date.</td></tr><tr><td><strong>Token Screener</strong></td><td><code>token-screener/historical</code></td><td>Re-run screeners as of a past date to test signal quality and ranking stability.</td></tr><tr><td><strong>Smart Money</strong></td><td><code>smart-money/historical-token-balances</code></td><td>See what Smart Money wallets held on any given day.</td></tr><tr><td><strong>Profiler (Wallets)</strong></td><td><code>profiler/address/historical-token-balances</code>, <code>profiler/address/historical-transactions</code>, <code>profiler/historical-transaction-lookup</code></td><td>Inspect any wallet's balances and transactions as they stood at a point in time.</td></tr></tbody></table>

### Pricing

Historical endpoints cost **5× the credits of their real-time counterpart**, reflecting the additional indexing required to serve point-in-time data.

<table><thead><tr><th width="523.8203125">Endpoint</th><th align="right">Credits per call</th></tr></thead><tbody><tr><td><code>tgm/historical-dex-trades</code></td><td align="right">5</td></tr><tr><td><code>tgm/historical-who-bought-sold</code></td><td align="right">5</td></tr><tr><td><code>tgm/historical-token-flow-summary</code></td><td align="right">5</td></tr><tr><td><code>token-screener/historical</code></td><td align="right">5</td></tr><tr><td><code>profiler/address/historical-token-balances</code></td><td align="right">5</td></tr><tr><td><code>profiler/address/historical-transactions</code></td><td align="right">5</td></tr><tr><td><code>profiler/historical-transaction-lookup</code></td><td align="right">5</td></tr><tr><td><code>tgm/historical-top-holders</code></td><td align="right">25</td></tr><tr><td><code>tgm/historical-pnl-leaderboard</code></td><td align="right">25</td></tr><tr><td><code>tgm/historical-token-quant-scores</code></td><td align="right">25</td></tr><tr><td><code>smart-money/historical-token-balances</code></td><td align="right">25</td></tr></tbody></table>

### Stability and restatements

Historical endpoints are designed to avoid look-ahead bias: labels, balances, prices, and activity windows are evaluated for the requested historical cutoff where point-in-time data is available. This does not mean an identical request is guaranteed to remain byte-identical forever. Results may change after late-arriving indexed data, pricing fixes, label-history corrections, symbol or sector reclassification, blacklist updates, or endpoint-specific backfills.

For `tgm/historical-token-flow-summary`, segment labels are resolved at `date_to`. For multi-date ranges, `date_to` is the cohort date used for segment membership across the requested flow window. For a single-day request, the endpoint still computes the result from the current historical datasets for that cutoff; it is not a frozen API response snapshot.

For `token-screener/historical`, the default all-traders mode uses historical activity and historical daily token pricing. Smart Money and notable-label modes use cohort data prepared for each historical day. Token metadata, sectors, blacklist flags, and corrected historical data may still be restated.

For `smart-money/historical-token-balances`, balances are read for the requested `as_of_date`; token metadata, sectors, blacklist flags, and corrected historical pricing or balance data may still be restated.

### How to use them

All endpoints are `POST`, JSON-bodied, and authenticated with your API key in the `apikey` header — identical to every other Nansen API endpoint.

Each request carries a date "anchor":

* **Snapshot endpoints** take a single `as_of_date` (`YYYY-MM-DD`) — "show me the state on this day."
* **Window endpoints** take a `date_from` + `as_of_date` pair — "show me everything that happened between these two dates." ISO timestamps are accepted; date-only values are treated as UTC midnight.

#### Example: Top holders on a specific date

```bash
curl -X POST "https://api.nansen.ai/api/v1beta1/tgm/historical-top-holders" \
  -H "Content-Type: application/json" \
  -H "apikey: $NANSEN_API_KEY" \
  -d '{
    "chain": "ethereum",
    "token_address": "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    "as_of_date": "2024-12-31",
    "label_type": "all",
    "pagination": {"page": 1, "per_page": 100}
  }'
```

### Get started

* **Base URL:** `https://api.nansen.ai`
* **Auth:** `apikey` header
* **Docs & schemas:** the full OpenAPI specification covers every request and response field
* **Beta status:** these endpoints are in V1 Beta — schemas are stable, but we welcome feedback as we iterate

Already a Nansen API customer? Your existing key works against `/api/v1beta1/` today. Reach out to your account contact for example notebooks, backtesting templates, and volume pricing.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/backtesting-data.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
