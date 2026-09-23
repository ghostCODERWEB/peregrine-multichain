> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/getting-started.md).

# Getting Started

Welcome to the Nansen API. This guide will help you get up and running quickly.

### Prerequisites

* A Nansen account with API access
* An API key from your [Nansen Dashboard](https://app.nansen.ai) or through [Agent Setup Link](https://app.nansen.ai/auth/agent-setup)

### Quick Start

#### 1. Set Up Authentication

All API requests require your API key in the `apikey` header:

```bash
curl -X POST 'https://api.nansen.ai/api/v1/smart-money/holdings' \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR_API_KEY' \
  -d '{"chains": ["ethereum"]}'
```

#### 2. Make Your First Request

```python
import httpx

response = httpx.post(
    "https://api.nansen.ai/api/v1/smart-money/holdings",
    headers={
        "Content-Type": "application/json",
        "apikey": "YOUR_API_KEY"
    },
    json={
        "chains": ["ethereum"],
        "pagination": {"page": 1, "per_page": 10}
    }
)

print(response.json())
```

#### 3. Understand the Response

```json
{
  "data": [
    {
      "chain": "ethereum",
      "token_address": "0x6982508145454ce325ddbe47a25d4ec3d2311933",
      "token_symbol": "PEPE",
      "value_usd": 15000000.50,
      "holders_count": 1250,
      "balance_24h_percent_change": 5.25
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "is_last_page": false
  }
}
```

### Next Steps

* Authentication - Detailed auth setup
* Rate Limits - Understand API limits
* Credits System - How credits work
* Pagination - Handle large datasets
* Error Handling - Handle errors gracefully
* Best Practices - Optimize your integration


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/getting-started.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
