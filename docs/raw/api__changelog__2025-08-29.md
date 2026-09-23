> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/changelog/2025-08-29.md).

# 29-08-2025: Major API Restructuring

This changelog highlights the key architectural and structural differences between the beta endpoints and v1 endpoints, focusing on breaking changes that developers need to be aware of when migrating.

#### 🔄 Version Update

* **From**: Beta endpoints (`/api/beta/*`)
* **To**: v1 endpoints (`/api/v1/*`)

#### 🏗️ **Major Structural Changes**

#### 1. **Parameter Structure Overhaul**

**Before (Beta): Nested Parameters Object**

```json
{
  "parameters": {
    "tokenAddress": "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv",
    "smFilter": ["180D Smart Trader"],
    "chain": "solana"
  },
  "pagination": {
    "page": 1,
    "recordsPerPage": 100
  }
}
```

**After (v1): Structured Request with Nested Filters**

```json
{
  "chain": "solana",
  "token_address": "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv",
  "filters": {
    "smart_money": {
      "include": ["180D Smart Trader"]
    },
    "include_stablecoins": true,
    "include_native_tokens": true
  },
  "pagination": {
    "page": 1,
    "per_page": 100
  }
}
```

**Impact**: All existing client code must be restructured to remove the nested `parameters` wrapper.

#### 2. **Naming Convention Changes**

**Before (Beta): camelCase**

* `tokenAddress`
* `includeStablecoin`

**After (v1): snake\_case**

