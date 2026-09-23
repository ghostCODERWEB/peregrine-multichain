> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/reference.md).

# Reference

This section explains the key concepts and terminology used throughout the Nansen API.

### Guides

* Supported Chains - Blockchains supported by the API
* Address Formats - Address formats for each chain type
* Smart Money Labels - Understanding smart money classifications
* Filter Types - Available filter types and usage
* Sorting - How to sort API results

### Quick Reference

#### Chains

The API supports 37 blockchains:

| Type    | Examples                                         |
| ------- | ------------------------------------------------ |
| EVM     | Ethereum, Arbitrum, Base, BNB, Polygon, Optimism |
| Non-EVM | Solana, Bitcoin, TON, Tron, Starknet, SUI        |

#### Smart Money Labels

| Label                     | Description                     |
| ------------------------- | ------------------------------- |
| Fund                      | Institutional investment funds  |
| Smart Trader              | Historically profitable traders |
| 30D/90D/180D Smart Trader | Time-based performance labels   |

#### Common Filters

| Filter Type   | Example                       |
| ------------- | ----------------------------- |
| Numeric Range | `{"min": 1000, "max": 50000}` |
| Integer Range | `{"min": 10, "max": 100}`     |
| Address List  | `["0x...", "0x..."]`          |
| Label List    | `["Fund", "Smart Trader"]`    |

#### Sort Order

```json
{
  "order_by": [
    {"field": "value_usd", "direction": "DESC"}
  ]
}
```


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/reference.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
