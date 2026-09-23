> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/points.md).

# Points

Developer reference for the Permissionless Rewards API service.

### Permissionless Rewards: Concepts

Before integrating the Nansen Points Leaderboard endpoint, it helps to understand **Permissionless Rewards** at a high level—see [Nansen Academy: On Permissionless Rewards](https://academy.nansen.ai/articles/2154465-on-permissionless-rewards) for full details.

* **What they are**: An open registry that maps Nansen Points balances to onchain wallets (EVM and Solana), without requiring an API key or explicit permission from Nansen.
* **Why it matters**: Protocols can seamlessly discover eligible wallets and distribute tokens, NFTs, or other perks—fully public and opt-in.
* **User control**: Holders can add or remove their wallet mapping at any time, revoking future distributions.

### A. Points Leaderboard (Paginated)

<mark style="color:green;">`GET`</mark> <https://app.nansen.ai/api/points-leaderboard/api>

Query the full leaderboard with pagination. No authentication required.

#### Query Parameters

<table><thead><tr><th width="163.828125">Name</th><th width="119.97265625">Type</th><th width="108.3671875">Required</th><th>Default</th><th>Description</th></tr></thead><tbody><tr><td>tier</td><td>string</td><td>No</td><td>all tiers</td><td>Filter by tier: green, ice, north, star</td></tr><tr><td>page</td><td>integer</td><td>No</td><td>1</td><td>Page number (min: 1)</td></tr><tr><td>recordsPerPage</td><td>integer</td><td>No</td><td>10</td><td>Results per page (min: 1, max: 10,000)</td></tr></tbody></table>

#### **Example Request**

<https://app.nansen.ai/api/points-leaderboard/api?tier=star&recordsPerPage=10>

#### Response Structure

Results are ordered by rank. Ties share the same rank.

```json
"results": [
      {
        "rank": 1,
        "points": 982400,
        "evm_address": "0x1234...abcd",
        "solana_address": null,
        "tier": "Star",
        "is_eligible": true
      },
      {
        "rank": 2,
        "points": 871200,
        "evm_address": "0x5678...efgh",
        "solana_address": "7xKX...9mPq",
        "tier": "Star",
        "is_eligible": true
      }
    ]
```

### B. Individual Lookup

<mark style="color:green;">`GET`</mark> [https://app.nansen.ai/api/points-leaderboard/{address}](https://app.nansen.ai/api/points-leaderboard/%7Baddress%7D%60)

Fetch the tier for a single wallet address. **No API key or authentication required.**

#### Query Parameters

<table><thead><tr><th width="163.828125">Name</th><th width="119.97265625">Type</th><th width="108.3671875">Required</th><th>Description</th></tr></thead><tbody><tr><td>address</td><td>string</td><td>Yes</td><td>EVM or Solana wallet address. Case-insensitive.</td></tr></tbody></table>

#### **Example Request**

[**https://app.nansen.ai/api/points-leaderboard/0xbbfb6566ad064c233af6314aeb1eee4c26a5f921**](https://app.nansen.ai/api/points-leaderboard/0xbbfb6566ad064c233af6314aeb1eee4c26a5f921)

#### Response Structure

```json
   {"tier":"star"}
```

### References

#### Response Codes

| Code | Description         |
| ---- | ------------------- |
| 200  | Successful response |
| 400  | Invalid parameters  |

#### Fields Response:

| Field            | Type   | Description                                                                                                                                                             |
| ---------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tier`           | string | <p>Tier name determined by points thresholds.<br>Valid tier values are: "none," "green," "ice," "north," or "star." Addresses not on the leaderboard return "none."</p> |
| `rank`           | number | Leaderboard rank. Users with the same points share the same rank.                                                                                                       |
| `points`         | number | Total accumulated Nansen Points                                                                                                                                         |
| `evm_address`    | string | Linked EVM rewards wallet                                                                                                                                               |
| `solana_address` | string | Linked Solana rewards wallet                                                                                                                                            |

#### Usage Notes

* **Minimum Qualification**: Wallets with fewer than 1,000 points return {"tier":"none"}
* **Public & Permissionless**: No authentication required.
* **Data Refresh**: Tier data refreshes daily at 11am UTC. Implement local caching to reduce redundant calls.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/points.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
