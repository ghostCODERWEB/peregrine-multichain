> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/templates.md).

# Use case Templates

This section provides comprehensive use case templates for the Nansen API V1, organized by both difficulty level and specific use case. Templates are grouped into "Simple" and "Complex" categories to help developers quickly find relevant examples based on their experience and needs. Each template is designed to guide you through integrating with the API and building meaningful applications.

{% content-ref url="/pages/VjlW6HaIQjTxvUK6PIt2" %}
[Simple Use cases](/guides/templates/simple-use-cases.md)
{% endcontent-ref %}

{% content-ref url="/pages/nMMDfMzZQEnpE3LOn6TA" %}
[Complex Use cases](/guides/templates/complex-use-cases.md)
{% endcontent-ref %}


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/templates.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
