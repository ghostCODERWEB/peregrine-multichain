> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/data-methodology-and-technical-reference.md).

# Data Methodology & Technical Reference

This page provides detailed technical specifications about how data is calculated, returned, and timed across Nansen API endpoints. This information is essential for quantitative analysis, backtesting

### Date Range Behaviour

All date range parameters across Nansen API endpoints use closed brackets on both sides \[from, to], meaning both the from\_date and to\_date are inclusive. For example, requesting from=2024-11-04, to=2024-11-05 will return data for both November 4th and November 5th.

### Historical Data Calculation Method (Smart Money Historical Holdings)

The Smart Money Historical Holdings API returns daily holding snapshots over a date range. Completed days use values from the actual date requested, not recalculated future values. This avoids look-ahead bias for settled historical rows, making the data suitable for backtesting and predictive models.

The current UTC day is the exception: when the requested range includes today, today's row is live and still settling. It can change on repeated calls as balances continue to accumulate and live market data updates.

#### Field-Level Details

* value\_usd: Historical USD value using the median price from that day for completed days; current-day values are partial until the day settles
* market\_cap\_usd: Historical market cap snapshot for completed days; current-day rows use live market data
* balance\_24h\_percent\_change: Historical percentage calculated using that day's balance and the previous day's balance (with each day using its respective price)

### Snapshot Timing & Data Availability

#### Snapshot Time

Daily snapshots represent end-of-day UTC values for completed days. The current UTC day is returned as a live partial row when requested.

#### Data Availability (Smart Money Historical Holdings)

Completed-day data processing begins at 05:00 AM UTC. Data is typically available by 07:00 AM UTC, though exact timing may vary. Today's row is included when requested, but it is live, partial, and can change until the day has settled.

Do not confuse this endpoint with [Historical Smart Money Positions](/api/backtesting-data/historical-smart-money-positions.md), which is keyed by `as_of_date` and excludes the current day until its daily snapshot is produced.

#### Historical Depth

The Smart Money Historical Holdings endpoint provides a 4-year rolling window of historical data. The earliest available date moves forward daily.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/data-methodology-and-technical-reference.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
