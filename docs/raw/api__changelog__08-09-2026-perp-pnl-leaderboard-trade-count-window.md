> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/changelog/08-09-2026-perp-pnl-leaderboard-trade-count-window.md).

# 08-09-2026: Perp PnL Leaderboard Trade Count Follows the Date Range

**Affected endpoints:** `tgm/perp-pnl-leaderboard`

`nof_trades` now counts a trader's trades from the start of the requested `date` range, on the same window as `pnl_usd_realised`. Previously it counted all of the trader's trades in the contract, regardless of the range requested. The `nof_trades` range filter and sort order use the new definition.

**What changes in responses**

* `nof_trades` is lower for most active traders, typically by an order of magnitude on a 7-day range.
* Nothing else moves: rankings by PnL, `pnl_usd_*`, `roi_percent_*`, `holding_amount`, `position_value_usd` and `price_usd` are unchanged.

**Action required:** if you filter or threshold on `nof_trades`, scale your bounds to the range you request. A lifetime-style bound such as `{"min": 1000}` on a 7-day range now excludes most traders.

`tgm/historical-perp-pnl-leaderboard` already counted trades within the requested window and is unchanged.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/changelog/08-09-2026-perp-pnl-leaderboard-trade-count-window.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
