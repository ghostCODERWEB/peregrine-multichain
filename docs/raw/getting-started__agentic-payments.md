> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/getting-started/agentic-payments.md).

# Agentic Payments

Call the Nansen API without an account, subscription, or API key. Pay per request in USDC and get data back.

Agentic payments let machines: AI agents, scripts, bots access Nansen data on demand, settling each call on-chain. No provisioning, no key management, no long-lived credentials. Sign a payment, make the request, get the response.

Nansen supports two agentic payment rails on the same `/api/v1/*` endpoints:

* **x402:** The open HTTP payment standard. USDC on Base, Solana, or Monad. Broad client-side tooling and SDK support. Best for agents already operating on those networks.
* **MPP on Tempo:** Machine Payments Protocol settlement on Tempo mainnet. Sub-cent per-call pricing. Best for agents already settling on Tempo or optimising for per-call cost.

Both rails hit the same endpoints and return identical response bodies. An agent can mix and match x402 for some calls, MPP for others.

### Supported endpoints

All Pro-tier `POST` endpoints accept agentic payments, except:

* `/api/v1/profiler/address/labels` and `/api/v1/profiler/address/premium-labels` — Pro subscription only (proprietary entity data).
* `/api/v1/smart-alert*` and `/api/v1/portfolio/defi-holdings` — tied to a Nansen account.

Endpoints that are free on every plan (for example `/api/v1/account`, `/api/v1/search/general`, `/api/v1/search/entity-name`, and the DEX and perp trading endpoints) and all `GET` endpoints are not priced and require an API key.

The [OpenAPI specification](https://api.nansen.ai/openapi.json) is the machine-readable source: every pay-per-request operation carries an `x-payment-info` extension and lists `X402Payment` and `MppPayment` as security alternatives to `ApiKeyAuth`. Operations that list only `ApiKeyAuth` require an API key.

Pricing is tiered by endpoint:

| Tier        | Price      | Examples                                                              |
| ----------- | ---------- | --------------------------------------------------------------------- |
| Basic       | $0.01/call | Token Screener, Wallet Balances, Transactions, PnL, DEX Trades, Flows |
| Premium     | $0.05/call | Counterparties, Holders, PnL Leaderboard, Perp Leaderboard            |
| Smart Money | $0.05/call | SM Net Flow, SM Inflows, SM Holdings, SM DEX Trades                   |

The full endpoint list and tier breakdown is on the [x402](https://AI assistant/chat/x402#pricing) page. MPP uses the same tiers and prices.

### Discovery

Fetch `/.well-known/x402` to see every priced endpoint, its cost, and which payment protocols it supports:

```bash
curl -s https://api.nansen.ai/.well-known/x402 | jq
```

The `paymentProtocols` field lists the rails available for each endpoint (`x402`, `mpp`, or both).

### Inspect the response before paying

An unpaid x402 request returns a `402 Payment Required` response whose `PAYMENT-REQUIRED` header includes Bazaar discovery metadata. The Bazaar `output` schema describes the paid response before you sign or submit a payment, including:

* the top-level response envelope;
* the fields and JSON types returned in list items; and
* pagination fields where the endpoint is paginated.

To keep the discovery header bounded, nested output schemas are summarized to three levels. Objects below that depth remain identified as objects, but their deeper fields are intentionally omitted.

The output metadata is derived from the same response contract used by the endpoint, so it stays aligned with the documented API response rather than being maintained as a separate schema.

For example, Token Screener advertises a response object containing a `data` array of token result fields and a `pagination` object. Buyer agents can use this contract to decide whether the response is useful before making the paid retry.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/getting-started/agentic-payments.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
