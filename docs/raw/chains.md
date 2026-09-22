> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/reference/chains.md).

# Supported Chains

### Overview

The Nansen API supports 38 blockchain networks across EVM and non-EVM ecosystems. Chain support varies by endpoint.

### EVM Chains

EVM-compatible chains use the standard Ethereum address format (`0x` + 40 hex characters).

| Chain     | Value       | Description           |
| --------- | ----------- | --------------------- |
| Arbitrum  | `arbitrum`  | Arbitrum One L2       |
| Arc       | `arc`       | Circle L1 (USDC gas)  |
| Avalanche | `avalanche` | Avalanche C-Chain     |
| Base      | `base`      | Coinbase L2           |
| Bitlayer  | `bitlayer`  | Bitcoin L2            |
| BNB Chain | `bnb`       | BNB Smart Chain       |
| Chiliz    | `chiliz`    | Chiliz Chain          |
| Citrea    | `citrea`    | Bitcoin ZK rollup     |
| Ethereum  | `ethereum`  | Main Ethereum network |
| Gravity   | `gravity`   | Gravity network       |
| HyperEVM  | `hyperevm`  | Hyperliquid EVM       |
| IOTA EVM  | `iotaevm`   | IOTA EVM              |
| Katana    | `katana`    | Katana network        |
| Linea     | `linea`     | Linea L2              |
| Mantle    | `mantle`    | Mantle L2             |
| Metis     | `metis`     | Metis L2              |
| Monad     | `monad`     | Monad network         |
| Optimism  | `optimism`  | Optimism L2           |
| Plasma    | `plasma`    | Plasma network        |
| Polygon   | `polygon`   | Polygon PoS           |
| Robinhood | `robinhood` | Robinhood Chain       |
| Sei       | `sei`       | Sei EVM               |
| Sonic     | `sonic`     | Sonic network         |
| Viction   | `viction`   | Viction (TomoChain)   |

### Non-EVM Chains

Non-EVM chains have unique address formats. See Address Formats for details.

| Chain       | Value         | Description                       |
| ----------- | ------------- | --------------------------------- |
| Algorand    | `algorand`    | Algorand network                  |
| Aptos       | `aptos`       | Aptos network                     |
| Bitcoin     | `bitcoin`     | Bitcoin network                   |
| Hyperliquid | `hyperliquid` | Hyperliquid DEX (perpetuals only) |
| Injective   | `injective`   | Injective network                 |
| Mantra      | `mantra`      | Mantra network                    |
| NEAR        | `near`        | NEAR Protocol                     |
| Solana      | `solana`      | Solana network                    |
| Stacks      | `stacks`      | Stacks (Bitcoin L2)               |
| Starknet    | `starknet`    | Starknet L2                       |
| Stellar     | `stellar`     | Stellar network                   |
| SUI         | `sui`         | SUI network                       |
| TON         | `ton`         | The Open Network                  |
| Tron        | `tron`        | Tron network                      |

### Using the "all" Chain

Some endpoints support `"all"` to query across all supported chains:

```json
{
  "chains": ["all"]
}
```

This expands to all chains supported by that specific endpoint.

### Chain Support by Endpoint

Not all chains are available on all endpoints. Here's the support matrix:

#### Smart Money Endpoints

| Chain       | Netflow | DEX Trades | Holdings | Historical |
| ----------- | ------- | ---------- | -------- | ---------- |
| `arbitrum`  | Yes     | Yes        | Yes      | No         |
| `arc`       | Yes     | Yes        | Yes      | Yes        |
| `avalanche` | Yes     | Yes        | Yes      | No         |
| `base`      | Yes     | Yes        | Yes      | Yes        |
| `bnb`       | Yes     | Yes        | Yes      | Yes        |
| `ethereum`  | Yes     | Yes        | Yes      | Yes        |
| `hyperevm`  | Yes     | Yes        | Yes      | No         |
| `iotaevm`   | Yes     | Yes        | Yes      | No         |
| `linea`     | Yes     | Yes        | Yes      | No         |
| `mantle`    | Yes     | Yes        | Yes      | No         |
| `monad`     | Yes     | Yes        | Yes      | Yes        |
| `optimism`  | Yes     | Yes        | Yes      | No         |
| `plasma`    | Yes     | Yes        | Yes      | No         |
| `polygon`   | Yes     | Yes        | Yes      | No         |
| `robinhood` | Yes     | Yes        | Yes      | Yes        |
| `sei`       | Yes     | Yes        | Yes      | No         |
| `solana`    | Yes     | Yes        | Yes      | Yes        |
| `sonic`     | Yes     | Yes        | Yes      | No         |

#### Token God Mode Endpoints

