> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/changelog.md).

# API Changelog

- [23-09-2026: Smart Money Holdings Fund Filter Deprecation](https://docs.nansen.ai/api/changelog/23-09-2026-smart-money-holdings-fund-filter-deprecation.md)
- [15-09-2026: Counterparty Token Amounts Include Direction](https://docs.nansen.ai/api/changelog/15-09-2026-counterparties-token-amount.md)
- [08-09-2026: Perp PnL Leaderboard Trade Count Follows the Date Range](https://docs.nansen.ai/api/changelog/08-09-2026-perp-pnl-leaderboard-trade-count-window.md)
- [25-08-2026: Perp Leaderboard Adds Five Fields And Four Sort Options](https://docs.nansen.ai/api/changelog/25-08-2026-perp-leaderboard-new-fields.md)
- [24-08-2026: Perp Leaderboard ROI Corrections](https://docs.nansen.ai/api/changelog/24-08-2026-perp-leaderboard-roi-corrections.md)
- [17-07-2026: Premium Labels Default Change Now Live](https://docs.nansen.ai/api/changelog/17-07-2026-premium-labels-default-change-live.md)
- [31-03-2026: TGM Endpoints - Premium Labels Flag](https://docs.nansen.ai/api/changelog/31-03-2026-tgm-endpoints-premium-labels-flag.md)
- [29-08-2025: Major API Restructuring](https://docs.nansen.ai/api/changelog/2025-08-29.md)


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/changelog.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