* `tokenAddress →` token\_address\`
* `smFilter` → `filters.smart_money.include` (nested structure)
* `includeStablecoin` → `filters.include_stablecoins`

**Impact**: Significant impact - all fields are changed to snake\_case

#### 3. **Response Structure Standardization**

**Before (Beta): camelCase Response Fields**

```json
{
  "tokenAddress": "...",
  "symbol": "...",
  "marketCap": 1000000
}
```

**After (v1): snake\_case Response Fields**

```json
{
  "token_address": "...",
  "symbol": "...",
  "market_cap": 1000000
}
```

**Note**: Not all v1 endpoints return pagination fields - some return data only while others include pagination metadata. When pagination is present, it now includes an `is_last_page` boolean for easier pagination handling.

**Impact**: All client code must be updated to handle snake\_case field names in responses.

#### 📋 **Renamed Endpoint**

#### **Smart Money Endpoints**

**`/beta/smart-money/inflows` → `/api/v1/smart-money/netflow`**

#### **Profiler Endpoints**

**`/beta/profiler/address/balances` → `/api/v1/profiler/address/current-balance`**

#### 🚨 **Breaking Changes Summary**

#### **Must Update**:

1. **Remove nested `parameters` wrapper** from all requests
2. **Handle new response structure** with `data` and `pagination` fields
3. **Check parameter naming** for snake\_case vs camelCase changes

### Endpoint Migration Map

#### Smart Money Endpoints

**`/api/beta/smart-money/inflows` → `/api/v1/smart-money/netflow`**

**Changes:**

* Renamed from "inflows" to "netflow" for clarity
* Request structure simplified (no `parameters` wrapper)
* Enhanced filtering capabilities
* Added comprehensive sorting options
* Response includes pagination metadata

**New Features in V1:**

* `remove_scam_tokens` filter
* `hide_spam_tokens` filter
* `token_sector` filter
* Custom sort ordering support

**`/api/beta/smart-money/holdings` → `/api/v1/smart-money/holdings`**

**Changes:**

* Direct request body structure
* Enhanced response with pagination
* Improved filtering system
* Added sort customization

**`/api/beta/smart-money/dex-trades` → `/api/v1/smart-money/dex-trades`**

**Changes:**

* Simplified request structure
* Added comprehensive trade filters
* Enhanced label filtering
* Improved response metadata

**`/api/beta/smart-money/dcas` → `/api/v1/smart-money/dcas`**

**Changes:**

* Standardized request/response format
* Enhanced filtering for DCA parameters
* Added sort capabilities

#### Wallet Profiler Endpoints

**`/api/beta/profiler/address/transactions` → `/api/v1/profiler/address/transactions`**

**Changes:**

* Reduced max pagination from 100 to 20 records per page (performance optimization)
* Enhanced filtering for transaction types
* Added method and source type filters
* Improved token info structure

**`/api/beta/profiler/address/balances` → `/api/v1/profiler/address/current-balance`**

**Changes:**

* Renamed for clarity (balances → current-balance)
* Enhanced filtering capabilities
* Added value range filters
* Improved chain support

**`/api/beta/profiler/address/pnl` → `/api/v1/profiler/address/pnl`**

**Changes:**

* Simplified request structure
* Enhanced PnL calculation fields
* Added comprehensive filtering
* Improved sort options

**`/api/beta/profiler/address/pnl-summary` → `/api/v1/profiler/address/pnl-summary`**

**Changes:**

* Standardized response format
* Enhanced top token structure
* Improved metadata

**`/api/beta/profiler/address/counterparties` → `/api/v1/profiler/address/counterparties`**

**Changes:**

* Enhanced label filtering
* Added interaction count filters
* Improved volume filtering
* Better token info structure

**`/api/beta/profiler/address/historical-balances` → `/api/v1/profiler/address/historical-balances`**

**Changes:**

* Standardized date range handling
* Enhanced spam token filtering
* Improved response structure

**`/api/beta/profiler/address/related-wallets` → `/api/v1/profiler/address/related-wallets`**

**Changes:**

* Enhanced relationship metadata
* Added sort capabilities
* Improved response structure

#### Token God Mode (TGM) Endpoints

**`/api/beta/tgm/dex-trades` → `/api/v1/tgm/dex-trades`**

**Changes:**

* Enhanced filtering system
* Added action filters (buy/sell)
* Improved trader label filtering
* Better value range filters

**`/api/beta/tgm/transfers` → `/api/v1/tgm/transfers`**

**Changes:**

* Enhanced transfer type filtering
* Added CEX/DEX inclusion controls
* Improved smart money filtering
* Better address label filtering

**`/api/beta/tgm/holders` → `/api/v1/tgm/holders`**

**Changes:**

* Simplified label type handling
* Enhanced balance change tracking
* Added ownership percentage filters
* Improved sort capabilities

**`/api/beta/tgm/flows` → `/api/v1/tgm/flows`**

**Changes:**

* Enhanced flow tracking
* Added holder statistics
* Improved time-based analysis
* Better sort options

**`/api/beta/tgm/pnl-leaderboard` → `/api/v1/tgm/pnl-leaderboard`**

**Changes:**

* Enhanced PnL metrics
* Added ROI calculations
* Improved trader filtering
* Better sort capabilities

**`/api/beta/tgm/who-bought-sold` → `/api/v1/tgm/who-bought-sold`**

**Changes:**

* Enhanced volume tracking
* Added trade direction analysis
* Improved label filtering

**`/api/beta/tgm/jup-dca` → `/api/v1/tgm/jup-dca`**

**Changes:**

* Standardized DCA vault tracking
* Enhanced status filtering
* Improved deposit tracking

**`/api/beta/tgm/flow-intelligence` → `/api/v1/tgm/flow-intelligence`**

**Changes:**

* Enhanced category tracking
* Added wallet count metrics
* Improved flow analysis

#### New V1-Only Endpoints

**`/api/v1/portfolio/defi-holdings`**

* Production-ready DeFi portfolio tracking
* Comprehensive protocol breakdown
* Asset/debt/reward categorization

**`/api/v1/transaction-with-token-transfer-lookup`**

* Enhanced transaction lookup
* NFT transfer support
* Comprehensive token transfer tracking

**`/api/v1/token-screener`**

* Advanced token discovery
* Multi-chain screening
* Comprehensive filtering system
* Smart money integration


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/changelog/2025-08-29.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
