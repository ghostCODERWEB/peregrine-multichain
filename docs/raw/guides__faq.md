> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/faq.md).

# Frequently Asked Questions

### Authentication

<details>

<summary>How can developers obtain API keys and access Nansen’s API endpoints?</summary>

You can request an API key by signing up on Nansen. You can find the detailed steps [here](https://docs.nansen.ai/getting-started/authentication#obtaining-api-keys).

</details>

#### Available Endpoints

<details>

<summary>What types of data are available through Nansen’s API (e.g., wallet balances, token prices, labeled transactions)?</summary>

The API provides access to wallet balances, transaction data, exchange flows, smart money tracking and other on-chain analytics across multiple chains. You can find the full list of endpoints [here](https://docs.nansen.ai/endpoints-overview).

</details>

#### API Rate Limits & Quotas

<details>

<summary>What are the usage limits for Nansen’s API?</summary>

Nansen API comes with a flexi-credit plan. You purchase as many credits you need.

</details>

#### **Data Coverage**

<details>

<summary>Can I access labeled transaction data across multiple chains via the API?</summary>

Yes, you can use /transactions to access transaction data and /labels endpoint to fetch labels across multiple chains.

</details>

<details>

<summary>What on-chain metrics are available via Nansen’s API?</summary>

Metrics include wallet balances, token flows, smart money movements, portfolio distributions, and other derived analytics from raw blockchain data. You can find the full list of endpoints [here.](https://docs.nansen.ai/endpoints-overview)

</details>

<details>

<summary>Does the API provide access to smart money wallet activities and behaviors?</summary>

Yes, API allows users to monitor smart money inflows, portfolio holdings and DEX Trades. You can find the full list of Smart Money endpoints [here](https://docs.nansen.ai/api/smart-money).

</details>

<details>

<summary>How does Nansen handle and provide data for non-EVM chains such as Solana or Sui?</summary>

Nansen processes data from non-EVM chains by building native integrations that extract and structure on-chain information similar to EVM-based chains, while adjusting for each chain’s unique architecture. You can find the full list of supported chains [here](https://docs.nansen.ai/getting-started/chain-coverage).

</details>

#### Data Freshness and Performance

<details>

<summary>How frequently is the data updated in the API?</summary>

Data is refreshed at varying intervals, with many endpoints updating in real-time depending on the data type.

</details>

<details>

<summary>What is the typical latency for data delivery through Nansen’s API?</summary>

Typical data latency is low, often within seconds, depending on the chain being queried

</details>

#### Developer Tools and Integration

<details>

<summary>Does Nansen support AI Integration Capabilities?</summary>

Nansen offers MCP support that allows you to connect your AI tools to Nansen's Onchain Data. You can read more and follow steps for access [here](https://docs.nansen.ai/mcp/overview).

</details>

<details>

<summary>Does Nansen offer SDKs, libraries, or tools for integrating analytics into third-party applications like DEXs or wallets?</summary>

No

</details>

<details>

<summary>Can I programmatically perform bulk analysis on wallet data using Nansen’s tools?</summary>

Yes, Nansen’s API endpoints are designed for scalable, programmatic analysis across large datasets of wallets and transactions.

</details>


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/faq.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
