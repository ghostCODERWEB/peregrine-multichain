> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/changelog/15-09-2026-counterparties-token-amount.md).

# 15-09-2026: Counterparty Token Amounts Include Direction

**Affected endpoints:** `profiler/address/counterparties`, `profiler/address/counterparties/batch`

Each `tokens_info` entry now includes:

* `total_token_amount`: incoming plus outgoing units of the token
* `token_in_amount`: units received from the counterparty
* `token_out_amount`: units sent to the counterparty

Direction is relative to the requested wallet, or to the selected entity's wallets for entity input. For example, receiving 4 units and sending 10 units of the same token produces `total_token_amount: 14`, `token_in_amount: 4`, and `token_out_amount: 10`. Different tokens remain separate. All three fields are `null` when transferred token units cannot be determined.

**Breaking change:** `token_amount` has been removed from these `tokens_info` entries and replaced by `total_token_amount`. Clients reading `token_amount` must migrate to `total_token_amount`.

**Rollout:** The data-source change is deployed before the API change. The internal total remains available throughout the rollout, but cached responses created before the data-source deployment do not contain the two directional fields. Settled historical requests can remain cached for up to 7 days, so identical requests may return `null` directional amounts until those entries expire. Recent windows use a 5-minute cache. No cache flush is performed as part of this change.

`total_volume_usd`, `volume_in_usd`, `volume_out_usd`, filters, grouping, pagination, and labels are unchanged.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/changelog/15-09-2026-counterparties-token-amount.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
