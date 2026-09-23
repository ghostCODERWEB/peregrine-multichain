> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/mcp/grok.md).

# Grok (OAuth)

Connect the OAuth-protected Nansen MCP surface in Grok as a custom connector. No API key.

Connect Nansen to Grok to use **12 curated tools** for token and wallet analysis. Sign in with your Nansen account through OAuth. No API key is needed.

### What you need

A Nansen account and a Grok account. Tool calls use your Nansen account's API [credits](/getting-started/credits.md) and [rate limits](/getting-started/rate-limits.md).

### Connect Nansen in Grok

1. Open [grok.com/connectors](https://grok.com/connectors), click **New Connector**, then choose **Custom**.

   ![Select Custom in the New Connector dialog](https://3666025612-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FHE8GKwbmDRKKCMC7hnip%2Fuploads%2Fgit-blob-fa3ccf72be876735caa2709976d1f45680b55653%2Fgrok-new-connector.png?alt=media)
2. Enter **Nansen** in **Name** and paste this **Server URL**:

   ```
   https://mcp.nansen.ai/ra/connector-curated/mcp
   ```

   ![Enter Nansen and the production MCP server URL](https://3666025612-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FHE8GKwbmDRKKCMC7hnip%2Fuploads%2Fgit-blob-d52dc1432418db1bf32c07daaab8df6b6890608e%2Fgrok-server-url.png?alt=media)
3. Click **Add Connector**.
4. On **OAuth Credentials Required**, fill in these two fields:

   * **Client ID:** `grok`
   * **Scopes:** `nansen:read`

   Leave **Client Secret** empty. Keep the prepopulated **Authorization Endpoint**, **Token Endpoint**, and **Token Auth Method** unchanged.

   ![OAuth form with Client ID grok and Scopes nansen:read](https://3666025612-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FHE8GKwbmDRKKCMC7hnip%2Fuploads%2Fgit-blob-54cce51267cce159cac21304e7d700efa964496b%2Fgrok-oauth-credentials.png?alt=media)
5. Click **Save & Connect**. Sign in with your Nansen account and approve access when prompted.
6. Back in Grok, open **Nansen** under **Connected**. Click **See more** and confirm all 12 [curated tools](#curated-tools) are enabled.
7. Start a chat with the Nansen connector enabled and try:

   > Use Nansen's token\_info tool to look up USDC on Ethereum. Show the tool result.

For AI assistant, Cursor, or another client using a Nansen API key, follow [Connecting to Nansen MCP](/mcp/connecting.md) and [Tools supported by Nansen MCP](/mcp/tools.md).

### Grok Business and Enterprise

For **Grok Business** and **Enterprise**, a team admin provisions the connector in the cloud console before members of the organization can connect their Nansen accounts.

1. Sign in at [console.x.ai](https://console.x.ai), select your team, and open **Grok Business → Connectors**.
2. Click **+ Add Connector**, then select **Other**.
3. Enter `https://mcp.nansen.ai/ra/connector-curated/mcp` and complete any required authentication.
4. After the admin provisions it, members connect their own Nansen accounts on [grok.com/connectors](https://grok.com/connectors).

Adding and removing connectors requires Team Read-Write permissions, typically granted to team admins. If the custom-connector option is missing, ask a team admin to provision it.

### Curated tools

The connector includes **exactly 12** tools:

| Tool                                     | Title                            | Description                                                                                                                                                                      |
| ---------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `general_search`                         | Searching Nansen                 | Search for a token or entity, or resolve an address label or .eth/.sol domain, before detailed analysis.                                                                         |
| `token_info`                             | Loading token info               | Get spot token metadata, market data, supply, liquidity, and holder counts, or Hyperliquid perp stats including mark price, funding rate, and open interest.                     |
| `token_ohlcv`                            | Loading price data               | Get open/high/low/close prices and volume for a spot token or Hyperliquid perp over any time range, including the latest price, at automatically chosen intervals.               |
| `token_quant_scores`                     | Loading token scores             | Assess a spot token's risk and reward with Nansen quantitative indicators covering momentum, funding, liquidity, concentration, and supply. Hyperliquid perps are not supported. |
| `token_discovery_screener`               | Discovering tokens               | Discover spot tokens by market, flow, sector, age, and trader filters, or Hyperliquid perps by open interest, funding, netflow, and cohorts.                                     |
| `token_recent_flows_summary`             | Summarizing recent token flows   | Compare recent on-chain flows across Smart Money, whales, exchanges, fresh wallets and other cohorts, or current aggregate long/short positioning by cohort on Hyperliquid.      |
| `token_who_bought_sold`                  | Finding token buyers and sellers | Find the wallets that bought or sold a token on decentralised exchanges in a period, with their Nansen labels and buy/sell volumes.                                              |
| `smart_traders_and_funds_token_balances` | Checking Smart Money positions   | Get current token balances held by Smart Traders and funds, aggregated across wallets with 24h change. Excludes whales, large holders, and influencers.                          |
| `address_portfolio`                      | Loading a wallet portfolio       | Get a complete wallet portfolio, including token balances, DeFi positions, and supported Hyperliquid spot and perp positions, or an entity's aggregated token balances.          |
| `address_counterparties`                 | Finding wallet counterparties    | Find the wallets and entities that transact most with a given address or entity, ranked by transfer volume, with the top tokens moved between them.                              |
| `address_related_addresses`              | Finding related wallets          | Find special address relationships such as first funders, signers, multisig signers, deployers, and created contracts.                                                           |
| `wallet_pnl_summary`                     | Analyzing wallet performance     | Analyze spot/on-chain realized wallet PnL, or Hyperliquid realized PnL plus current unrealized PnL for open perp positions.                                                      |

These are a curated subset of the [API-key tool catalog](/mcp/tools.md).

### Manage access

The connector uses the Nansen account you selected during sign-in. To sign in again, open the connector and click **Reauthenticate**. To remove it from Grok, click **Disconnect**.

### Rate limits

See [Nansen API rate limits](/getting-started/rate-limits.md).

### Errors and what to do

This surface fails closed. A failed tool call returns a **safe failure message that includes a request ID**. Give that request ID to support. The message does not expose tokens, API keys, account IDs, or internal details.

| What you see                                                             | What it means                                                   | What to do                                                                                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Sign-in / authorize prompt again                                         | Missing, expired, or invalid OAuth session                      | Complete consent again with the same Nansen account                                                     |
| Scope / permission denied                                                | The session lacks `nansen:read`                                 | Set **Scopes** to `nansen:read` in the connector OAuth settings, then reconnect                         |
| Rate limit / try again later                                             | Your Nansen plan's request cap was hit                          | Wait, then retry. Honor any retry hint Grok shows                                                       |
| Insufficient credits                                                     | The signed-in account cannot pay for the tool                   | Add credits or upgrade at [app.nansen.ai](https://app.nansen.ai/account/switch-plans)                   |
| Failed tool call with a request ID                                       | The tool ran and returned a safe error                          | Copy the request ID and send it to support. Do not send tokens or screenshots of secrets                |
| Missing tools or names that do not match [Curated tools](#curated-tools) | Wrong URL, or the connector did not finish discovery            | Confirm the URL is `https://mcp.nansen.ai/ra/connector-curated/mcp`, then recreate the custom connector |
| Tools listed but no data                                                 | OAuth did not complete, or the account has no remaining credits | Re-run consent, then check [usage](https://app.nansen.ai/api?tab=usage-analytics)                       |

If a tool call fails, keep the **request ID**, start a **new chat**, and retry. Do not paste API keys or bearer tokens into the chat.

### Choose the right surface

|       | Grok (this page)                                 | AI assistant, Cursor, and other clients     |
| ----- | ------------------------------------------------ | ------------------------------------- |
| URL   | `https://mcp.nansen.ai/ra/connector-curated/mcp` | `https://mcp.nansen.ai/ra/mcp`        |
| Auth  | Nansen OAuth (`nansen:read`)                     | `NANSEN-API-KEY` header               |
| Tools | 12 curated tools                                 | [API-key tool catalog](/mcp/tools.md) |
| Setup | Custom connector on this page                    | [Connecting](/mcp/connecting.md)      |


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/mcp/grok.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
