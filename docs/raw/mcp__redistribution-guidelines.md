> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/mcp/redistribution-guidelines.md).

# MCP Data Redistribution Guidelines

### Purpose <a href="#purpose" id="purpose"></a>

These guidelines help developers understand how to legally and responsibly redistribute data obtained from Nansen API and MCP tools, while protecting Nansen's proprietary insights and competitive advantage.

### Quick Reference: Can You Redistribute? <a href="#quick-reference-can-you-redistribute" id="quick-reference-can-you-redistribute"></a>

#### Wallet Profiler

| Tool Name                        | Redistribution Status | Requirements         |
| -------------------------------- | --------------------- | -------------------- |
| `address_portfolio`              | ✅ Allowed             | None                 |
| `address_historical_balances`    | ✅ Allowed             | None                 |
| `wallet_pnl_for_token`           | ✅ Allowed             | None                 |
| `wallet_pnl_summary`             | ✅ Allowed             | None                 |
| `address_transactions`           | ✅ Allowed             | Attribution required |
| `address_related_addresses`      | ✅ Allowed             | Attribution required |
| `address_counterparties`         | ✅ Allowed             | Attribution required |
| `address_transactions_for_token` | ✅ Allowed             | Attribution required |

#### Token God Mode

| Tool Name                     | Redistribution Status | Notes                               |
| ----------------------------- | --------------------- | ----------------------------------- |
| `token_ohlcv`                 | ✅ Allowed             | None                                |
| `token_dex_trades`            | ✅ Allowed             | Attribution required                |
| `token_transfers`             | ✅ Allowed             | Attribution required                |
| `token_who_bought_sold`       | ✅ Allowed             | Attribution required                |
| `token_flows`                 | ✅ Allowed             | Attribution required                |
| `token_recent_flows_summary`  | ✅ Allowed             | Attribution required                |
| `token_jup_dca`               | ✅ Allowed             | Attribution required                |
| `token_exchange_transactions` | ✅ Allowed             | Attribution required                |
| `token_discovery_screener`    | ✅ Allowed             | Attribution required                |
| `token_current_top_holders`   | ⚠️ Restricted         | Approval + Significant Modification |
| `token_pnl_leaderboard`       | 🚫 Prohibited         | Not permitted                       |

#### Smart Money

<table><thead><tr><th width="353.046875">Tool Name</th><th>Redistribution Status</th><th>Notes</th></tr></thead><tbody><tr><td><code>smart_traders_and_funds_netflows</code></td><td>⚠️ Restricted</td><td>Approval + Significant Modification</td></tr><tr><td><code>smart_traders_and_funds_token_balances</code></td><td>🚫 Prohibited</td><td>Not permitted</td></tr></tbody></table>

***

### Understanding Redistribution Statuses

#### ✅ **Allowed**

You may freely redistribute this data in your products, services, or applications according to Nansen's Terms of Service. No additional permissions needed.

**Example use cases:**

* Displaying wallet balances in your portfolio tracker

***

#### ✅ **Allowed (with attribution)**

You may redistribute this data, but you **must** provide clear attribution to Nansen.

**Attribution requirements:**

