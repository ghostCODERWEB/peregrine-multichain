> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/readme.md).

# Introduction

Nansen API offers programmatic access to high-quality onchain data and advanced blockchain analytics across numerous networks. The API aims to equip users with the necessary data to gain a competitive edge, identify opportunities, perform due diligence, and make informed decisions within the dynamic crypto market. It effectively translates the complexity of raw blockchain data into actionable intelligence, accessible through a structured API interface.

#### Key Capabilities <a href="#key-capabilities" id="key-capabilities"></a>

* **Proprietary Data Labeling:** Nansen applies unique, human-readable labels to hundreds of millions of blockchain addresses. These labels identify specific entities such as exchanges, funds, market makers, notable individual investors that allows users to understand who is behind onchain activities, providing crucial context that raw, pseudonymous data lacks. Accessing this labelled data via the API is a core component of Nansen's offering.
* **Unique Datasets and Insights:** The API provides access to data points and analytics not readily available elsewhere, such as Smart Money analytics.
* **Comprehensive Multi-Chain Coverage:** The API consolidates data from multiple blockchain networks, allowing users to track assets and activities across different ecosystems through a single integration point.

These features collectively enable the API to deliver not just data, but contextualized intelligence, transforming raw onchain events into a clearer picture of market dynamics and participant behavior.

***

### Quick Links

| Need               | Go To                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------- |
| API authentication | [/getting-started/authentication](https://docs.nansen.ai/getting-started/authentication) |
| Rate limits        | [/getting-started/rate-limits](https://docs.nansen.ai/getting-started/rate-limits)       |
| Error handling     | [/getting-started/error-handling](https://docs.nansen.ai/getting-started/error-handling) |
| Supported chains   | [/reference/chains](https://docs.nansen.ai/reference/chains)                             |
| Filter types       | [/reference/filters](https://docs.nansen.ai/reference/filters)                           |
| AI Agent Access    | [/getting-started/agents](https://docs.nansen.ai/getting-started/agents)                 |

#### API Endpoints

| Category           | Path                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| Overview           | [/api/overview](https://docs.nansen.ai/api/overview)                      |
| Smart Money        | [/api/smart-money](https://docs.nansen.ai/api/smart-money)                |
| Profiler           | [/api/profiler](https://docs.nansen.ai/api/profiler)                      |
| Token Screener     | [/api/token-god-mode](https://docs.nansen.ai/api/token-god-mode)          |
| Portfolio          | [/api/portfolio](https://docs.nansen.ai/api/portfolio)                    |
| Points             | [/api/points](https://docs.nansen.ai/api/points)                          |
| Hyperliquid        | [/api/hyperliquid](https://docs.nansen.ai/api/hyperliquid)                |
| Agent              | [/api/v1/agent](https://docs.nansen.ai/api/agent)                         |
| Prediction Markets | [/api/v1/prediction-market](https://docs.nansen.ai/api/prediction-market) |

#### MCP

| Category          | Path                                                     |
| ----------------- | -------------------------------------------------------- |
| Connecting To MCP | [/mcp/connecting](https://docs.nansen.ai/mcp/connecting) |
| Grok (OAuth)      | [/mcp/grok](https://docs.nansen.ai/mcp/grok)             |
| Supported Tools   | [/mcp/tools](https://docs.nansen.ai/mcp/tools)           |

#### Guides

| Tutorial                   | Path                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Use case Templates         | [/guides/templates](https://docs.nansen.ai/guides/templates)                       |
| Data Redistribution Guides | [/guides/redistribution-guide](https://docs.nansen.ai/guides/redistribution-guide) |


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/readme.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
