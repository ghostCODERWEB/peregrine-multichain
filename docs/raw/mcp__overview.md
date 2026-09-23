> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/mcp/overview.md).

# Overview

Learn how to connect AI agents to Nansen

Connect your AI tools (Eg. AI assistant, Cursor) using AI provider's Model Context Protocol, a standard that lets AI tools interact with Nansen data.

{% hint style="info" %}
Check out the links below to learn how to connect and access all available tools in MCP.

* **AI assistant (12 curated tools):** [Install Nansen from the AI assistant plugin directory](/mcp/AI assistant.md)
* **Grok (OAuth, 12 curated tools):** <https://docs.nansen.ai/mcp/grok>

Connecting to Nansen MCP -> <https://docs.nansen.ai/mcp/connecting>

Tools Supported -> <https://docs.nansen.ai/mcp/tools>
{% endhint %}

### What is Nansen MCP?

**Nansen MCP** is a Model Context Protocol (MCP) server that provides access to Nansen's institutional-grade blockchain intelligence platform. It transforms Nansen's onchain intelligence into an accessible interface that AI agents, developers, and researchers can use to analyze crypto markets and blockchain activity.

#### Core Offering

* **MCP Protocol**: Built on the standardized Model Context Protocol, ensuring compatibility with AI tools like AI assistant, Cursor, and other MCP-compatible clients
* **Multi-Chain Coverage**: Supports 25+ major blockchains including Ethereum, Solana, Bitcoin, Arbitrum, Base, Polygon, and more
* **Real-Time Data**: Provides access to live blockchain data including transactions, token movements, wallet activities, dex trades and PnL

### Why Use Nansen MCP?

AI tools currently have no visibility into what's happening onchain. Even answering simple blockchain queries is extremely difficult without proper data access and context. Nansen MCP gives AI tools the ability to see and understand onchain activities, transforming them into powerful blockchain research assistants.

#### **1. Real-Time Access to Nansen's Rich Data**

* Access to Nansen's proprietary wallet labeling system with millions of identified addresses including smart money labels
* Institutional-grade data accuracy and reliability
* Real-time processing of onchain activities across multiple blockchains

#### **2. AI-Native Integration**

* One-click installation with AI assistant Desktop
* No need to struggle with complex APIs or documentation - everything works out of the box
* Build custom AI agents and LLMs with blockchain intelligence

#### **3. Streamlined Research Workflows**

* Saves time by wrapping complex workflows into simpler tasks
* Automate onchain research that would take hours manually
* Generate insights from multiple data sources simultaneously

### What Can You Do with Nansen MCP?

#### **Smart Money Tracking**

Track DEX trades, token holdings, and portfolio changes of profitable traders and funds. Discover tokens gaining traction among smart money before broader market adoption.

#### **Token Intelligence & Discovery**

Screen thousands of tokens across multiple chains using advanced filters. Analyze real-time trading data, holder distributions, and exchange flows to identify opportunities.

#### **Address & Entity Profiling**

Deep dive into wallet activities, trading patterns, and PnL analysis. Map relationships between wallets and identify connected addresses across all supported blockchains.

#### **Example Prompts**

* "Show me all tokens that funds bought in the last 24 hours"
* "What DCA strategies are profitable traders using on Jupiter?"
* "Find new tokens with high smart money inflows and growing trading volume"
* "Show me trending tokens with liquidity above $100k"
* "Analyze the trading performance of this whale address"
* "Find wallets connected to this successful trader"
* "Track how this fund's portfolio allocation has changed over time"
* "Do a deep dive into this wallet to find whom does it belong to"


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/mcp/overview.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
