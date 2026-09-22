> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/getting-started/credits.md).

# Credits & Pricing Guide

Welcome to our updated API pricing and credit system. We’ve made it easier to get started, scale up, and pay only for what you need.

## Available API Plans

We offer two main API plans to fit your needs:

<table><thead><tr><th>Plan</th><th>Credits Included</th><th width="109.5078125">Top Ups</th><th>Intended Use</th></tr></thead><tbody><tr><td>Pro</td><td>2,000 credits to start,<br>then a monthly top-up of your included credits back up to 2,000</td><td>✅</td><td>Professional, production, and high volume integrations</td></tr><tr><td>Free</td><td>100 trial credits, then a daily top-up of your included credits to a 10-credit balance</td><td>✅</td><td>Brief experimentation and testing</td></tr></tbody></table>

For more information on plan features, visit [our pricing page](https://app.nansen.ai/account/switch-plans).

### Pro Plan Details

* Subscription: $49/month (annual) or $69/month (monthly)
* Included Credits: a one-time grant of 2,000 credits when you subscribe, then a monthly top-up that brings your included credit balance back up to 2,000 **only if it has fallen below 2,000**. See [How Pro credits are granted and refreshed](#how-pro-credits-are-granted-and-refreshed).
* Flexi-Credits: Purchase as many credits as you want, at discounted rates.
* Expiry: Purchased credits expire 1 year from purchase. Included plan credits have no expiry date of their own.

### Free Plan Details

* 100 one-time credits to try the API. After those are used, a daily top-up brings your included credit balance back up to 10 credits if it has fallen below 10.
* Ability to purchase credits
* Access all API endpoints available in Pro

## How Pro Credits Are Granted and Refreshed

Pro credits work the same way as the Free plan's daily top-up, just monthly and at a higher figure: the Free plan tops your included credit balance back up to 10 credits each day, and the Pro plan tops it back up to 2,000 credits each month.

**1. A one-time grant when you subscribe.** Subscribing to Pro grants you 2,000 credits immediately, so you can start building before making your first purchase.

**2. A monthly top-up, applied only if your included credits are below 2,000.** On the 1st of each calendar month (shortly after 00:00 UTC) your included credit balance is checked. If it is **below** 2,000, it is raised back up to 2,000. If it is already **at or above** 2,000, nothing is added that month.

This is a top-up to a floor, not a recurring grant of 2,000 more credits. Unused credits do not roll over into an ever-growing balance, and the monthly top-up never reduces a balance that is already above the floor.

The 2,000 floor is measured against your **included** plan credits only. Purchased top-up credits are held separately: they are never counted toward the floor and never reduce or delay the monthly top-up. If your included balance is below 2,000 on the 1st, it is raised to 2,000 however many purchased credits you are holding, and your purchased balance is left untouched.

**3. The refresh date is the calendar month, not your billing date.** The top-up runs on the 1st of the month for everyone. It is not tied to your subscription start date or billing anniversary — if you subscribe on the 20th, your first monthly top-up is on the 1st of the following month (and it will only add credits if your included balance is below 2,000 by then).

**4. Included credits are spent before purchased credits.** Every request draws down your included plan credits first. Purchased top-up credits are only used once your included credits reach zero. Among purchased credits, the batch expiring soonest is used first, so credits are not left to expire while newer ones are spent.

### Worked Examples

Each row shows a Pro account on the 1st of the month, immediately before and after the monthly top-up. Only the included-credits column decides whether a top-up happens.

| Included credits left | Purchased credits left | Top-up adds | Included after | Total after |
| --------------------- | ---------------------- | ----------- | -------------- | ----------- |
| 0                     | 0                      | 2,000       | 2,000          | 2,000       |
| 500                   | 0                      | 1,500       | 2,000          | 2,000       |
| 2,000                 | 0                      | 0           | 2,000          | 2,000       |
| 0                     | 1,200                  | 2,000       | 2,000          | 3,200       |
| 0                     | 5,000                  | 2,000       | 2,000          | 7,000       |
| 2,000                 | 3,000                  | 0           | 2,000          | 5,000       |

## Endpoint Credit Cost

Credit costs are structured to reflect the value of the data you’re accessing. Foundational data is inexpensive to encourage frequent use, while our proprietary, alpha-generating data costs more.

The endpoint names below omit the common `/api/v1/` prefix. For example, `prediction-market/pnl-by-market` refers to `POST /api/v1/prediction-market/pnl-by-market`.

A cost of `0` means the request does not use plan credits. The endpoint is still subject to the plan’s access and usage limits.

<table><thead><tr><th width="427.9609375" valign="top">Endpoint</th><th valign="top">Free</th><th valign="top">Pro</th></tr></thead><tbody><tr><td valign="top">account</td><td valign="top">0</td><td valign="top">0</td></tr><tr><td valign="top">search/general</td><td valign="top">0</td><td valign="top">0</td></tr><tr><td valign="top">search/entity-name</td><td valign="top">0</td><td valign="top">0</td></tr><tr><td valign="top">search/token-sectors</td><td valign="top">1</td><td valign="top">0</td></tr><tr><td valign="top">profiler/address/current-balance</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">profiler/address/historical-balances</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">profiler/address/transactions</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">profiler/address/related-wallets</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">profiler/address/pnl-summary</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">profiler/address/pnl</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">profiler/perp-positions</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">profiler/perp-trades</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">profiler/dex-trades</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">portfolio/defi-holdings</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/transfers</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/jup-dca</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/flow-intelligence</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/who-bought-sold</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/dex-trades</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/flows</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/token-information</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/token-ohlcv</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/perp-trades</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">tgm/position-intelligence</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">perp-screener</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">token-screener</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">transaction-with-token-transfer-lookup</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">chains/chain-rank</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">prediction-market/ohlcv</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">prediction-market/orderbook</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">prediction-market/trades-by-market</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">prediction-market/trades-by-address</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">prediction-market/market-screener</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">prediction-market/event-screener</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">prediction-market/pnl-by-address</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">prediction-market/address-summary</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">prediction-market/categories</td><td valign="top">1</td><td valign="top">1</td></tr><tr><td valign="top">smart-money/netflow</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">smart-money/holdings</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">smart-money/dex-trades</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">smart-money/dcas</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">smart-money/pnl-leaderboard</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">smart-money/perp-trades</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">profiler/address/counterparties</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">tgm/holders <sup>†</sup></td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">tgm/pnl-leaderboard <sup>†</sup></td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">tgm/indicators</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">tgm/perp-positions</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">tgm/perp-pnl-leaderboard <sup>†</sup></td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">perp-leaderboard <sup>†</sup></td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">prediction-market/top-holders</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">prediction-market/pnl-by-market</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">prediction-market/position-detail</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">ra-agent/posts-by-token</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">ra-agent/posts-by-user</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">search/web-search</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">search/web-fetch</td><td valign="top">20</td><td valign="top">20</td></tr><tr><td valign="top">profiler/address/labels (common labels)</td><td valign="top">100</td><td valign="top">100</td></tr><tr><td valign="top">profiler/address/premium-labels</td><td valign="top">500</td><td valign="top">500</td></tr><tr><td valign="top">agent/fast</td><td valign="top">200</td><td valign="top">200</td></tr><tr><td valign="top">agent/expert</td><td valign="top">750</td><td valign="top">750</td></tr><tr><td valign="top">tgm/historical-dex-trades</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">tgm/historical-who-bought-sold</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">tgm/historical-token-flow-summary</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">tgm/historical-token-ohlcv</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">token-screener/historical</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">profiler/address/historical-token-balances</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">profiler/address/historical-transactions</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">profiler/historical-transaction-lookup</td><td valign="top">5</td><td valign="top">5</td></tr><tr><td valign="top">tgm/historical-top-holders</td><td valign="top">25</td><td valign="top">25</td></tr><tr><td valign="top">tgm/historical-pnl-leaderboard</td><td valign="top">25</td><td valign="top">25</td></tr><tr><td valign="top">tgm/historical-token-quant-scores</td><td valign="top">25</td><td valign="top">25</td></tr><tr><td valign="top">smart-money/historical-token-balances</td><td valign="top">25</td><td valign="top">25</td></tr></tbody></table>

<sup>†</sup> Costs 150 credits per call when `premium_labels=true` is passed.

## FAQs

**Do my 2,000 Pro credits refresh every month, or is it a one-time grant?**

Both, in a sense. You get a one-time grant of 2,000 credits when you subscribe. After that, a monthly top-up on the 1st of each calendar month (UTC) brings your included credit balance back up to 2,000 — but only if it has fallen below 2,000. It is not an extra 2,000 credits every month. See [How Pro credits are granted and refreshed](#how-pro-credits-are-granted-and-refreshed).

**Do unused credits carry over to the next month?**

Included plan credits do not accumulate above the 2,000 floor: the monthly top-up raises a below-floor balance up to 2,000 rather than adding to it, so months of light usage do not build up a larger allowance. An unused balance is never taken away either — the top-up only ever raises it. Purchased credits are different: they persist until spent, or until they expire 1 year after purchase, and they have no effect on whether your included credits are topped up.

**Which credits are used first: my included plan credits or my purchased top-ups?**

Included plan credits are always spent first. Purchased top-ups are only drawn on once your included credits reach zero, and the batch expiring soonest is used first.

**What happens if I run out of credits?**

You can purchase additional credit blocks at any time to ensure your service is not interrupted.

**How do I track my credit usage?**

You can track your credit usage by visiting this link: <https://app.nansen.ai/api?tab=usage-analytics>


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/getting-started/credits.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
