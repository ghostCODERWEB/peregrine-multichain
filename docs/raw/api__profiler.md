> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/profiler.md).

# Profiler

- [Address Current Balances](https://docs.nansen.ai/api/profiler/address-current-balances.md): Get real-time token balance information for any blockchain address or entity
- [Address Historical Balances](https://docs.nansen.ai/api/profiler/address-historical-balances.md): Get historical token balance information for any blockchain address or entity
- [Address DEX Trades](https://docs.nansen.ai/api/profiler/address-dex-trades.md)
- [Address Transactions](https://docs.nansen.ai/api/profiler/address-transactions.md)
- [Address Counterparties](https://docs.nansen.ai/api/profiler/address-counterparties.md): Get counterparties and their interaction statistics for any address or entity.
- [Address Counterparties (Batch)](https://docs.nansen.ai/api/profiler/address-counterparties-batch.md): Batch counterparties lookup — counterparties and interaction statistics for up to 10 wallet addresses in a single request.
- [Address Related Wallets](https://docs.nansen.ai/api/profiler/address-related-wallets.md)
- [Address First Funder](https://docs.nansen.ai/api/profiler/address-first-funder.md)
- [Address PnL & Trade Performance](https://docs.nansen.ai/api/profiler/address-pnl-and-trade-performance.md)
- [Address Labels](https://docs.nansen.ai/api/profiler/address-labels.md): Retrieves all entity and behavioural labels associated with an address on a chain.
- [Address Perp Positions](https://docs.nansen.ai/api/profiler/address-perp-positions.md)
- [Address Perp Trades](https://docs.nansen.ai/api/profiler/address-perp-trades.md)
- [Hyperliquid Address Leaderboard](https://docs.nansen.ai/api/profiler/hyperliquid-address-leaderboard.md)
- [Get Hyperliquid Perp PnL Summary](https://docs.nansen.ai/api/profiler/perp-pnl-summary.md)


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/profiler.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
