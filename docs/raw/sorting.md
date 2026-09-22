> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/reference/sorting.md).

# Sorting

### Overview

Most Nansen API endpoints support sorting results using the `order_by` parameter. This allows you to control the order of returned data.

### Sort Order Schema

```json
{
  "order_by": [
    {
      "field": "field_name",
      "direction": "DESC"
    }
  ]
}
```

#### Parameters

| Parameter   | Type   | Description                              |
| ----------- | ------ | ---------------------------------------- |
| `field`     | string | The field to sort by                     |
| `direction` | string | `ASC` (ascending) or `DESC` (descending) |

#### Directions

| Direction | Description                | Example                     |
| --------- | -------------------------- | --------------------------- |
| `ASC`     | Ascending (smallest first) | 1, 2, 3, ... or A, B, C     |
| `DESC`    | Descending (largest first) | 100, 99, 98, ... or Z, Y, X |

### Examples

#### Single Field Sort

Sort by USD value, highest first:

```json
{
  "order_by": [
    {"field": "value_usd", "direction": "DESC"}
  ]
}
```

#### Multiple Field Sort

Sort by volume first, then by price:

```json
{
  "order_by": [
    {"field": "volume_24h_usd", "direction": "DESC"},
    {"field": "price_usd", "direction": "ASC"}
  ]
}
```

#### Full Request Example

```python
response = client.post(
    "https://api.nansen.ai/api/v1/smart-money/holdings",
    json={
        "chains": ["ethereum"],
        "pagination": {"page": 1, "per_page": 100},
        "order_by": [
            {"field": "value_usd", "direction": "DESC"}
        ]
    }
)
```

### Common Sort Fields by Endpoint

#### Smart Money Holdings

| Field                        | Description                       |
| ---------------------------- | --------------------------------- |
| `value_usd`                  | Total USD value of holdings       |
| `balance_24h_percent_change` | 24-hour balance change percentage |
| `holders_count`              | Number of smart money holders     |
| `share_of_holdings_percent`  | Share of total token supply held  |
| `market_cap_usd`             | Token market capitalization       |
| `token_age_days`             | Days since token creation         |

```json
{
  "order_by": [{"field": "value_usd", "direction": "DESC"}]
}
```

#### Smart Money Netflow

| Field              | Description                   |
| ------------------ | ----------------------------- |
| `net_flow_1h_usd`  | 1-hour net flow in USD        |
| `net_flow_24h_usd` | 24-hour net flow in USD       |
| `net_flow_7d_usd`  | 7-day net flow in USD         |
| `net_flow_30d_usd` | 30-day net flow in USD        |
| `trader_count`     | Number of smart money traders |
| `market_cap_usd`   | Token market capitalization   |

```json
{
  "order_by": [{"field": "net_flow_24h_usd", "direction": "DESC"}]
}
```

#### Smart Money DEX Trades

| Field       | Description         |
| ----------- | ------------------- |
| `timestamp` | Trade timestamp     |
| `value_usd` | Trade value in USD  |
| `amount`    | Token amount traded |

```json
{
  "order_by": [{"field": "timestamp", "direction": "DESC"}]
}
```

#### Token Screener

| Field                      | Description              |
| -------------------------- | ------------------------ |
| `market_cap_usd`           | Market capitalization    |
| `volume_24h_usd`           | 24-hour trading volume   |
| `price_change_24h_percent` | 24-hour price change     |
| `holder_count`             | Total holder count       |
| `smart_money_holder_count` | Smart money holder count |
| `liquidity_usd`            | Total liquidity          |

```json
{
  "order_by": [
    {"field": "volume_24h_usd", "direction": "DESC"},
    {"field": "market_cap_usd", "direction": "DESC"}
  ]
}
```

#### TGM Holders

| Field                      | Description            |
| -------------------------- | ---------------------- |
| `balance_usd`              | Current balance in USD |
| `balance_change_24h_usd`   | 24-hour balance change |
| `first_transfer_timestamp` | First transfer date    |
| `last_transfer_timestamp`  | Last transfer date     |

```json
{
  "order_by": [{"field": "balance_usd", "direction": "DESC"}]
}
```

#### TGM PnL Leaderboard

| Field                | Description            |
| -------------------- | ---------------------- |
| `realized_pnl_usd`   | Realized profit/loss   |
| `unrealized_pnl_usd` | Unrealized profit/loss |
| `total_pnl_usd`      | Total profit/loss      |
| `roi_percent`        | Return on investment   |

```json
{
  "order_by": [{"field": "total_pnl_usd", "direction": "DESC"}]
}
```

### Best Practices

#### 1. Always Sort When Paginating

Ensure consistent ordering across pages:

```python
# Good - consistent ordering
for page in range(1, 10):
    response = client.post(url, json={
        "pagination": {"page": page, "per_page": 100},
        "order_by": [{"field": "value_usd", "direction": "DESC"}]
    })

# Bad - order may change between pages
for page in range(1, 10):
    response = client.post(url, json={
        "pagination": {"page": page, "per_page": 100}
    })
```

#### 2. Use Secondary Sort for Ties

Add a secondary sort field to break ties:

```json
{
  "order_by": [
    {"field": "volume_24h_usd", "direction": "DESC"},
    {"field": "token_address", "direction": "ASC"}
  ]
}
```

#### 3. Sort by Timestamp for Recent Data

For trade/transaction data, sort by timestamp:

```json
{
  "order_by": [{"field": "timestamp", "direction": "DESC"}]
}
```

#### 4. Consider Default Sorts

Many endpoints have sensible default sorts. Check the endpoint documentation for defaults.

### Error Handling

#### Invalid Sort Field

```json
{
  "detail": [
    {
      "type": "enum",
      "loc": ["body", "order_by", 0, "field"],
      "msg": "Input should be 'value_usd', 'balance_24h_percent_change', ..."
    }
  ]
}
```

#### Invalid Direction

```json
{
  "detail": [
    {
      "type": "enum",
      "loc": ["body", "order_by", 0, "direction"],
      "msg": "Input should be 'ASC' or 'DESC'"
    }
  ]
}
```

### Python Helper

```python
from enum import Enum
from typing import Literal

class SortDirection(str, Enum):
    ASC = "ASC"
    DESC = "DESC"

def create_sort_order(
    field: str,
    direction: Literal["ASC", "DESC"] = "DESC"
) -> dict:
    return {"field": field, "direction": direction}

# Usage
sort = create_sort_order("value_usd", "DESC")
```


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/reference/sorting.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
