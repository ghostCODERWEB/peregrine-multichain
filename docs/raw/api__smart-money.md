> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/smart-money.md).

# Smart Money

### Overview

Smart Money endpoints provide insights into the trading and holding activity of sophisticated market participants, including institutional funds and historically profitable traders.

### Endpoints

| Endpoint            | Path                                      | Description                             |
| ------------------- | ----------------------------------------- | --------------------------------------- |
| Netflow             | `/api/v1/smart-money/netflow`             | Net capital flows (inflows vs outflows) |
| DEX Trades          | `/api/v1/smart-money/dex-trades`          | Real-time DEX trading activity          |
| Perp Trades         | `/api/v1/smart-money/perp-trades`         | Perpetual trading on Hyperliquid        |
| DCAs                | `/api/v1/smart-money/dcas`                | DCA strategies on Jupiter               |
| Holdings            | `/api/v1/smart-money/holdings`            | Aggregated token balances               |
| Historical Holdings | `/api/v1/smart-money/historical-holdings` | Historical balance snapshots            |

### Supported Chains

Netflow, DEX Trades, and Holdings support these chains:

| Chain     | Value       |
| --------- | ----------- |
| Arbitrum  | `arbitrum`  |
| Arc       | `arc`       |
| Avalanche | `avalanche` |
| Base      | `base`      |
| BNB Chain | `bnb`       |
| Ethereum  | `ethereum`  |
| HyperEVM  | `hyperevm`  |
| IOTA EVM  | `iotaevm`   |
| Linea     | `linea`     |
| Mantle    | `mantle`    |
| Monad     | `monad`     |
| Optimism  | `optimism`  |
| Plasma    | `plasma`    |
| Polygon   | `polygon`   |
| Robinhood | `robinhood` |
| Sei       | `sei`       |
| Solana    | `solana`    |
| Sonic     | `sonic`     |

Historical Holdings supports `arc`, `base`, `bnb`, `ethereum`, `monad`, `robinhood`, and `solana`.

Perp Trades is Hyperliquid-only and does not accept a `chains` field.

DCAs is Solana/Jupiter-only and does not accept a `chains` field.

### Smart Money Labels

Filter by these smart money labels. Availability is endpoint-specific. `Fund` is deprecated for current Smart Money holdings: including it returns no rows, while excluding it has no effect, because Fund wallets are no longer part of the current Smart Money cohort. Historical snapshots from before September 9, 2026 can still contain Fund-labelled wallets; behavior on other current-data operations is endpoint-specific.

| Label                   | Description                     |
| ----------------------- | ------------------------------- |
| `Fund`                  | Institutional investment funds  |
| `Smart Trader`          | Historically profitable traders |
| `30D Smart Trader`      | Top performers (30-day window)  |
| `90D Smart Trader`      | Top performers (90-day window)  |
| `180D Smart Trader`     | Top performers (180-day window) |
| `Smart HL Perps Trader` | Profitable Hyperliquid traders  |

### Common Request Pattern

```json
{
  "chains": ["ethereum", "solana"],
  "filters": {
    "include_smart_money_labels": ["Smart Trader"],
    "value_usd": {"min": 10000}
  },
  "pagination": {
    "page": 1,
    "per_page": 100
  },
  "order_by": [
    {"field": "value_usd", "direction": "DESC"}
  ]
}
```

### Next:

{% content-ref url="/pages/aVsWbKbTgy8fbMcKoWq7" %}
[Netflows](/api/smart-money/netflows.md)
{% endcontent-ref %}

{% content-ref url="/pages/1qo1HJEaDto58QBB7JoO" %}
[Holdings](/api/smart-money/holdings.md)
{% endcontent-ref %}

{% content-ref url="/pages/rYsYbf9uGhNH2iFjvXis" %}
[Historical Holdings](/api/smart-money/historical-holdings.md)
{% endcontent-ref %}

{% content-ref url="/pages/LA9mTsMicCD9eBuSA30f" %}
[DEX Trades](/api/smart-money/dex-trades.md)
{% endcontent-ref %}

{% content-ref url="/pages/SykFfCZRUpWS1ASo0fzF" %}
[Perp Trades](/api/smart-money/perp-trades.md)
{% endcontent-ref %}

{% content-ref url="/pages/ehDRbgk7yGFsGOVdRagI" %}
[Jupiter DCAs](/api/smart-money/jupiter-dcas.md)
{% endcontent-ref %}


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/smart-money.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