* Display "Powered by Nansen API" visibly in your product interface, OR
* Provide a clickable link to [Nansen.ai](https://nansen.ai/) near the data display

**Note:** Attribution is NOT required for personal or internal-only use.

**Example use cases:**

* Token screening dashboards that display real-time token metrics and volume data
* Trading analytics platforms showing DEX trade flows and whale activity
* Portfolio management apps displaying counterparties
* Research reports examining flow intelligence patterns across tokens

***

#### ⚠️ **Restricted By-Default**

These endpoints contain Nansen's proprietary smart money insights and require **both** approval AND significant data modification.

**You must:**

1. Submit a request for approval via [this form](https://forms.gle/AoXk9jRdbuiqqG5f9)
2. Demonstrate significant data transformation (see requirements below)
3. Provide clear attribution to Nansen

**This data cannot be redistributed without meeting these requirements.**

***

#### 🚫 **Prohibited**

Redistribution is **NOT allowed** under any circumstances. These endpoints contain Nansen's most sensitive proprietary data and competitive advantages.

**Do not:**

* Display this data in any public or customer-facing interface
* Use this data to build competing products
* Redistribute this data through APIs, exports, or any other means

**Internal use only:** You may use this data for your own internal analysis, but not share it externally.

***

### What is "Significant Modification"?

To redistribute smart money data, you must transform it substantially so that:

1. **Not Directly Traceable**: The output cannot be reverse-engineered to reveal Nansen's underlying smart money classifications, wallet lists, or raw activity data
2. **Meaningfully Combined**: The data must be integrated with at least one other substantial, independent data source (not just cosmetic additions)
3. **Novel Insights**: Your final output must provide unique analysis or value-add beyond what Nansen already offers

<details>

<summary>✅ <strong>ALLOWED Use Cases</strong> (with approval)</summary>

#### 1. **AI Agent Background Analysis**

Using smart money data as one input among multiple sources to generate unique analytical responses.

**✓ Good Example:**

> Your AI agent analyzes: Nansen smart money flows (30%) + on-chain volume metrics (30%) + social sentiment analysis (20%) + technical indicators (20%) → generates custom investment thesis that synthesizes all sources

**✗ Bad Example:**

> Your AI agent says: "Smart money wallets bought 5M tokens in the last 24 hours according to Nansen data"

#### 2. **Custom Composite Indicators**

Building proprietary trading signals that incorporate smart money data alongside other metrics.

**✓ Good Example:**

> A "Token Momentum Score" (0-100) that combines:
>
> * Smart money net flow (25%)
> * DEX liquidity depth (25%)
> * Price action volatility (25%)
> * Developer activity (25%)

**✗ Bad Example:**

> A "Smart Money Activity Index" that's just a reformatted version of Nansen's smart money inflow data

#### 3. **Research Reports & Analysis**

Periodic research that synthesizes smart money trends with broader market context.

**✓ Good Example:**

> Weekly market report: "DeFi sector analysis combining smart trader positioning (via Nansen), protocol TVL trends (via DeFiLlama), and governance activity (via on-chain data) suggests..."

**✗ Bad Example:**

> Daily newsletter that lists: "Top 10 tokens smart money bought yesterday" with minimal additional context

</details>

<details>

<summary>🚫 <strong>PROHIBITED Use Cases</strong></summary>

#### 1. **Direct Display Dashboards**

Any interface where Nansen's smart money data is shown without substantial transformation.

**Examples of what NOT to do:**

* Dashboards showing "Smart Money bought these tokens in last 24h"
* Charts displaying raw smart money wallet balances over time
* Tables listing smart money trades with timestamps and amounts
* Real-time feeds of smart money wallet activity

#### 2. **Competing Smart Money Products**

Products that directly compete with or replicate Nansen's core offerings.

**Examples of what NOT to do:**

* "Smart Money Tracker" features
* "Profitable Wallet Scanner" tools
* "Smart Trader Leaderboards"
* "Elite Wallet Following" services

#### 3. **Public Leaderboards & Rankings**

Displaying smart money wallet performance, rankings, or PnL data.

**Examples of what NOT to do:**

* "Top 50 Smart Money Wallets This Month"
* "Highest PnL Smart Traders" rankings
* Public smart money wallet performance dashboards
* Smart money wallet comparison tools

#### 4. **Near Real-Time Data Redistribution**

Redistributing smart money data with minimal time delay or transformation.

**Examples of what NOT to do:**

* API endpoints serving Nansen smart money data with <7d delay
* Webhook notifications for smart money wallet trades
* Real-time smart money activity alerts
* Automated smart money trade copying services

</details>

***

### Requesting Approval for Restricted Endpoints

**Step 1: Submit Your Request**

Complete the approval form: <https://forms.gle/AoXk9jRdbuiqqG5f9>

**Step 2: Provide Required Information**

1. Describe your product, how you'll use the data, and your target audience
2. Explain modifications, other data sources, and provide mockups
3. Show unique insights and differentiation from Nansen's products
4. Detail how you'll credit Nansen and potential partnership opportunities

***

### Attribution Guidelines

**When Attribution is Required**

Required for endpoints marked "✅ Allowed (with attribution)" or "⚠️ Restricted".

**How to Attribute**

Choose one:

* **Text**: "Powered by Nansen API" or similar, displayed near the data
* **Logo**: Nansen logo with link to [nansen.ai](https://nansen.ai/)
* **Footer**: "Blockchain analytics powered by [Nansen](https://nansen.ai/)"

**When Attribution is NOT Required**

* Personal or internal use only
* Endpoints marked "✅ Allowed" (no attribution noted)

***

### General Rules & Compliance

**1. Terms of Service**

* Must comply with Nansen's [Terms of Service](https://www.nansen.ai/legal/terms-of-services)

**2. Stay Updated**

* Check latest guidelines before launching products, changing data usage, or entering new markets

**3. API & MCP Coverage**

* Rules apply to API responses, MCP tools, and derived data

**4. Volume & Rate Limits**

* Redistribution doesn't exempt you from rate limits

**5. Data Accuracy**

* Don't misrepresent data
* Include appropriate disclaimers
* Don't make unwarranted guarantees

**6. Competitive Use**

* Don't build competing products
* Don't use Nansen data as foundation for competitor services
* Don't repackage data to commoditize Nansen's insights


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/mcp/redistribution-guidelines.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
