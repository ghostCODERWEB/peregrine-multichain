> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-3-identifying-related-wallets-at-scale.md).

# Use case 3: Identifying Related Wallets at Scale

### Scenario

An address clustering workflow that uses the Nansen API to systematically identify related wallet addresses and analyze their relationships. This enables researchers to uncover wallet connections through funding patterns, shared interactions, and behavioral analysis across multiple blockchains.

### Core Components

* **Labels:** Find labels of the initial address
* **Related Wallets**: Detection of special connections (funding, signing, contract deployment)
* **Counterparties Analysis**: Identification of high-interaction addresses and shared patterns

This integration enables systematic discovery of wallet clusters through multiple relationship types and confidence levels.

### Workflow Implementation

**Step 1: Target Address Label Lookup**

* Query labels of the target address

#### Step 2: Initial Relationship Discovery

* Query Related Wallets endpoint with target address
* Identify direct relationships: `relation: "First Funder"`, `"Signer"`, `"Deployed via"`
* Build initial cluster with high-confidence connections

#### Step 3: Counterparty Analysis

* Analyze counterparties with `group_by: "entity"` for entity-level grouping
* Filter for `volume_in_usd > 50000` to find significant addresses
* Identify shared CEX deposit addresses across potential cluster members

#### Step 4: Pattern Recognition

* Compare transaction timing using `block_timestamp` fields
* Look for addresses with similar `method: "0x"` patterns
* Check for coordinated movements with matching `transaction_type` values

#### Step 5: Multi-Level Clustering

* For each high-confidence related address, repeat steps 1-3
* Cross-reference addresses that deposit to same CEX addresses
* Build network graph of relationships with confidence scores

#### Step 6: Confidence Assessment

* **High confidence** (>90%): First funder, shared signers, same CEX deposits
* **Medium confidence** (60-90%): High interaction volume, coordinated timing
* **Low confidence** (<60%): Indirect relationships, behavioral similarities

#### Step 7: Validation and Refinement

* Check balance patterns for coordinated movements
* Filter out false positives from common protocol interactions

### Code Examples

#### 1. Find Target Address Labels

Identify all the labels associated with the target address

```bash
curl -L \
  --request POST \
  --url 'https://api.nansen.ai/api/v1/profiler/address/labels' \
  --header 'apikey: YOUR_API_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "address": "0xbdfa4f4492dd7b7cf211209c4791af8d52bf5c50",
    "chain": "ethereum",
    "pagination": {
      "page": 1,
      "per_page": 100
    }
  }'
```

#### 2. Find Related Wallets (Direct Relationships)

Identify wallets with special connections to a target address:

```bash
curl -X POST "https://api.nansen.ai/api/v1/profiler/address/related-wallets" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x28c6c06298d514db089934071355e5743bf21d60",
    "chain": "ethereum",
    "pagination": {
      "page": 1,
      "per_page": 20
    }
  }'
```

This reveals first funder relationships, signer connections, multisig relationships, and contract deployment patterns.

#### 3. Analyze Address Counterparties

Find addresses with the highest interaction volume:

```bash
curl -X POST "https://api.nansen.ai/api/v1/profiler/address/counterparties" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x28c6c06298d514db089934071355e5743bf21d60",
    "chain": "ethereum",
    "date": {
      "from": "2026-01-14",
      "to": "2026-07-13"
    },
    "group_by": "wallet",
    "source_input": "Combined",
    "filters": {
      "total_volume_usd": {
        "min": 10000
      }
    },
    "order_by": [
      {
        "field": "total_volume_usd",
        "direction": "DESC"
      }
    ]
  }'
```

This identifies CEX deposit addresses and high-frequency interaction patterns crucial for clustering.

#### 4. Track Historical Balance Patterns

Analyze coordinated balance movements across potential cluster members:

```bash
curl -X POST "https://api.nansen.ai/api/v1/profiler/address/historical-balances" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x28c6c06298d514db089934071355e5743bf21d60",
    "chain": "ethereum",
    "date": {
      "from": "2026-04-14",
      "to": "2026-07-13"
    },
    "filters": {
      "token_symbol": "USDC",
      "value_usd": {
        "min": 1000
      }
    }
  }'
```

Coordinated balance changes across addresses indicate potential cluster membership.

#### 5. Examine Transaction Patterns

Review transaction history for behavioral similarities:

```bash
curl -X POST "https://api.nansen.ai/api/v1/profiler/address/transactions" \
  -H "apikey: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x28c6c06298d514db089934071355e5743bf21d60",
    "chain": "ethereum",
    "date": {
      "from": "2026-07-01",
      "to": "2026-07-13"
    },
    "filters": {
      "volume_usd": {
        "min": 5000
      },
      "source_type": "transfer"
    }
  }'
```

Similar transaction timing and patterns across addresses suggest coordinated activity.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/templates/complex-use-cases/use-case-3-identifying-related-wallets-at-scale.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
