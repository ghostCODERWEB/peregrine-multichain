> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/trade/spot-trading.md).

# Spot Trading

Nansen's Spot Trading API endpoints let you execute token swaps directly against onchain liquidity. Get a quote across aggregators, sign it with your own keys, and broadcast it -- same-chain or across chains.

Your keys never leave your side: Nansen returns unsigned transaction data, you sign locally, and you send back the signed payload to broadcast.

### What can you do? <a href="#what-can-you-do" id="what-can-you-do"></a>

With Spot Trading endpoints, you can:

* **Get the best available quote:** compare routes across multiple aggregators in one call
* **Swap on the same chain:** trade between the native token, USDC, and other supported tokens
* **Bridge across chains:** move value between Solana and Base in a single quoted route
* **Broadcast and track:** submit your signed transaction and follow a cross-chain transfer to completion

### Which endpoints can I use? <a href="#which-endpoints-can-i-use" id="which-endpoints-can-i-use"></a>

| I want to...                                      | Use this endpoint                                         | Best for                              |
| ------------------------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| Price a swap and compare routes                   | [Quote](/api/trade/spot-trading/quote.md)                 | Route discovery and pre-trade pricing |
| Turn the quote I picked into something signable   | [Prepare](/api/trade/spot-trading/prepare.md)             | One signing path for every route      |
| Broadcast a transaction I have signed             | [Execute](/api/trade/spot-trading/execute.md)             | Trade submission                      |
| Follow a cross-chain swap through to the far side | [Bridge Status](/api/trade/spot-trading/bridge-status.md) | Monitoring bridges after execution    |

### The trading flow <a href="#the-trading-flow" id="the-trading-flow"></a>

1. **Quote** -- call Quote with the chain, token pair, amount, and your wallet address. You get back one or more quotes to compare.
2. **Prepare** -- send the quote you picked to Prepare. You get back a transaction built and ready to sign, with a fresh blockhash on Solana and a simulation already run against it.
3. **Sign** -- sign it locally with your own key. Nansen never receives your private key.
4. **Execute** -- send the signed payload to Execute. The response reports the transaction hash and status.
5. **Bridge Status** -- for a cross-chain swap, poll Bridge Status with the source-chain transaction hash until the destination side completes.

Prepare is optional for same-chain swaps, whose quotes already carry signable transaction data, but it is **required for swaps out of Solana to another chain**. Preferring it everywhere means one signing path instead of one per route.

### Supported chains and pairs <a href="#supported-chains-and-pairs" id="supported-chains-and-pairs"></a>

Trading supports `solana` and `base`, both same-chain and between the two.

At least one side of a swap must be USDC or the chain's native token (SOL or ETH). To go from one non-native token to another, swap to USDC first and then out again.

Cross-chain routes need a minimum trade size of roughly $5, and liquidity for a given pair and direction is not guaranteed -- if no aggregator can route it you will get a "no quotes available" response rather than a worse price.

### Amounts are in base units <a href="#amounts-are-in-base-units" id="amounts-are-in-base-units"></a>

`amount` is always an integer string in the token's smallest unit, never a decimal:

| You want to trade | Pass                  |
| ----------------- | --------------------- |
| 1 SOL             | `1000000000`          |
| 1 ETH             | `1000000000000000000` |
| 1 USDC            | `1000000`             |

### Signing the transaction data <a href="#signing-the-transaction-data" id="signing-the-transaction-data"></a>

The shape of the `transaction` object in a quote depends on the route, and your signing code needs to handle each case it will encounter:

| Route                        | What you get                                                         | How to sign                                                                  |
| ---------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Base, same-chain or outbound | A standard EVM transaction (`to`, `data`, `value`, `gas`, `chainId`) | Sign with any EVM signer; send the `0x`-prefixed signed hex to Execute       |
| Solana, same-chain           | A serialized transaction in `data`                                   | Deserialize, sign, and send the base64-encoded signed transaction to Execute |
| Solana, outbound cross-chain | Routing instructions, not a transaction                              | **Not signable directly -- use Prepare**                                     |

Passing every quote through Prepare avoids this entirely: it returns one shape per chain regardless of route, and it applies the network fee floor that keeps Solana bridge transactions from being dropped while they wait to be included.

### Previewing without trading <a href="#previewing-without-trading" id="previewing-without-trading"></a>

Prepare simulates the transaction and reports the result in `simulationPassed` **without broadcasting anything**. That is the way to check whether a trade would succeed before committing to it.

Execute has no such mode: every call to Execute broadcasts, and a successful transaction is a real trade.

### Cost and limits <a href="#cost-and-limits" id="cost-and-limits"></a>

Trading endpoints do **not** consume plan credits -- trading costs are the onchain and routing fees on the trade itself. They carry their own per-endpoint rate limits, sized for real trading rather than for bulk quote polling.

### Availability <a href="#availability" id="availability"></a>

Trading is unavailable from some jurisdictions, and wallet addresses are screened against sanctions lists before a quote is returned or a transaction is broadcast. A blocked region or a blocked address returns `403`.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/trade/spot-trading.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
