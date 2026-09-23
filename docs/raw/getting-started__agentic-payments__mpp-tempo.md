> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/getting-started/agentic-payments/mpp-tempo.md).

# MPP (Tempo)

Pay-per-call access to the Nansen API using USDC on Tempo, via the Machine Payments Protocol (MPP). Any `/api/v1/*` endpoint that supports pay-per-call can be invoked anonymously by signing a Tempo payment instead of presenting an API key — no account, no subscription, no bearer token.

MPP is one of two agentic payment rails supported by Nansen; the other is x402. The same endpoints accept both.

### When to use MPP

* Agents or machines that need ad-hoc access to a handful of calls without provisioning an API key.
* Integrations that already settle on Tempo and want sub-cent per-call pricing on the same rail.
* Environments where storing a long-lived API key is undesirable.

### Quick start

Install the Tempo CLI and log in to a funded mainnet wallet:

```bash
curl -fsSL https://tempo.xyz/install | bash
tempo wallet login
tempo wallet whoami          # expect "ready": true
```

Then call any priced endpoint with `Authorization: Payment`:

```bash
tempo request -X POST https://api.nansen.ai/api/v1/tgm/indicators \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Payment' \
  --json '{"chain":"ethereum","token_address":"0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9"}'
```

The CLI handles the challenge/sign/retry loop for you. On success you get the endpoint's JSON response plus a `Payment-Receipt` header.

### How it works

```
  Client                              Nansen API
    |                                     |
    |  POST /api/v1/...                   |
    |  Authorization: Payment             |
    |  (no signed credential yet)         |
    |------------------------------------>|
    |                                     |
    |   402 Payment Required              |
    |   WWW-Authenticate: Payment ...     |
    |<------------------------------------|
    |                                     |
    |  Sign challenge with Tempo wallet   |
    |                                     |
    |  POST /api/v1/...                   |
    |  Authorization: Payment <signed>    |
    |------------------------------------>|
    |                                     |
    |   200 OK                            |
    |   Payment-Receipt: <base64>         |
    |<------------------------------------|
```

1. Client sends the request with `Authorization: Payment`.
2. Server returns `402 Payment Required` with a `WWW-Authenticate: Payment` header advertising a fresh challenge (amount, currency, chain, recipient, expiry).
3. Client signs the challenge with a wallet funded on Tempo mainnet.
4. Client retries the same request with the signed credential.
5. Server verifies the on-chain settlement, runs the endpoint, and returns the response plus a `Payment-Receipt` header referencing the tx hash.

### Discovery

Fetch `/.well-known/x402` to see every priced endpoint and its cost, along with which payment protocols are advertised:

```bash
curl -s https://api.nansen.ai/.well-known/x402 | jq
```

Look for `paymentProtocols` containing `"mpp"` to confirm the rail is live.

### Troubleshooting

**I signed the challenge but still got 402.** Challenges expire \~30 seconds after issue. If your signing + retry takes longer, the server issues a fresh challenge in the next 402. Sign that one instead.

**402 says my signature is invalid.** Check that your wallet is on Tempo mainnet (`chainId 4217`), not a testnet. Testnet signatures are rejected by the prod API.

**I got 200 but no `Payment-Receipt` header.** The response went through a proxy that stripped it. Confirm `Access-Control-Expose-Headers` includes `Payment-Receipt` on the response — if so, adjust your client to read exposed headers explicitly (relevant for browsers reading cross-origin responses).

**`Payment-Receipt.status` is not `success`.** The payment was accepted but the downstream endpoint failed. Re-examine the HTTP status and body — your wallet was charged, but you may need to retry against a different payload.

**Insufficient balance.** Fund your Tempo mainnet wallet via `tempo wallet fund` (which walks you through bridges: LayerZero/Stargate, Squid, Relay, Across, Bungee).

### Limits and known behaviour

* **Per-call latency.** MPP settlement adds roughly one Tempo block-time to each request. For latency-sensitive workloads, an API key is faster.
* **No session reuse yet.** Each request signs a fresh challenge; there is no open-channel / prefunded-session mode today.
* **Idempotency across pods.** Replaying an identical signed challenge is guarded in-memory per pod. Under extremely high concurrency, a replay across pods is theoretically possible; the on-chain settlement layer still prevents double-charging. Please report any anomalies.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/getting-started/agentic-payments/mpp-tempo.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
