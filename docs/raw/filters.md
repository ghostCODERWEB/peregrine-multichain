> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/reference/filters.md).

# Filter Types

### Overview

Filters allow you to narrow down API results to specific criteria. Each endpoint supports different filters based on the data it returns.

### Filter Types

#### NumericRangeFilter

Filter numeric values (floats) with optional min/max bounds.

**Schema:**

```json
{
  "min": 1000.0,
  "max": 50000.0
}
```

**Fields:**

| Field | Type  | Description               |
| ----- | ----- | ------------------------- |
| `min` | float | Minimum value (inclusive) |
| `max` | float | Maximum value (inclusive) |

**Examples:**

```json
// Minimum only
{"min": 1000000}

// Maximum only
{"max": 50000}

// Range
{"min": 1000, "max": 1000000}

// Negative values allowed
{"min": -10.5, "max": 100.75}
```

**Common Uses:**

* `value_usd` - Filter by USD value
* `price_usd` - Filter by price
* `market_cap_usd` - Filter by market cap
* `volume_24h_usd` - Filter by volume

#### IntegerRangeFilter

Filter integer values with optional min/max bounds.

**Schema:**

```json
{
  "min": 10,
  "max": 1000
}
```

**Fields:**

| Field | Type    | Description               |
| ----- | ------- | ------------------------- |
| `min` | integer | Minimum value (inclusive) |
| `max` | integer | Maximum value (inclusive) |

**Examples:**

```json
// Minimum holders
{"min": 100}

// Age range
{"min": 7, "max": 365}
```

**Common Uses:**

* `holder_count` - Filter by number of holders
* `token_age_days` - Filter by token age
* `trade_count` - Filter by number of trades

#### DateRangeFilter

Filter by date/time ranges.

**Schema:**

```json
{
  "from": "2025-01-01T00:00:00Z",
  "to": "2025-01-31T23:59:59Z"
}
```

**Fields:**

| Field  | Type   | Description                  |
| ------ | ------ | ---------------------------- |
| `from` | string | Start date (ISO 8601 format) |
| `to`   | string | End date (ISO 8601 format)   |

**Formats:**

```json
// Full datetime
"2025-01-01T00:00:00Z"

// Date only
"2025-01-01"
```

**Examples:**

```json
// Last 7 days
{
  "from": "2025-01-07T00:00:00Z",
  "to": "2025-01-14T00:00:00Z"
}

// Specific month
{
  "from": "2025-01-01",
  "to": "2025-01-31"
}
```

#### TokenAddressFilter

Filter by one or more token addresses.

**Schema:**

```json
"0x..."
// or
["0x...", "0x..."]
```

**Examples:**

```json
// Single token
"token_address": "0x6982508145454ce325ddbe47a25d4ec3d2311933"

// Multiple tokens
"token_addresses": [
  "0x6982508145454ce325ddbe47a25d4ec3d2311933",
  "0xdac17f958d2ee523a2206206994597c13d831ec7"
]
```

#### TraderAddressFilter

Filter by one or more trader/wallet addresses.

**Schema:**

```json
"0x..."
// or
["0x...", "0x..."]
```

**Examples:**

```json
// Single trader
"trader_address": "0x28C6c06298d514Db089934071355E5743bf21d60"

// Multiple traders
"trader_addresses": [
  "0x28C6c06298d514Db089934071355E5743bf21d60",
  "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503"
]
```

#### LabelFilter

Filter by smart money or entity labels.

**Schema:**

```json
["Fund", "Smart Trader"]
```

**Smart Money Labels:**

```json
[
  "Fund",
  "Smart Trader",
  "30D Smart Trader",
  "90D Smart Trader",
  "180D Smart Trader",
  "Smart HL Perps Trader"
]
```

**Extended Labels:**

```json
[
  "Public Figure",
  "Exchange",
  "Whale",
  "BananaGun Bot User",
  "Maestro Bot User"
]
```

**Examples:**

```json
// Include funds and smart traders
"include_smart_money_labels": ["Fund", "Smart Trader"]

// Exclude exchanges
"exclude_labels": ["Exchange"]
```

#### SectorsFilter

Filter by token sector/category.

**Schema:**

```json
["DeFi", "Meme"]
```

**Common Sectors:**

```json
[
  "DeFi",
  "Meme",
  "Gaming",
  "NFT",
  "Infrastructure",
  "Layer 1",
  "Layer 2",
  "Stablecoin",
  "AI",
  "RWA"
]
```

**Examples:**

```json
// DeFi tokens only
"sectors": ["DeFi"]

// Multiple sectors
"sectors": ["Meme", "Gaming"]
```

#### BooleanFilter

Simple true/false filter.

**Schema:**

```json
true
// or
false
```

**Examples:**

```json
// Hide spam tokens
"hide_spam_tokens": true

// Include only new positions
"only_new_positions": true
```

### Filter Validation Rules

#### Range Filters

1. `max` must be greater than `min` if both provided
2. Some fields require positive values only

```json
// Invalid - max less than min
{"min": 1000, "max": 500}

// Invalid for some fields - negative min
{"min": -100}
```

#### Date Filters

1. `to` must be after `from`
2. Maximum range is typically 1 year

```json
// Invalid - to before from
{
  "from": "2025-12-31",
  "to": "2025-01-01"
}
```

#### Address Filters

1. Must match chain address format
2. Cannot be burn/zero addresses for some endpoints

### Using Filters in Requests

#### Basic Filter Usage

```python
response = client.post(
    "https://api.nansen.ai/api/v1/smart-money/holdings",
    json={
        "chains": ["ethereum"],
        "filters": {
            "value_usd": {"min": 100000},
            "include_smart_money_labels": ["Fund"]
        }
    }
)
```

#### Combining Multiple Filters

```python
response = client.post(
    "https://api.nansen.ai/api/v1/token-screener",
    json={
        "chains": ["ethereum"],
        "filters": {
            "market_cap_usd": {"min": 1000000, "max": 100000000},
            "volume_24h_usd": {"min": 50000},
            "holder_count": {"min": 100},
            "token_age_days": {"min": 7},
            "sectors": ["DeFi", "Meme"],
            "hide_spam_tokens": true
        }
    }
)
```

#### Endpoint-Specific Filters

Different endpoints support different filters. Check each endpoint's documentation for available filters.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/reference/filters.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
