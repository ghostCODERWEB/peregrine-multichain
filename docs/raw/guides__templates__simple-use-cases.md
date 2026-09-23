> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/templates/simple-use-cases.md).

# Simple Use cases

Use the sample requests and responses to accelerate development and gain actionable insights from blockchain data.

### 1. Viewing DeFi Positions

**Description**: Get comprehensive information about a wallet's DeFi positions including balances, values, and token details.

**Use Case**: Analyze DeFi portfolio performance, track position changes, and understand asset allocation.

**Endpoint Documentation:** [Click Here](https://docs.nansen.ai/api/portfolio)

**cURL Command (Replace your API Key and run this in your terminal)**:

```bash
curl -L \
  --request POST \
  --url 'https://api.nansen.ai/api/v1/portfolio/defi-holdings' \
  --header 'apikey: YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "wallet_address": "0x4062b997279de7213731dbe00485722a26718892"
  }'
```

**Key Benefits**:

* Complete portfolio overview across multiple chains
* Real-time balance and value calculations

**Common Use Cases**:

* Portfolio tracking applications
* DeFi protocol analytics
* Risk management systems

***

### 2. Viewing Smart Money Holdings

**Description**: Discover which tokens top traders and funds are holding.

**Use Case**: Follow smart money movements, identify trending tokens, and make informed investment decisions.

**Endpoint Documentation:** [Click Here](https://docs.nansen.ai/api/smart-money/holdings#post-api-v1-smart-money-holdings)

**cURL Command (Replace your API Key and run this in your terminal)**:

```bash
curl -L \
  --request POST \
  --url 'https://api.nansen.ai/api/v1/smart-money/holdings' \
  --header 'apikey: YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
  "chains": [
    "ethereum",
    "solana",
    "base"
  ],
  "pagination": {
    "page": 1,
    "per_page": 50
  },
  "order_by": [
    {
      "field": "value_usd",
      "direction": "DESC"
    }
  ]
}'
```

**Key Benefits**:

* Identify institutional investment trends
* Track smart money portfolio changes
* Filter by smart money categories

**Common Use Cases**:

* Investment research and analysis
* Token discovery and trending analysis
* Market sentiment analysis

***

### 3. Finding Top Holders of a Token

**Description**: Discover the largest holders of a specific token, including their balances and wallet types.

**Use Case**: Analyze token distribution, identify major stakeholders, and understand market concentration.

**Endpoint Documentation**: [Click Here](https://docs.nansen.ai/api/token-god-mode/holders)

**cURL Command (Replace your API Key and run this in your terminal)**:

```bash
curl -L \
  --request POST \
  --url 'https://api.nansen.ai/api/v1/tgm/holders' \
  --header 'apikey: YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "chain": "solana",
    "token_address": "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv",
    "aggregate_by_entity": false,
    "label_type": "all_holders",
    "pagination": {
      "page": 1,
      "per_page": 10
    },
    "order_by": [
      {
        "field": "value_usd",
        "direction": "DESC"
      }
    ]
  }'
```

**Key Benefits**:

* Identify major token holders and their types
* Includes individual addresses and aggregated by entity views
* Track balance changes over time
* Understand token distribution patterns

**Common Use Cases**:

* Token governance analysis
* Market concentration studies
* Risk assessment for token holders

***

### 4. Using Token Screener to Find New Tokens

**Description**: Discover new and trending tokens based on various metrics like market cap, token age, volume, and smart money activity.

**Use Case**: Find emerging opportunities, track new token launches, and identify trending assets.

**Endpoint Documentation**: [Click Here](https://docs.nansen.ai/api/token-god-mode/token-screener)

**cURL Command**:

```bash
curl -L \
  --request POST \
  --url 'https://api.nansen.ai/api/v1/token-screener' \
  --header 'apikey: YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "chains": [
      "ethereum",
      "solana",
      "base"
    ],
    "date": {
      "from": "2026-07-06T00:00:00Z",
      "to": "2026-07-13T23:59:59Z"
    },
    "pagination": {
      "page": 1,
      "per_page": 10
    },
    "filters": {
      "token_age_days": {
        "max": 7
      }
    },
    "order_by": [
      {
        "field": "market_cap_usd",
        "direction": "DESC"
      }
    ]
  }'

```

**Key Benefits**:

* Discover new token opportunities
* Filter by market cap, volume, sectors and age
* Track trending metrics and holder growth

**Common Use Cases**:

* Token discovery using different metrics

***

### Next Steps

Once you're comfortable with these use cases, explore the [Complex Use cases](/guides/templates/complex-use-cases.md), which chain multiple endpoints into end-to-end workflows such as automated token tracking, copytrading, wallet clustering, and CEX health monitoring.

For more information, refer to the complete [API documentation](https://docs.nansen.ai/).


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/templates/simple-use-cases.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
