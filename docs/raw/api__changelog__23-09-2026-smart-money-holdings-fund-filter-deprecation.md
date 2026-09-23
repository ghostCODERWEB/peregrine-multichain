> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/changelog/23-09-2026-smart-money-holdings-fund-filter-deprecation.md).

# 23-09-2026: Smart Money Holdings Fund Filter Deprecation

On September 9, 2026, Fund wallets stopped being part of the upstream Smart Money cohort used by `POST /api/v1/smart-money/holdings`. As a result, current unfiltered holdings totals can be substantially lower than before the cohort change. For Ethereum, the reported comparison changed from 668 tokens, approximately $1.54B in value, and 2,507 holders on September 8 to 384 tokens, approximately $23M, and 936 holders on September 9.

The `Fund` filter value is therefore deprecated for this endpoint. `include_smart_money_labels: ["Fund"]` is still accepted temporarily but returns no rows. `exclude_smart_money_labels: ["Fund"]` is also accepted temporarily but has no effect. Stop using `Fund` in either filter. We may begin rejecting it after December 22, 2026.

This deprecation applies to the current Smart Money holdings endpoint. Historical holdings snapshots from before the cohort change can still contain Fund-labelled wallets. The behavior of `Fund` on other current-data operations is endpoint-specific.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/changelog/23-09-2026-smart-money-holdings-fund-filter-deprecation.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
