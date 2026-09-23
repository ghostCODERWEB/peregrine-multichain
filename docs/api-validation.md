# Live API validation (Step 0)

Run 2026-09-23T17:01 UTC by `pnpm validate-api`: 70 calls, **69 match their schema**, 1 drift, 0 errors, 8 credits (cap 300).

| Operation | Result | Credits | Rows | Drift / error | Undocumented fields |
| --- | --- | --- | --- | --- | --- |
| `POST /api/v1/search/general` | ✓ | — | 25 |  |  |
| `POST /api/v1/search/entity-name` | ✓ | — | 10 |  |  |
| `GET /api/v1/search/token-sectors` | ✓ | — | 33 |  |  |
| `POST /api/v1/chains/chain-rank` | ✓ | — | 37 |  |  |
| `POST /api/v1/token-screener` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/token-information` | ✓ | — | — |  |  |
| `POST /api/v1/tgm/indicators` | ✓ | — | 3 |  |  |
| `POST /api/v1/tgm/token-ohlcv` | ✓ | — | 8 |  |  |
| `POST /api/v1/tgm/flow-intelligence` | ✓ | — | 1 |  |  |
| `POST /api/v1/tgm/flows` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/who-bought-sold` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/holders` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/transfers` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/dex-trades` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/position-intelligence` | ✓ | 1 | 1 |  |  |
| `POST /api/v1/tgm/pnl-leaderboard` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/jup-dca` | ✓ | — | 5 |  |  |
| `POST /api/v1/transaction-with-token-transfer-lookup` | drift | — | 1 | data.0.nft_transfer_array: Invalid input: expected array, received null |  |
| `POST /api/v1/smart-money/netflow` | ✓ | — | 5 |  |  |
| `POST /api/v1/smart-money/holdings` | ✓ | — | 5 |  |  |
| `POST /api/v1/smart-money/dex-trades` | ✓ | — | 5 |  |  |
| `POST /api/v1/smart-money/dcas` | ✓ | — | 1 |  |  |
| `POST /api/v1/smart-money/pnl-leaderboard` | ✓ | — | 5 |  |  |
| `POST /api/v1/smart-money/perp-trades` | ✓ | — | 5 |  |  |
| `POST /api/v1/smart-money/historical-holdings` | ✓ | — | 5 |  |  |
| `POST /api/v1/profiler/address/current-balance` | ✓ | 1 | 5 |  |  |
| `POST /api/v1/profiler/address/historical-balances` | ✓ | — | 5 |  |  |
| `POST /api/v1/profiler/dex-trades` | ✓ | — | 5 |  |  |
| `POST /api/v1/profiler/address/transactions` | ✓ | — | 5 |  |  |
| `POST /api/v1/profiler/address/related-wallets` | ✓ | — | 1 |  |  |
| `POST /api/v1/profiler/address/first-funder` | ✓ | — | 1 |  |  |
| `POST /api/v1/profiler/address/pnl-summary` | ✓ | — | 5 |  |  |
| `POST /api/v1/profiler/address/pnl` | ✓ | 1 | 5 |  |  |
| `POST /api/v1/profiler/address/counterparties` | ✓ | — | 5 |  |  |
| `POST /api/v1/profiler/address/counterparties/batch` | ✓ | — | 5 |  |  |
| `POST /api/v1/portfolio/defi-holdings` | ✓ | — | 0 |  |  |
| `POST /api/v1/perp-screener` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/perp-positions` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/perp-trades` | ✓ | — | 5 |  |  |
| `POST /api/v1/tgm/perp-pnl-leaderboard` | ✓ | — | 5 |  |  |
| `POST /api/v1/perp-leaderboard` | ✓ | — | 5 |  |  |
| `POST /api/v1/profiler/perp-positions` | ✓ | — | — |  |  |
| `POST /api/v1/profiler/perp-trades` | ✓ | — | 0 |  |  |
| `POST /api/v1/profiler/perp-pnl-summary` | ✓ | — | — |  |  |
| `POST /api/v1/prediction-market/categories` | ✓ | — | 10 |  |  |
| `POST /api/v1/prediction-market/event-screener` | ✓ | — | 5 |  |  |
| `POST /api/v1/prediction-market/market-screener` | ✓ | — | 5 |  |  |
| `POST /api/v1/prediction-market/orderbook` | ✓ | — | 10 |  |  |
| `POST /api/v1/prediction-market/ohlcv` | ✓ | — | 10 |  |  |
| `POST /api/v1/prediction-market/trades-by-market` | ✓ | — | 5 |  |  |
| `POST /api/v1/prediction-market/top-holders` | ✓ | — | 5 |  |  |
| `POST /api/v1/prediction-market/pnl-by-market` | ✓ | — | 5 |  |  |
| `POST /api/v1/prediction-market/position-detail` | ✓ | — | 5 |  |  |
| `POST /api/v1/prediction-market/address-summary` | ✓ | — | 1 |  |  |
| `POST /api/v1/prediction-market/pnl-by-address` | ✓ | — | 1 |  |  |
| `POST /api/v1/prediction-market/trades-by-address` | ✓ | — | 5 |  |  |
| `POST /api/v1beta1/token-screener/historical` | ✓ | — | 5 |  |  |
| `POST /api/v1beta1/tgm/historical-token-ohlcv` | ✓ | — | 11 |  |  |
| `POST /api/v1beta1/tgm/historical-token-flow-summary` | ✓ | — | 1 |  |  |
| `POST /api/v1beta1/tgm/historical-dex-trades` | ✓ | — | 5 |  |  |
| `POST /api/v1beta1/tgm/historical-who-bought-sold` | ✓ | — | 5 |  |  |
| `POST /api/v1beta1/profiler/address/historical-token-balances` | ✓ | — | 5 |  |  |
| `POST /api/v1beta1/profiler/address/historical-transactions` | ✓ | — | 5 |  |  |
| `POST /api/v1beta1/profiler/historical-transaction-lookup` | ✓ | 5 | 1 |  |  |
| `POST /api/v1beta1/tgm/historical-top-holders` | ✓ | — | 5 |  |  |
| `POST /api/v1beta1/tgm/historical-token-quant-scores` | ✓ | — | 4 |  |  |
| `POST /api/v1beta1/tgm/historical-pnl-leaderboard` | ✓ | — | 5 |  |  |
| `POST /api/v1beta1/smart-money/historical-token-balances` | ✓ | — | 5 |  |  |
| `GET /api/v1/account` | ✓ | 0 | — |  | user_id, plan, credits_remaining |
| `GET /api/v1/smart-alert/list` | ✓ | — | 8 |  |  |