> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/changelog/17-07-2026-premium-labels-default-change-live.md).

# 17-07-2026: Premium Labels Default Change Now Live

**Affected endpoints:** `tgm/holders`, `tgm/pnl-leaderboard`, `tgm/perp-pnl-leaderboard`, `perp-leaderboard`

The `premium_labels` default change announced in the [31-03-2026 changelog entry](/api/changelog/31-03-2026-tgm-endpoints-premium-labels-flag.md) is now live.

<table><thead><tr><th width="198.51953125">Value</th><th width="413.2578125">Behavior</th><th>Credits Used</th></tr></thead><tbody><tr><td>omitted (default)</td><td>Returns free-tier labels only</td><td>Standard credit cost (5)</td></tr><tr><td><code>true</code></td><td>Returns premium labels (Smart Money, Fund, etc.)</td><td><strong>150</strong></td></tr><tr><td><code>false</code></td><td>Returns free-tier labels only</td><td>Standard credit cost (5)</td></tr></tbody></table>

**What changed:**

* Requests that **omit** `premium_labels` now return **free-tier labels** at the standard credit cost. Previously, omitted requests returned premium labels.
* Passing `premium_labels=true` returns premium labels (Smart Money, Fund, etc.), is billed at **150 credits per call**, and requires a paid plan. Free plan users sending `premium_labels=true` receive a `403 Forbidden` response.
* Passing `premium_labels=false` is unchanged: free-tier labels at the standard credit cost.

**Action required:** If your integration relies on premium labels (Smart Money, Fund, and other advanced labels) in responses from these endpoints, pass `"premium_labels": true` explicitly. Note the 150-credit-per-call cost before enabling it.

The credit cost of each request is always returned in the `X-Nansen-Credits-Used` response header.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/changelog/17-07-2026-premium-labels-default-change-live.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
