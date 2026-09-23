> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-5-monitoring-cex-health.md).

# Use case 5: Monitoring CEX Health

### 1. Scenario

Monitor centralized exchange (CEX) health by tracking onchain asset balances and daily net flows.

**Goal:** Generate daily reports showing:

| Name           | Assets on Exchange | 24hr Net Flows |
| -------------- | ------------------ | -------------- |
| Coinbase, Inc. | $30bn              | $1.2bn         |
| OKX            | $129bn             | $34m           |

### 2. Solution

Use two Nansen API endpoints:

1. **Address Balances** [**(Link Here)**](https://docs.nansen.ai/api/profiler/address-current-balances) - Get total token holdings across all chains
2. **Counterparties** [**(Link Here)**](https://docs.nansen.ai/api/profiler/address-counterparties) - Calculate 24hr net flows (inflows minus outflows)

**Alternative:** Compare today's balance vs yesterday's balance for a simpler net flow calculation.

### 3. Step-by-Step Guide

#### Step 1: Get Current Assets on Exchange

Fetch token balances across all chains covered by Nansen.

**Call the address balances endpoint:**

```bash
curl -X POST "https://api.nansen.ai/api/v1/profiler/address/current-balance" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_name": "Coinbase",
    "chain": "all",
    "hide_spam_token": true,
    "pagination": { "page": 1, "per_page": 1000 }
  }'
```

**Process the response:**

* Sum all `usd_value` fields to get total assets on exchange
* Store this value for comparison

#### Step 2: Calculate 24hr Net Flow

**Method A: Simple (Balance Difference)**

1. Get today's total balance (from Step 1)
2. Get yesterday's total balance (same call, run 24 hours earlier)
3. Calculate: `Net Flow = Today's Balance - Yesterday's Balance`

**Method B: Detailed (Counterparties Breakdown)**

Fetch all inflows and outflows for the past 24 hours:

```bash
curl -X POST "https://api.nansen.ai/api/v1/profiler/address/counterparties" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_name": "Coinbase",
    "chain": "base",
    "date": {
      "from": "2026-07-12T18:43:00Z",
      "to": "2026-07-13T18:43:00Z"
    },
    "group_by": "entity",
    "source_input": "Combined",
    "pagination": { "page": 1, "per_page": 1000 }
  }'
```

**Process the response:**

1. Sum all `volume_in_usd` values = Total Inflows
2. Sum all `volume_out_usd` values = Total Outflows
3. Calculate: `Net Flow = Total Inflows - Total Outflows`

#### Step 3: Format Results

Combine data into your target format:

```
Name: [entity_name]
Assets on Exchange: [Sum of usd_value from current-balance]
24hr Net Flows: [Net Flow calculation from Step 2]
```


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-5-monitoring-cex-health.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
