> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/data-coverage.md).

# Data Coverage by Chain

How far back Nansen data goes on each chain, and how fresh live data is.

This page is the single source of truth for **how far back Nansen indexes each chain** and **how fresh live data is**. Individual endpoint pages link here for historical coverage; any endpoint that applies its own stricter limit says so on its own page.

### Data freshness

* **Live data (queries whose date range includes today):** underlying on-chain activity is indexed in near real time — typically reflected within seconds to a couple of minutes. Some endpoints additionally serve current-day responses from a short cache (up to 5 minutes) to protect performance.
* **Historical data (fully past date ranges):** intended for point-in-time analysis after a short settlement period. Historical endpoints avoid look-ahead bias where point-in-time sources are available, but results are not immutable response snapshots. Results may still be revised for late-arriving or backfilled onchain data, data-quality corrections, historical-price fixes, attribution or label-history updates, token metadata changes, sector reclassification, and blacklist updates. Recently-closed windows are served fresh until they settle.

### Historical coverage

Each chain is indexed from its genesis (or Nansen's onboarding point for that chain) forward. Earliest available data:

| Chain           | Data available from |
| --------------- | ------------------- |
| Ethereum        | 30 Jul 2015         |
| Tron            | 25 Jun 2018         |
| TON             | 15 Nov 2019         |
| Solana          | 17 Mar 2020         |
| Polygon         | 30 May 2020         |
| NEAR            | 21 Jul 2020         |
| BNB Chain (BSC) | 29 Aug 2020         |
| Avalanche       | 23 Sep 2020         |
| Ronin           | 25 Jan 2021         |
| Arbitrum        | 29 May 2021         |
| Injective       | 30 Jun 2021         |
| Optimism        | 11 Nov 2021         |
| Starknet        | 04 Apr 2022         |
| Chiliz          | 08 Feb 2023         |
| Sui             | 12 Apr 2023         |
| Base            | 15 Jun 2023         |
| Mantle          | 02 Jul 2023         |
| Linea           | 06 Jul 2023         |
| Scroll          | 10 Oct 2023         |
| IOTA EVM        | 15 Mar 2024         |
| Sei             | 27 May 2024         |
| Mantra          | 17 Oct 2024         |
| Sonic           | 01 Dec 2024         |
| HyperEVM        | 18 Feb 2025         |
| Katana          | 08 May 2025         |
| Monad           | 14 May 2025         |
| Somnia          | 22 May 2025         |
| Plasma          | 03 Sep 2025         |
| Citrea          | 25 Nov 2025         |
| Robinhood       | 30 Apr 2026         |
| Arc             | 15 Jul 2026         |

Chains that onboarded before mid-2023 (Ethereum through Linea above) offer **3+ years** of history; newer chains offer proportionally less.

{% hint style="info" %}
**Hyperliquid perpetuals** (e.g. the perp PnL leaderboard) are a separate dataset from the chains above, with reliable data from **May 2025** onward.
{% endhint %}

{% hint style="info" %}
**Prediction markets** (Polymarket) are a separate dataset from the chains above. Trade, price, and PnL history is available from **November 2022** onward, and updates live (within the standard latency).
{% endhint %}

### How this maps to endpoints

For most endpoints, coverage for a given chain equals the start date above. An endpoint returns data as far back as the chain allows, bounded only by your requested date range. Where an endpoint enforces its own limit (for example, a reduced max date range per request for a few extremely high-volume addresses), that limit is documented on the endpoint's own page.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/data-coverage.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
