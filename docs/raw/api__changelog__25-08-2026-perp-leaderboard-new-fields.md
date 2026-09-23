> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/changelog/25-08-2026-perp-leaderboard-new-fields.md).

# 25-08-2026: Perp Leaderboard Adds Five Fields And Four Sort Options

**Affected endpoints:** `perp-leaderboard`

This release is **additive**. No existing field changes name, type, or value, and no request that works today stops working.

## Five new response fields

<table><thead><tr><th width="220">Field</th><th width="120">Type</th><th>Meaning</th></tr></thead><tbody><tr><td><code>realized_pnl_usd</code></td><td>number</td><td>Realized PnL over the timeframe, in USD.</td></tr><tr><td><code>unrealized_pnl_usd</code></td><td>number</td><td>Unrealized PnL on positions still open, valued at the current mark.</td></tr><tr><td><code>volume_usd</code></td><td>number</td><td>Traded notional in USD. Both the opening and the closing fill count.</td></tr><tr><td><code>total_trades</code></td><td>integer</td><td>Number of fills over the timeframe.</td></tr><tr><td><code>top_positions</code></td><td>array</td><td>The five largest open positions, largest first.</td></tr></tbody></table>

`total_pnl` is unchanged and still equals `realized_pnl_usd + unrealized_pnl_usd`.

Each entry in `top_positions` carries `coin`, `side` (`long` or `short`), `size_base`, `position_value_usd`, `entry_price`, and `unrealized_pnl_usd`. `size_base` is **absolute** — `side` carries the direction, so a short has a positive size.

## Four new sort options

`order_by` now accepts `realized_pnl_usd`, `unrealized_pnl_usd`, `volume_usd`, and `total_trades`, alongside the existing `total_pnl`, `roi`, and `account_value`.

## What `top_positions` covers

`top_positions` lists only positions in coins the trader **traded during the requested timeframe**. A position opened before the window and held through it, in a coin the trader did not trade during the window, is not listed.

This matches the behaviour of the timestamp-certified `tgm/historical-perp-leaderboard` endpoint, so the two agree. It also matches the scope of `unrealized_pnl_usd` and of the open-exposure term in the `roi` denominator, which are gated the same way.

An empty `top_positions` therefore means "no open position in a coin traded during the window", not "holds nothing".

## `roi` for a trader with no traded notional

A trader with zero traded notional in the window now returns `roi: null` instead of a number. Previously the denominator fell back to one dollar, which returned a PnL amount in dollars in a field documented as a ratio. `null` is the same answer `tgm/historical-perp-leaderboard` already gives.

No current values change: no trader in the leaderboard reaches this branch today, because a trader only appears by having a fill and a fill carries positive notional.

## Why these fields were empty before

The underlying view computed realized PnL, unrealized PnL, and traded notional and then discarded them, so the endpoint could not return them. It never built the open-position list at all. All five are now selected, and the trade count is a new aggregate over the same source.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/changelog/25-08-2026-perp-leaderboard-new-fields.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
