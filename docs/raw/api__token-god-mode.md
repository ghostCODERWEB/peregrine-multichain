> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/token-god-mode.md).

# Token God Mode

- [Token Information](https://docs.nansen.ai/api/token-god-mode/token-information.md)
- [Nansen Indicators](https://docs.nansen.ai/api/token-god-mode/nansen-indicators.md)
- [Price OHLCV](https://docs.nansen.ai/api/token-god-mode/price-ohlcv.md)
- [Token Screener](https://docs.nansen.ai/api/token-god-mode/token-screener.md)
- [Flow Intelligence](https://docs.nansen.ai/api/token-god-mode/flow-intelligence.md)
- [Holders](https://docs.nansen.ai/api/token-god-mode/holders.md)
- [Flows](https://docs.nansen.ai/api/token-god-mode/flows.md)
- [Position Intelligence](https://docs.nansen.ai/api/token-god-mode/position-intelligence.md): Aggregated perpetual position analytics on Hyperliquid broken down by trader cohort.
- [Who Bought/Sold](https://docs.nansen.ai/api/token-god-mode/who-bought-sold.md)
- [DEX Trades](https://docs.nansen.ai/api/token-god-mode/dex-trades.md)
- [Token Transfers](https://docs.nansen.ai/api/token-god-mode/token-transfers.md)
- [Jupiter DCAs](https://docs.nansen.ai/api/token-god-mode/jupiter-dcas.md)
- [PnL Leaderboard](https://docs.nansen.ai/api/token-god-mode/pnl-leaderboard.md)
- [Perp Screener](https://docs.nansen.ai/api/token-god-mode/perp-screener.md)
- [Perp PnL Leaderboard](https://docs.nansen.ai/api/token-god-mode/perp-pnl-leaderboard.md)
- [Perp Positions](https://docs.nansen.ai/api/token-god-mode/perp-positions.md)
- [Perp Trades](https://docs.nansen.ai/api/token-god-mode/perp-trades.md)


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/token-god-mode.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
