> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/trade.md).

# Trading

Nansen's Trading API endpoints cover spot swaps and Hyperliquid perpetual trading. Both flows keep signing on your side: Nansen prepares unsigned transaction or action data, you sign locally, and you submit the signed payload.

## Choose a trading flow

| I want to...                                                          | Start here                                      | Endpoint reference                                                                                                                                                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Swap tokens on Solana or Base, including supported cross-chain routes | [Spot Trading](/api/trade/spot-trading.md)      | [Quote](/api/trade/spot-trading/quote.md), [Prepare](/api/trade/spot-trading/prepare.md), [Execute](/api/trade/spot-trading/execute.md), [Bridge Status](/api/trade/spot-trading/bridge-status.md) |
| Open, manage or close Hyperliquid perpetual positions                 | [Perpetual Trading](/api/trade/perp-trading.md) | [Perpetual Trading reference](/api/trade/perp-trading/perpetual-trading-reference.md)                                                                                                              |

## Spot Trading

Use Spot Trading to quote and execute token swaps against onchain liquidity. It supports same-chain swaps and supported bridge routes between `solana` and `base`.

The spot flow is:

1. [Quote](/api/trade/spot-trading/quote.md) a swap route.
2. [Prepare](/api/trade/spot-trading/prepare.md) the selected quote when a separate signable transaction is needed.
3. Sign locally.
4. [Execute](/api/trade/spot-trading/execute.md) the signed transaction.
5. [Check bridge status](/api/trade/spot-trading/bridge-status.md) for cross-chain routes.

Read the [Spot Trading guide](/api/trade/spot-trading.md) for supported chains, amount units, signing details and availability.

## Perpetual Trading

Use Perpetual Trading to place orders, manage positions, move USDC between balances, and bridge funds for Hyperliquid perpetuals.

The perpetual trading flow is:

1. Prepare the action you want to take.
2. Sign the returned typed data locally.
3. Submit the signed action with [Submit a signed perp action](https://github.com/nansen-ai/nansen-api/tree/main/gitbook/api/hyperliquid/perp-execute.md).

Read the [Perpetual Trading guide](/api/trade/perp-trading.md) before placing orders. It covers builder-fee approval, funding, signing families, execution, error handling, costs and availability.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/trade.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
