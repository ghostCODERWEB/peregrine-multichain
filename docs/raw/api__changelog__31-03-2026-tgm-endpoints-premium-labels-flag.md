> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/changelog/31-03-2026-tgm-endpoints-premium-labels-flag.md).

# 31-03-2026: TGM Endpoints - Premium Labels Flag

**Affected endpoints:** `tgm/holders`, `tgm/pnl-leaderboard`, `tgm/perp-pnl-leaderboard`, `perp-leaderboard`

A new `premium_labels` parameter has been added to these endpoints to control wallet label tier.

<table><thead><tr><th width="198.51953125">Value</th><th width="413.2578125">Behavior</th><th>Credits Used</th></tr></thead><tbody><tr><td>omitted (default)</td><td>Returns free-tier labels only</td><td>Standard credit cost (5)</td></tr><tr><td><code>true</code></td><td>Returns premium labels (Smart Money, Fund, etc.)</td><td><strong>150</strong></td></tr><tr><td><code>false</code></td><td>Returns free-tier labels only</td><td>Standard credit cost (5)</td></tr></tbody></table>

**Plan enforcement:** Free plan users sending `premium_labels=true` will receive a `403 Forbidden` response. Paid plan users may use either value.

**Default behavior:** The default is `false` — requests that omit the parameter return free-tier labels and are billed at the standard credit cost. `premium_labels=true` (billed at 150 credits per call) is required to receive premium labels. *(Update 17-07-2026: the default change announced here is now live — see the* [*17-07-2026 changelog entry*](/api/changelog/17-07-2026-premium-labels-default-change-live.md)*.)*


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/changelog/31-03-2026-tgm-endpoints-premium-labels-flag.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