| Chain         | Flows | Transfers | Holders | PnL |
| ------------- | ----- | --------- | ------- | --- |
| `arbitrum`    | Yes   | Yes       | Yes     | Yes |
| `arc`         | Yes   | Yes       | Yes     | Yes |
| `avalanche`   | Yes   | Yes       | Yes     | Yes |
| `base`        | Yes   | Yes       | Yes     | Yes |
| `bitcoin`     | No    | Yes       | Yes     | No  |
| `bnb`         | Yes   | Yes       | Yes     | Yes |
| `ethereum`    | Yes   | Yes       | Yes     | Yes |
| `hyperevm`    | Yes   | Yes       | Yes     | Yes |
| `hyperliquid` | Yes   | No        | No      | Yes |
| `injective`   | Yes   | Yes       | Yes     | No  |
| `iotaevm`     | Yes   | Yes       | Yes     | No  |
| `linea`       | Yes   | Yes       | Yes     | Yes |
| `mantle`      | Yes   | Yes       | Yes     | Yes |
| `mantra`      | Yes   | Yes       | Yes     | No  |
| `monad`       | Yes   | Yes       | Yes     | Yes |
| `near`        | Yes   | Yes       | Yes     | No  |
| `optimism`    | Yes   | Yes       | Yes     | Yes |
| `plasma`      | Yes   | Yes       | Yes     | Yes |
| `polygon`     | Yes   | Yes       | Yes     | Yes |
| `robinhood`   | Yes   | Yes       | Yes     | Yes |
| `sei`         | Yes   | Yes       | Yes     | Yes |
| `solana`      | Yes   | Yes       | Yes     | Yes |
| `sonic`       | Yes   | Yes       | Yes     | Yes |
| `starknet`    | Yes   | Yes       | Yes     | No  |
| `sui`         | Yes   | Yes       | Yes     | Yes |
| `ton`         | Yes   | Yes       | Yes     | No  |
| `tron`        | Yes   | Yes       | Yes     | No  |

#### Profiler Endpoints

| Chain       | Balance | Transactions | PnL | Related |
| ----------- | ------- | ------------ | --- | ------- |
| `arbitrum`  | Yes     | Yes          | Yes | Yes     |
| `arc`       | Yes     | Yes          | Yes | Yes     |
| `avalanche` | Yes     | Yes          | Yes | Yes     |
| `base`      | Yes     | Yes          | Yes | Yes     |
| `bitcoin`   | Yes     | Yes          | No  | Yes     |
| `bnb`       | Yes     | Yes          | Yes | Yes     |
| `ethereum`  | Yes     | Yes          | Yes | Yes     |
| `hyperevm`  | Yes     | No           | No  | No      |
| `injective` | Yes     | Yes          | No  | Yes     |
| `iotaevm`   | Yes     | Yes          | No  | Yes     |
| `linea`     | Yes     | Yes          | Yes | Yes     |
| `mantle`    | Yes     | Yes          | Yes | Yes     |
| `mantra`    | Yes     | Yes          | No  | Yes     |
| `monad`     | Yes     | Yes          | Yes | Yes     |
| `near`      | Yes     | Yes          | No  | Yes     |
| `optimism`  | Yes     | Yes          | Yes | Yes     |
| `plasma`    | Yes     | Yes          | Yes | Yes     |
| `polygon`   | Yes     | Yes          | Yes | Yes     |
| `robinhood` | Yes     | Yes          | Yes | Yes     |
| `sei`       | Yes     | Yes          | Yes | Yes     |
| `solana`    | Yes     | Yes          | Yes | Yes     |
| `sonic`     | Yes     | Yes          | Yes | Yes     |
| `starknet`  | Yes     | Yes          | No  | Yes     |
| `sui`       | Yes     | Yes          | Yes | Yes     |
| `ton`       | Yes     | Yes          | No  | Yes     |
| `tron`      | Yes     | Yes          | No  | Yes     |

### Examples

#### Single Chain Query

```json
{
  "chains": ["ethereum"]
}
```

#### Multi-Chain Query

```json
{
  "chains": ["ethereum", "solana", "base"]
}
```

#### All Chains Query

```json
{
  "chains": ["all"]
}
```

### Chain-Specific Considerations

#### Solana

* Uses base58 addresses
* Transaction lookup not supported
* Full support for Smart Money and TGM

#### Bitcoin

* Limited endpoint support (Profiler only)
* Supports P2PKH, P2SH, and Bech32 addresses
* No Smart Money or TGM support

#### TON

* Uses EQ.../UQ... address format
* Addresses are automatically normalized
* No PnL endpoints

#### Hyperliquid

* Perpetuals platform only
* Used for perp-specific endpoints
* No standard token endpoints


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/reference/chains.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
