> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/templates/complex-use-cases.md).

# Complex Use cases

Explore advanced workflows you can create with the Nansen API. This section showcases complex use cases designed to help you unlock deeper insights and automate sophisticated tasks, empowering your team to get the most from Nansen’s API.

{% content-ref url="/pages/B7ZpMdJSA2w9fOgYspik" %}
[Use case 1: Automated Token Tracking & Smart Money Analysis](/guides/templates/complex-use-cases/use-case-1-automated-token-tracking-and-smart-money-analysis.md)
{% endcontent-ref %}

{% content-ref url="/pages/Ct1ahT1aLdHZsFe0hhsr" %}
[Use Case 2: Find & Copytrade Wallets on Hyperliquid](/guides/templates/complex-use-cases/use-case-2-find-and-copytrade-wallets-on-hyperliquid.md)
{% endcontent-ref %}

{% content-ref url="/pages/OpQSo1UAZN116AbmARjA" %}
[Use case 3: Identifying Related Wallets at Scale](/guides/templates/complex-use-cases/use-case-3-identifying-related-wallets-at-scale.md)
{% endcontent-ref %}

{% content-ref url="/pages/MmOEdcypcZHJmxtHW6IR" %}
[Use case 4: Copytrading Top Performing Wallets](/guides/templates/complex-use-cases/use-case-4-copytrading-top-performing-wallets.md)
{% endcontent-ref %}

{% content-ref url="/pages/FytWjXRl58KHW4UhvZvB" %}
[Use case 5: Monitoring CEX Health](/guides/templates/complex-use-cases/use-case-5-monitoring-cex-health.md)
{% endcontent-ref %}


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/templates/complex-use-cases.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
