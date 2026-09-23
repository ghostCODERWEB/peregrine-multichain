> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/mcp/tools.md).

# Tools supported by Nansen MCP

## Tools supported by Nansen MCP

Explore the suite of tools available through Nansen MCP. Each tool is purpose-built to deliver actionable blockchain insights — from tracking smart money movements to analyzing token flows and wallet activities.

**Total tools:** 24

{% hint style="info" %}
Grok uses a separate OAuth surface with **12 curated tools**, not this 24-tool catalog: `general_search`, `token_info`, `token_ohlcv`, `token_quant_scores`, `token_discovery_screener`, `token_recent_flows_summary`, `token_who_bought_sold`, `smart_traders_and_funds_token_balances`, `address_portfolio`, `address_counterparties`, `address_related_addresses`, `wallet_pnl_summary`. See [Grok (OAuth)](/mcp/grok.md).
{% endhint %}

> **Protocol:** JSON-RPC 2.0 over Streamable HTTP (SSE)\
> **Endpoint:** `https://mcp.nansen.ai/ra/mcp`\
> **Auth:** `NANSEN-API-KEY` header\
> **Required header:** `Accept: application/json, text/event-stream`

### Quick Reference

<table><thead><tr><th width="322.33203125">Tool</th><th>Description</th><th width="103.96484375">Credits</th></tr></thead><tbody><tr><td><code>smart_traders_and_funds_token_balances</code></td><td>Smart money holdings &#x26; 24h changes</td><td>5</td></tr><tr><td><code>smart_traders_and_funds_perp_trades</code></td><td>Smart money perpetual trades (HyperLiquid)</td><td>5</td></tr><tr><td><code>token_current_top_holders</code></td><td>Top token holders with labels</td><td>5</td></tr><tr><td><code>token_dex_trades</code></td><td>DEX trading activity for a token</td><td>1</td></tr><tr><td><code>token_transfers</code></td><td>Token transfer history</td><td>1</td></tr><tr><td><code>token_flows</code></td><td>Hourly aggregated token flows by segment</td><td>1</td></tr><tr><td><code>token_pnl_leaderboard</code></td><td>Trader PnL rankings for a token</td><td>5</td></tr><tr><td><code>token_who_bought_sold</code></td><td>Total bought/sold by address (DEX)</td><td>1</td></tr><tr><td><code>token_recent_flows_summary</code></td><td>Flow summary by segment (Smart Money, Whales, etc.)</td><td>1</td></tr><tr><td><code>token_discovery_screener</code></td><td>Multi-chain token screening with filters</td><td>1</td></tr><tr><td><code>token_ohlcv</code></td><td>OHLCV price data with auto interval</td><td>1</td></tr><tr><td><code>token_quant_scores</code></td><td>Quantitative scores for a token</td><td>2</td></tr><tr><td><code>nansen_score_top_tokens</code></td><td>Top tokens ranked by Nansen score</td><td>1</td></tr><tr><td><code>address_historical_balances</code></td><td>Historical token &#x26; native coin balances</td><td>1</td></tr><tr><td><code>address_related_addresses</code></td><td>First funders, signers, deployed contracts</td><td>1</td></tr><tr><td><code>address_counterparties</code></td><td>Most interacted addresses/entities</td><td>5</td></tr><tr><td><code>address_transactions</code></td><td>Recent transactions for an address</td><td>1</td></tr><tr><td><code>wallet_pnl_for_token</code></td><td>PnL for a specific token by wallet</td><td>1</td></tr><tr><td><code>wallet_pnl_summary</code></td><td>Overall realized PnL for a wallet</td><td>1</td></tr><tr><td><code>address_portfolio</code></td><td>Full portfolio overview &#x26; DeFi positions</td><td>1</td></tr><tr><td><code>general_search</code></td><td>Search tokens, entities, and addresses. Token/entity results are free; address/EOA lookups cost 500 credits.</td><td>0–500</td></tr><tr><td><code>growth_chain_rank</code></td><td>Chain growth rankings by key metrics</td><td>1</td></tr><tr><td><code>hyperliquid_leaderboard</code></td><td>Top HyperLiquid traders leaderboard</td><td>9</td></tr><tr><td><code>transaction_lookup</code></td><td>Transaction details with transfers (EVM)</td><td>1</td></tr></tbody></table>

#### Common Gotchas

1. **Most tools** wrap arguments in `{"request": {...}}` but `general_search` and `transaction_lookup` take **flat args**
2. **Date ranges** use object format: `{"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}`
3. **Wallet tools** use `addresses: ["0x..."]` (plural array), not `address: "0x..."` — except `wallet_pnl_for_token`, `wallet_pnl_summary` (singular `address`), and `address_portfolio` (`wallet_address`)
4. **Enum values are case-sensitive:** `"BUY"` / `"SELL"` — not lowercase
5. **HyperLiquid dates** accept relative strings: `"7D_AGO"`, `"30D_AGO"`, `"NOW"`
6. **`general_search` has variable cost:** token/entity queries = 0 credits (free); address/ENS/.sol domain queries = 500 credits (premium label lookup)


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/mcp/tools.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
