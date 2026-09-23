> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/getting-started/agentic-payments/x402-payments.md).

# x402 Payments

### Overview

x402 enables pay-per-call access to the Nansen API using cryptocurrency. No subscription or API key required. Send a request, pay with USDC on Base, Solana, or Monad, and get data back.

{% hint style="warning" %}
Nansen supports **x402 V2 only**. Deprecated V1 clients and the legacy `X-PAYMENT` request header are not supported. If your client reports `invalid_x402_version`, upgrade it to V2 and send the payment using the `PAYMENT-SIGNATURE` header. See the [official V1-to-V2 migration guide](https://docs.x402.org/guides/migration-v1-to-v2).
{% endhint %}

### How It Works

x402 is an open HTTP payment protocol. When you make a request to a supported endpoint without an API key, the server returns a `402 Payment Required` response with payment instructions. Your client pays the specified amount in USDC, then retries the request with a payment receipt.

#### Request Flow

```
1. Client sends request (no API key)
2. Server returns 402 with payment details
3. Client pays USDC on Base, Solana, or Monad
4. Client retries with payment receipt in header
5. Server verifies payment and returns data
```

#### Example

```bash
# 1. Initial request returns 402 with payment instructions
curl -X POST 'https://api.nansen.ai/api/v1/smart-money/holdings' \
  -H 'Content-Type: application/json' \
  -d '{"chains": ["ethereum"]}'

# Response: 402 Payment Required
# Headers include payment details (amount, recipient, network)
```

With an x402-compatible client, payment and retry happen automatically:

```python
from x402.client import x402_client

client = x402_client(wallet="YOUR_WALLET")

response = client.post(
    "https://api.nansen.ai/api/v1/smart-money/holdings",
    json={"chains": ["ethereum"]}
)
# Payment handled automatically — response contains data
```

### Pricing

All Pro-tier endpoints are available via x402 (except labels endpoint). Pricing is based on endpoint tier.

| Tier            | Price Per Call | Endpoints                                                                       |
| --------------- | -------------- | ------------------------------------------------------------------------------- |
| **Basic**       | $0.01          | Token Screener, Wallet Balances, Transactions, PnL, DEX Trades, Flows, and more |
| **Premium**     | $0.05          | Counterparties, Holders, PnL Leaderboard, Perp Leaderboard                      |
| **Smart Money** | $0.05          | SM Net Flow, SM Inflows, SM Holdings, SM DEX Trades                             |

#### First 100 calls promotion (when enabled)

When advertised in `/.well-known/x402`, each wallet can receive **50% off its first 100 successfully settled x402 calls** in this promotion. A $0.01 call costs $0.005 and a $0.05 call costs $0.025. Existing and new wallets start at zero when the promotion launches; earlier payments do not use the allowance. The allowance applies once per wallet across endpoints, with the same EVM wallet sharing its allowance across payment networks. Solana wallets have a separate allowance and their addresses are case-sensitive.

Send `X-Payer-Address` with the wallet that will sign the payment on the **initial unpaid request**:

```bash
curl -i -X POST 'https://api.nansen.ai/api/v1/smart-money/holdings' \
  -H 'Content-Type: application/json' \
  -H 'X-Payer-Address: YOUR_PAYING_WALLET_ADDRESS' \
  -d '{"chains": ["ethereum"]}'
```

Configure your x402 V2 client's initial request with the same header. For an existing `fetch` wrapper that handles x402 signing and retries, the request options are:

```javascript
const response = await fetchWithPayment(
  "https://api.nansen.ai/api/v1/smart-money/holdings",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payer-Address": payingWalletAddress,
    },
    body: JSON.stringify({ chains: ["ethereum"] }),
  },
);
```

The address header requests a quote; it does not prove ownership. On the paid retry, the signed payment determines the wallet and eligibility. Always sign the amount offered by the current `402` response, including fractional-cent prices. A quote does not reserve a discounted call: concurrent payments can use the remaining allowance before your retry, in which case request a fresh quote and confirm its price before paying again. Once the allowance is used, requests return to standard pricing automatically.

Clients that omit the header continue to receive standard-price quotes. Successfully settled standard-price x402 calls during the promotion also count toward the first 100 calls, so send the header from your first request to use the discount. A promotion may also return a standard-price quote when availability cannot be checked. Failed requests without a successful settlement do not consume the allowance; a payment with an uncertain outcome may temporarily hold an allowance slot while it is reconciled. API credit pricing and MPP payments are unchanged.

#### Basic Endpoints — $0.01/call

| Endpoint            | Path                                           |
| ------------------- | ---------------------------------------------- |
| Current Balances    | `/api/v1/profiler/address/current-balance`     |
| Historical Balances | `/api/v1/profiler/address/historical-balances` |
| Perp Positions      | `/api/v1/profiler/perp-positions`              |
| Transactions        | `/api/v1/profiler/address/transactions`        |
| Perp Trades         | `/api/v1/profiler/perp-trades`                 |
| Related Wallets     | `/api/v1/profiler/address/related-wallets`     |
| PnL Summary         | `/api/v1/profiler/address/pnl-summary`         |
| PnL                 | `/api/v1/profiler/address/pnl`                 |
| Token Screener      | `/api/v1/token-screener`                       |
| Perp Screener       | `/api/v1/perp-screener`                        |
| Transfers           | `/api/v1/tgm/transfers`                        |
| DCAs                | `/api/v1/tgm/jup-dca`                          |
| Flow Intel          | `/api/v1/tgm/flow-intelligence`                |
| Who Bought/Sold     | `/api/v1/tgm/who-bought-sold`                  |
| DEX Trades          | `/api/v1/tgm/dex-trades`                       |
| DeFi Holdings       | `/api/v1/portfolio/defi-holdings`              |
| Flows               | `/api/v1/tgm/flows`                            |

#### Premium Endpoints — $0.05/call

| Endpoint             | Path                                      |
| -------------------- | ----------------------------------------- |
| Counterparties       | `/api/v1/profiler/address/counterparties` |
| Holders              | `/api/v1/tgm/holders`                     |
| PnL Leaderboard      | `/api/v1/tgm/pnl-leaderboard`             |
| Perp PnL Leaderboard | `/api/v1/tgm/perp-pnl-leaderboard`        |
| Perp Leaderboard     | `/api/v1/perp-leaderboard`                |

#### Smart Money Endpoints — $0.05/call

| Endpoint               | Path                             |
| ---------------------- | -------------------------------- |
| Net Flow               | `/api/v1/smart-money/netflow`    |
| Holdings               | `/api/v1/smart-money/holdings`   |
| DEX Trades             | `/api/v1/smart-money/dex-trades` |
| All other SM endpoints | `/api/v1/smart-money/*`          |

#### Excluded Endpoints

* `/api/v1/labels/*`; these require a Pro subscription due to the proprietary nature of Nansen's entity classification data.
* `/api/v1/portfolio/defi-holdings`

### Payment Details

| Parameter       | Value                                                         |
| --------------- | ------------------------------------------------------------- |
| **Network**     | Base, Solana & Monad                                          |
| **Currency**    | USDC                                                          |
| **Settlement**  | Instant (onchain verification)                                |
| **Facilitator** | <p>Base: Coinbase CDP<br>Solana: Payai<br>Monad: Molandak</p> |

### Rate Limits

x402 requests have separate rate limits from API key authenticated requests.

| Limit                   | Value       |
| ----------------------- | ----------- |
| Per second (per wallet) | 5 requests  |
| Per minute (per wallet) | 60 requests |

If you exceed rate limits, you'll receive a `429 Too Many Requests` response. Payments are not charged for rate-limited requests.

### FAQ

**Q: Do I need a Nansen account?** No. x402 is fully permissionless. You only need a wallet with USDC on Base, Solana, or Monad.

**Q: What happens if payment fails?** You'll receive a `402 Payment Required` response again. No data is returned until payment succeeds.

**Q: Can I use x402 and an API key together?** If you include a valid API key, it takes precedence and no x402 payment is required.

**Q: Which networks are supported for payment?** Currently Base, Solana, and Monad. More networks may be added in the future.

**Q: Is there a minimum balance required?** No minimum. You just need enough USDC to cover the call price plus gas fees (typically < $0.01).


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/getting-started/agentic-payments/x402-payments.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
