# Peregrine

An onchain intelligence terminal built on the [Nansen API](https://nansen.ai/api). Peregrine stores Nansen data continuously, adds its own models on top, and turns it into one fast research surface: where Smart Money is moving, which tokens are risky, and which wallets are worth following.

## What it does

| Section | What you get |
|---|---|
| **Overview** | Market Pulse: Smart Money flow, chain rotation, perps, predictions and sectors in one screen, with short written briefs |
| **Alpha** | Market map of the tokens Smart Money is accumulating, plus early buys filtered by size, age and chain |
| **Smart Money** | Net flows over time, most accumulated and distributed tokens, the wallets behind them |
| **Chain flows** | Capital rotating between chains: which chains Smart Money leaves and where it lands |
| **Perps** | Hyperliquid open interest, funding, Smart Money positioning per coin, price and leverage movers |
| **Predictions** | Polymarket markets through Nansen, with dedicated market pages and links to trade |
| **Sectors** | Flows by sector and the tokens driving them |
| **Profiler** | Any wallet on one page: holdings, realized PnL, counterparties, origins, transactions, a time machine, and a Hyperliquid trader workspace |
| **Token Checker** | Search any token on 25 networks and get its Token Score |

## Token Score

A 0 to 100 dump-risk score, **50% Nansen's own risk indicators and 50% Peregrine's model**:

- **Nansen half:** Nansen's low / medium / high risk levels, weighted by indicator (liquidity 1, supply inflation 0.8 and ignored for stablecoins, CEX flows 0.6, BTC reflexivity 0.25).
- **Peregrine half:** a weighted mean of holder concentration, insider clusters, fresh-wallet vs Smart Money flow, exit liquidity and sell pressure.
- **Size tier:** established assets are scaled down (stablecoins ×0.35, $10B+ ×0.45, $1B+ ×0.7, $100M+ ×0.9), so a blue chip cannot read Critical from DEX-side patterns alone.

Bands: Low under 25, Moderate under 50, High under 75, Critical above.

## Stack

Next.js 15 (App Router), React 19, Tailwind v4, ECharts, SQLite (better-sqlite3), Vitest. A background worker scans Nansen on a schedule and stores snapshots, so pages read stored data and do not spend credits on every view.

## Run locally

```bash
pnpm install
cp .env.example .env.local   # add NANSEN_API_KEY
pnpm dev                     # web app on :3000
pnpm worker                  # background scanner (separate terminal)
```

Tests: `pnpm test`. Full check: `pnpm verify`.

## Deploy

The included `Dockerfile` runs the web app and the scanner in one container, with the SQLite database on a volume mounted at `/data`. `railway.json` configures Railway; any host with a persistent disk works.
