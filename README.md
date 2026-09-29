<div align="center">

<img src="public/brand/peregrine-256.png" width="96" alt="Peregrine" />

# Peregrine

**A Smart Money terminal that runs entirely on the Nansen API.**<br/>
It reads Nansen's labeled onchain data, runs its own tested models on it, and shows every answer with the evidence behind it, on desktop and as a phone app.

</div>

> [!IMPORTANT]
> **Buildathon submission snapshot: [`submission-2026-09-27`](https://github.com/ghostCODERWEB/peregrine-multichain/releases/tag/submission-2026-09-27)**<br/>
> This README shows the current app, including UI fixes made after the deadline. The tag above is the frozen submission reviewers should judge. Every usage number and test result below is from the submission.

<div align="center">

[![Live demo](https://img.shields.io/badge/live-peregrine--nansen-00FFA7?style=flat-square&labelColor=0d1114)](https://peregrine-nansen.up.railway.app)
[![Submission](https://img.shields.io/badge/submission-2026--09--27-f2fbf7?style=flat-square&labelColor=0d1114)](https://github.com/ghostCODERWEB/peregrine-multichain/releases/tag/submission-2026-09-27)
[![Nansen API calls](https://img.shields.io/badge/Nansen%20API%20calls-7%2C903-00FFA7?style=flat-square&labelColor=0d1114)](#proof)
[![Nansen API coverage](https://img.shields.io/badge/Nansen%20API%20covered-92.5%25%20(74%2F80)-00FFA7?style=flat-square&labelColor=0d1114)](#how-much-of-the-nansen-api-it-uses)
[![Built for](https://img.shields.io/badge/Nansen%20Meridian%20Buildathon-Sept%202026-f2fbf7?style=flat-square&labelColor=0d1114)](https://nansen.ai/api)

[**Live demo**](https://peregrine-nansen.up.railway.app) · [Proof page](https://peregrine-nansen.up.railway.app/proof) · [Cascades](https://peregrine-nansen.up.railway.app/cascade) · [60-second film](video-production/output/project-showcase-final.mp4)

</div>

<img src="docs/readme/charts/stat-tiles.png" alt="At submission: 7,903 Nansen API calls, 92.5% of the documented Nansen API, 12,888 requests served from cache, 0.84 AUC, 38 chains, 667 tests" />

Peregrine started as a list of things I would love Nansen to do next. It opens with **six features Nansen does not have yet**, then the **upgrades** it adds to pages Nansen already has, then the **proof** that it is real, tested and built on Nansen.

## Contents

- **New in Peregrine:** [Copy Lab](#1-copy-lab) · [Ask about anything on screen](#2-ask-about-anything-on-screen) · [Cascades](#3-cascades) · [Flow Index](#4-flow-index) · [Token Verdict](#5-token-verdict) · [Section rail](#6-section-rail)
- **Upgrades:** [Holders and insider clusters](#holders-and-insider-clusters) · [Perps](#perps) · [Alpha](#alpha) · [Prediction markets, sectors, chain pages, Profiler](#more-pages) · [Smart Money timeline](#smart-money-timeline) · [Research Desk](#research-desk)
- **The phone app:** [Liquid Glass, collapsing titles, section rail](#the-phone-app)
- **Proof:** [Usage and tested models](#proof) · [API coverage](#how-much-of-the-nansen-api-it-uses) · [Under the hood](#under-the-hood) · [Run it yourself](#run-it-yourself)

---

## Six features Nansen doesn't have yet

### 1. Copy Lab

<img src="docs/readme/gifs/copy-lab.gif" alt="Copy Lab: one board of Smart Money spot traders, Hyperliquid perp traders and Polymarket winners, re-ranked on the Perps tab" />

A PnL leaderboard tells you who made money, not whether you could have made it by following them. Copy Lab ranks **Smart Money spot traders, Hyperliquid perp traders and Polymarket winners on one board**, each with a **copy score** from 0 to 100:

- **Up** when profit repeats across 7, 30 and 90 days, has actually been taken, and comes from many tokens or markets.
- **Down** for one lucky trade, bots that trade dozens of times a day, and heavy leverage (`src/lib/models/copy-score.ts`).

Every row shows what the trader holds right now. **If you see the trade late** replays Smart Money buys on 15-minute candles to show how much edge is left if you notice 15 minutes, 1 hour or 6 hours later. Tabs: All, Spot, Perps, Predictions, and KOLs and cohorts.

### 2. Ask about anything on screen

<table><tr>
<td width="72%" valign="top"><img src="docs/readme/gifs/ask-anything.gif" alt="Desktop: press Cmd+J, pick a chart and a token on the page, and the answer cites their numbers" /></td>
<td valign="top"><img src="docs/readme/gifs/ask-phone.gif" alt="Phone: Ask grows out of the tab bar like the macOS genie and knows the page you are on" /></td>
</tr><tr>
<td><sub><b>Desktop (⌘J):</b> click any chart, token or card. Each becomes a chip in your question, and the answer quotes the exact numbers it used.</sub></td>
<td><sub><b>Phone:</b> Ask grows out of the tab bar and already knows which page you are on.</sub></td>
</tr></table>

No copying numbers into a text box: point at things. It runs on Nansen's agent API (`agent/fast`, `agent/expert`).

### 3. Cascades

<img src="docs/readme/gifs/cascades.gif" alt="Cascades: the leadership map, a wallet's evidence and a replay of who entered first" />

Some Smart Money wallets keep buying first, and others keep following them. Cascades find the leaders, then test whether it is real or luck:

1. **Episodes.** For each token, every Smart Money wallet's first buy (≥ $500) within a 72-hour window, with at least 3 wallets.
2. **Leaders.** Each wallet's average place in the queue is z-tested against random order, then corrected for testing hundreds of wallets at once (10% false-discovery rate).
3. **Pairs.** An exact binomial test for wallets that reliably buy before one another.

The recording (27 September 2026) shows the page being honest: 204 episodes and 304 wallets tested, and **no leader survives the correction**. It says so plainly rather than showing a list that is always full. The result moves as the 30-day window rolls. The **replay** plays one token's Smart Money buyers in the order they entered, and how many hours ahead each was.

<details>
<summary><b>How Cascades work, and their limits</b></summary>

```mermaid
flowchart LR
  A["Nansen smart-money/dex-trades<br/>(live, every scan)"] --> C[(Labeled Smart Money buys)]
  B["Nansen tgm/dex-trades<br/>only_smart_money, 30 days<br/>(150 tokens, daily)"] --> C
  C --> D["Episodes<br/>per token: each wallet's first buy<br/>within 72h, 3+ wallets"]
  D --> E["Leader test<br/>mean entry rank vs random order<br/>z-test + Benjamini-Hochberg FDR"]
  D --> F["Precedence links<br/>A before B, exact binomial test"]
  E --> G[Leadership map]
  F --> G
  D --> H[Cascade replay]
  E --> I[Evidence per wallet]
```

Entry rank is scaled from 0 (first) to 1 (last); under random order a wallet's mean rank is 0.5. Entries within a minute count as ties. **Limits:** entering first is not causation (two wallets can share a source); pair links are not corrected for multiple testing; the backfill is capped at 1,000 trades per token; labels change over time.

</details>

### 4. Flow Index

<img src="docs/readme/gifs/overview.gif" alt="Overview: the headline sentence, the net-flow ring drawing between chains, and Flow Index sparklines for the top inflow and outflow chains" />

$10M of Smart Money inflow means nothing on Ethereum and a lot on a small chain. The Flow Index scores **each chain against its own recent history**, from 0 to 100: above 65 Smart Money is accumulating more than usual, below 35 it is leaving. Its inputs are net flow and volume, scored robustly so one whale cannot throw it off.

The Overview sums it up in one sentence (*Buying Ton. Selling Near.*) over a live net-flow ring. **Chain flows** puts every chain on one screen, and Peregrine forecasts each chain's next reading.

<img src="docs/readme/shots/chain-flows.jpg" alt="Chain flows: net flow by chain and the Flow Index over time, one line per chain" />

### 5. Token Verdict

<table><tr>
<td width="50%" valign="top"><img src="docs/readme/gifs/token-checker.gif" alt="Token Checker: type a name, results appear across 25 networks, and the Verdict resolves" /></td>
<td width="50%" valign="top"><img src="docs/readme/gifs/token-chart.gif" alt="Token page: the Token Score rings, and the price chart switching range and style" /></td>
</tr></table>

Every token gets a 0 to 100 score: **half Nansen's own risk indicators, half Peregrine's model** (holder concentration, linked insider wallets, exit liquidity, sell pressure). On top sits a **one-line verdict with up to four reasons, each backed by a number**, a read from Nansen's agent, and **7-day odds** of a 50% dump and a 30% breakout from two fitted models. On a week the models never saw, both scored **AUC 0.84**. Search works across **25 networks**.

<details>
<summary><b>How the score is built</b></summary>

```mermaid
flowchart TB
  N["Nansen risk indicators<br/>liquidity · supply inflation · CEX flows · BTC reflexivity"] -->|50%| S((Token Score))
  P["Peregrine model<br/>holder concentration · insider clusters<br/>exit liquidity · sell pressure · momentum"] -->|50%| S
  S --> T["× size tier<br/>stablecoin 0.35 · $10B+ 0.45 · $1B+ 0.7 · $100M+ 0.9"]
  T --> V{Verdict}
  V -->|55+| D[Danger]
  V -->|35+| W[Watch]
  V -->|below 35| L[Low risk]
```

The size tier scales established assets down (stablecoins, $10B+ caps, wrapped majors like WETH and WBTC), so a blue chip can't read Danger from onchain patterns alone. Sources: `src/lib/models/storm-score.ts`, `src/server/token/forecast.ts`. **Risk Radar** on the Overview flags Smart Money buying into tokens that score 50 or more.

</details>

### 6. Section rail

<table><tr>
<td width="72%" valign="top"><img src="docs/readme/gifs/section-rail.gif" alt="Desktop: hovering the rail on the right edge previews each section's name, and a click jumps there" /></td>
<td valign="top"><img src="docs/readme/gifs/phone-rail.gif" alt="Phone: dragging the rail scrubs through the page with the section's name beside the finger" /></td>
</tr></table>

Every page has a thin rail on the right edge, one tick per section. **Hover or drag it** and a label shows which section you will land on (*8/12 · 4 of the top 25 holders sit in insider clusters*), so long pages never feel long.

---

## Upgrades to pages Nansen already has

### Holders and insider clusters

<img src="docs/readme/gifs/holders.gif" width="720" alt="Token holders floating in a 3D sphere that turns under the pointer, insider clusters highlighted" />

The top holders float in 3D and turn under your pointer. Wallets that share a first funder, a relation or a deployer are grouped into **insider clusters**, with the share of supply each cluster holds.

### Perps

<img src="docs/readme/gifs/perps.gif" alt="Perps: the BTC liquidation radar filtered to Smart Money, then positioning history under the pointer" />

Hyperliquid through Nansen: open interest, funding extremes, the Smart Money book and a **liquidation radar you can filter to Smart Money only**. Every coin gets a pressure score built like the Flow Index, and its own page with positioning history.

### Alpha

<img src="docs/readme/gifs/alpha.gif" alt="Alpha: the first Smart Money buys, then the token and its Verdict, then the wallet behind the buy" />

The first tokens Smart Money has started buying, sorted by how much went in. One click opens the token and its Verdict, one more the wallet that bought it. The page also has a market map of tokens by Smart Money flow and price.

### More pages

<table><tr>
<td width="50%"><img src="docs/readme/shots/predictions.jpg" alt="Predictions: Polymarket through Nansen, the day's heat, repricing and trending markets" /><br/><sub><b>Prediction markets.</b> Polymarket through Nansen, sorted by what is moving, with full market pages. The best prediction traders also appear in Copy Lab.</sub></td>
<td width="50%"><img src="docs/readme/shots/sectors.jpg" alt="Sectors: net flow by sector and over time" /><br/><sub><b>Sectors.</b> Which themes Smart Money is moving into and out of, and how that changed over the last week.</sub></td>
</tr><tr>
<td><img src="docs/readme/shots/chain-page.jpg" alt="A chain page: Base's Flow Index, activity and a heatmap of its busiest tokens" /><br/><sub><b>Chain pages.</b> Every chain with its Flow Index, activity and a heatmap of its busiest tokens.</sub></td>
<td><img src="docs/readme/shots/profiler.jpg" alt="Profiler: one trader score across spot, perps and prediction markets, with holdings" /><br/><sub><b>Profiler.</b> Any wallet or ENS name: one trader score across spot, perps and prediction markets, holdings, PnL, counterparties and first funder.</sub></td>
</tr></table>

### Smart Money timeline

Every large Smart Money move of the day in one feed, spot and perps together, filterable by kind, on the Smart Money desk next to the conviction map, crowded exits, the PnL leaderboard and the wallet network. The desk uses Smart Money labels, so it shows only on an owner instance (Nansen's redistribution rules).

### Research Desk

Name a token, wallet or ENS name and pick a mode (token due diligence, wallet investigation, who is leading this token, market brief). A live plan gathers **numbered evidence** from the Token Score, Smart Money flow, Cascades and Copy Lab, then Nansen's agent writes a report **from that evidence only**, with citations you can tap.

---

## The phone app

The phone version is its own app, not a squeezed desktop.

<table><tr>
<td width="33%" valign="top"><img src="docs/readme/gifs/phone-tabs.gif" alt="Liquid Glass tab bar: the lens glides between Today, Tokens and Wallets" /><br/><sub><b>Liquid Glass tab bar.</b> The lens glides to the active tab as screens change.</sub></td>
<td width="33%" valign="top"><img src="docs/readme/gifs/phone-scroll.gif" alt="Scrolling: the large title collapses and content moves under the glass" /><br/><sub><b>Large titles.</b> They collapse as you scroll, and content slides under the glass.</sub></td>
<td width="33%" valign="top"><img src="docs/readme/gifs/ask-phone.gif" alt="Genie Ask grows out of the tab bar" /><br/><sub><b>Genie Ask.</b> The Ask panel grows out of the tab bar and folds back into it.</sub></td>
</tr></table>

<table><tr>
<td><img src="docs/readme/shots/phone-today.jpg" alt="Phone: Today" /></td>
<td><img src="docs/readme/shots/phone-alpha.jpg" alt="Phone: Alpha market map" /></td>
<td><img src="docs/readme/shots/phone-token.jpg" alt="Phone: token page with its price chart" /></td>
<td><img src="docs/readme/shots/phone-wallet.jpg" alt="Phone: wallet trader score" /></td>
<td><img src="docs/readme/shots/phone-perps.jpg" alt="Phone: perps" /></td>
</tr></table>

Today, Tokens, Copy and Wallets tabs, plus Ask and Search; swipeable card rails; long panels open as previews with one tap to expand, while price charts and scorecards always show in full.

---

## Proof

Every number in this section is from the submission (the Proof page ledger, 22 to 26 September 2026). `docs/readme/data/` holds the exact exports, and `scripts/readme-assets/` redraws every chart from them.

<img src="docs/readme/charts/calls-per-day.png" alt="7,903 Nansen API calls in five days" />

<img src="docs/readme/charts/calls-by-family.png" alt="Nansen API calls by endpoint family" />

<img src="docs/readme/charts/live-vs-cache.png" alt="Data requests answered live vs from cache" />

A background worker reads Nansen every 30 minutes and stores what it finds, so most page views cost no credits: **12,888** requests (**62%** of all data requests in the ledger window) were answered from the cache.

<img src="docs/readme/charts/model-roc.png" alt="ROC curves for the dump-risk and breakout models on the held-out week" />

| Model | Test | Result at submission |
|---|---|---|
| Dump odds (fitted model) | ≥ 50% drawdown within 7 days | **AUC 0.84** (the Token Score's hand-set weights: 0.71) |
| Breakout odds (fitted model) | ≥ 30% run-up within 7 days | **AUC 0.84** (hand-set weights: 0.78) |
| Volatility cone | price inside the 80% band after 1 day | **83%** of 754 token-days (target 80%) |
| Flow projections | next Flow Index reading per chain | **5.9%** median error |

Models are trained on three earlier weeks (576 token-weeks) and tested on the week of 8 September 2026 (178 token-weeks) that they never saw, using Nansen point-in-time data. The dump test has only 8 events, so its AUC interval runs from 0.67 to 1.00; the Proof page states this too.

## How much of the Nansen API it uses

<img src="docs/readme/charts/api-coverage.png" alt="Peregrine uses 92.5% of the documented Nansen API" />

Peregrine called **74 of the 80 documented Nansen endpoints (92.5%)**, plus 8 that are not in the published docs (account, Hyperliquid trading, points and social posts): **82 endpoints** in total. The 6 unused are Smart Alert management (3), trade execution and bridge status (2), and premium labels (1). The documented list is `docs/openapi.json` (merged from docs.nansen.ai); the calls are the Proof page ledger (`fixtures/proof-ledger.json`). Paths are compared after removing version prefixes (`v1`, `v1beta1`, `beta`).

<details>
<summary><b>Every endpoint and its call count</b> (88 rows)</summary>

| Family | Endpoint | Calls |
|---|---|--:|
| tgm | `tgm/flow-intelligence` | 574 |
| tgm | `tgm/token-ohlcv` | 331 |
| tgm | `tgm/who-bought-sold` | 268 |
| tgm | `tgm/transfers` | 180 |
| tgm | `tgm/perp-positions` | 162 |
| tgm | `tgm/holders` | 141 |
| tgm | `tgm/token-information` | 103 |
| tgm | `tgm/dex-trades` | 97 |
| tgm | `tgm/flows` | 95 |
| tgm | `tgm/indicators` | 91 |
| tgm | `tgm/pnl-leaderboard` | 56 |
| tgm | `tgm/position-intelligence` | 55 |
| tgm | `tgm/perp-trades` | 31 |
| tgm | `tgm/jup-dca` | 25 |
| tgm | `tgm/historical-token-flow-summary` | 11 |
| tgm | `tgm/historical-top-holders` | 11 |
| tgm | `tgm/historical-who-bought-sold` | 11 |
| tgm | `tgm/perp-pnl-leaderboard` | 9 |
| tgm | `tgm/historical-token-ohlcv` | 7 |
| tgm | `tgm/historical-token-quant-scores` | 7 |
| tgm | `tgm/historical-dex-trades` | 5 |
| tgm | `tgm/historical-pnl-leaderboard` | 5 |
| token-screener | `token-screener` | 1,860 |
| token-screener | `token-screener/historical` | 49 |
| profiler | `profiler/address/related-wallets` | 770 |
| profiler | `profiler/address/first-funder` | 405 |
| profiler | `profiler/address/current-balance` | 243 |
| profiler | `profiler/address/pnl-summary` | 82 |
| profiler | `profiler/address/transactions` | 74 |
| profiler | `profiler/perp-pnl-summary` | 43 |
| profiler | `profiler/perp-positions` | 43 |
| profiler | `profiler/address/counterparties` | 42 |
| profiler | `profiler/address/counterparties/batch` | 17 |
| profiler | `profiler/address/labels` | 16 |
| profiler | `profiler/perp-trades` | 14 |
| profiler | `profiler/address/pnl` | 12 |
| profiler | `profiler/address/historical-balances` | 9 |
| profiler | `profiler/address/historical-token-balances` | 8 |
| profiler | `profiler/address/historical-transactions` | 7 |
| profiler | `profiler/historical-transaction-lookup` | 2 |
| profiler | `profiler/dex-trades` | 1 |
| profiler | `profiler/address/premium-labels` | not used |
| prediction-market | `prediction-market/ohlcv` | 217 |
| prediction-market | `prediction-market/trades-by-market` | 133 |
| prediction-market | `prediction-market/address-summary` | 106 |
| prediction-market | `prediction-market/top-holders` | 53 |
| prediction-market | `prediction-market/categories` | 51 |
| prediction-market | `prediction-market/market-screener` | 48 |
| prediction-market | `prediction-market/event-screener` | 44 |
| prediction-market | `prediction-market/orderbook` | 41 |
| prediction-market | `prediction-market/pnl-by-market` | 21 |
| prediction-market | `prediction-market/pnl-by-address` | 20 |
| prediction-market | `prediction-market/trades-by-address` | 20 |
| prediction-market | `prediction-market/position-detail` | 7 |
| smart-money | `smart-money/dex-trades` | 129 |
| smart-money | `smart-money/perp-trades` | 46 |
| smart-money | `smart-money/netflow` | 31 |
| smart-money | `smart-money/holdings` | 21 |
| smart-money | `smart-money/dcas` | 19 |
| smart-money | `smart-money/pnl-leaderboard` | 16 |
| smart-money | `smart-money/historical-holdings` | 5 |
| smart-money | `smart-money/historical-token-balances` | 3 |
| search | `search/general` | 242 |
| search | `search/entity-name` | 5 |
| search | `search/token-sectors` | 4 |
| perp-screener | `perp-screener` | 75 |
| agent | `agent/fast` | 40 |
| agent | `agent/expert` | 2 |
| chains | `chains/chain-rank` | 30 |
| perp-leaderboard | `perp-leaderboard` | 27 |
| smart-alert | `smart-alert/list` | 10 |
| smart-alert | `smart-alert` | not used |
| smart-alert | `smart-alert/toggle` | not used |
| smart-alert | `smart-alert/{alert_id}` | not used |
| trade | `trade/quote` | 5 |
| trade | `trade/prepare` | 1 |
| trade | `trade/bridge-status` | not used |
| trade | `trade/execute` | not used |
| portfolio | `portfolio/defi-holdings` | 1 |
| transaction-with-token-transfer-lookup | `transaction-with-token-transfer-lookup` | 1 |
| beyond the docs | `account` | 375 |
| beyond the docs | `ra-agent/posts-by-token` | 61 |
| beyond the docs | `points/leaderboard` | 15 |
| beyond the docs | `points/tier` | 2 |
| beyond the docs | `perp/builder-fee` | 1 |
| beyond the docs | `perp/meta` | 1 |
| beyond the docs | `perp/order` | 1 |
| beyond the docs | `ra-agent/posts-by-user` | 1 |

Generated by `python3 scripts/readme-assets/endpoint-table.py`.
</details>

<img src="docs/readme/charts/chain-coverage.png" alt="38 chains, each feature where Nansen supports it" />

## Under the hood

```mermaid
flowchart TB
  subgraph Nansen API
    SM[smart-money/*]
    TGM[tgm/* Token God Mode]
    PR[profiler/*]
    HL[perp-screener · perp-leaderboard]
    PM[prediction-market/*]
    BT[historical / backtesting]
    AG[agent/fast · agent/expert]
  end
  subgraph Worker["Background worker (every 30 min)"]
    SC[Scanner: flows, trades, snapshots]
    SW[Token Score sweep]
    CB[Cascades backfill, daily]
  end
  subgraph Store["SQLite"]
    DB[(trades · snapshots · scores<br/>cache · credit ledger)]
  end
  subgraph Models["Pure, tested models"]
    M1[Token Score]
    M2[Cascades statistics]
    M3[Copy Lab]
    M4[Flow Index · forecasts]
  end
  subgraph App["Next.js app"]
    UI[Desktop terminal]
    PH[Phone app]
    API[API routes · streaming]
  end
  SM & TGM & HL & PM --> SC
  TGM --> CB
  BT --> M1
  SC & SW & CB --> DB
  DB --> M1 & M2 & M3 & M4
  M1 & M2 & M3 & M4 --> API
  PR & TGM --> API
  AG --> API
  API --> UI & PH
```

- **Stored, not re-fetched.** Pages read from storage, so history builds up over time and a page view costs no credits.
- **Models are pure functions** with unit tests (`src/lib/models/*`): the Token Score, Cascades statistics, Copy Lab, flow indices and forecasts. At submission, `pnpm test` ran **667** unit and integration tests.
- **Every number has its source.** Charts carry an info popover listing the Nansen calls behind them, and research results cite their evidence.
- **One path to Nansen.** Every call goes through `callNansen` (`src/server/nansen/client.ts`): per-endpoint cache TTLs, stale-while-refresh, a per-visitor daily credit cap, rate-limit buckets, retry on 429, schema validation and a ledger row per call.
- **Stack:** Next.js 15, React 19, Tailwind v4, ECharts, SQLite (better-sqlite3), Vitest, Playwright, viem (for ENS).

<details>
<summary><b>The request path for every Nansen call</b></summary>

```mermaid
flowchart LR
  R[Page, worker or script] --> C{Cache hit?<br/>per-endpoint TTL}
  C -->|fresh| A[Answer · 0 credits]
  C -->|recently expired| S[Serve stale now,<br/>refresh in background]
  C -->|miss| B{Visitor daily<br/>credit cap left?}
  B -->|no| L[Last known answer,<br/>or say why]
  B -->|yes| T[Rate limiter<br/>per-second and per-minute buckets]
  T --> N[Nansen API<br/>retry on 429 with Retry-After]
  N --> V[Validate schema · write cache<br/>ledger row · demo fixture]
  V --> A2[Answer]
```

</details>

## Data sources and captures

- **Nansen** is the data source for every analytic, score and model in Peregrine.
- **Other sources, not used for analytics:** token and protocol logos (DexScreener, Jupiter, CoinGecko, CoinCap, Financial Modeling Prep, DefiLlama icons); ENS name resolution (public Ethereum RPCs and ensideas); and, in perps wallet research, Hyperliquid's public info API for full fill history and candles, next to Nansen's positions. `pnpm assert-nansen-only` lists every such host.
- **Owner-only views.** Copy Lab, Cascades and the Smart Money desk use Smart Money labels, so Nansen's redistribution rules keep them to an owner instance; public visitors see what each view shows instead.
- **Recorded from the live app on 27 September 2026** (owner view, frozen browser clock, network waits cut out): the Copy Lab, Ask (desktop and phone), Cascades, Perps, Alpha and Token Checker GIFs. The Predictions still is from the submission's own screenshots, also taken that day.
- **Captured from the current app** in demo mode (recorded Nansen data, clock set to 27 September 2026) with `pnpm screenshots`: the Overview, token chart, holders, section rail and phone GIFs, and the other stills. Desktop captures are cropped to the page area.

## Run it yourself

```bash
pnpm install
cp .env.example .env.local        # add NANSEN_API_KEY
pnpm dev                          # web app on http://localhost:3000
pnpm worker                       # background scanner, in a second terminal
pnpm tsx scripts/cascade-backfill.ts   # optional: fill 30 days of Cascades history now
pnpm test                         # unit and integration tests
pnpm e2e                          # Playwright end-to-end tests, desktop and phone
pnpm dev:demo                     # demo mode on :3300 from recorded Nansen responses, no key needed
```

**Redraw every figure in this README:**

```bash
pnpm tsx scripts/readme-assets/export-data.ts   # ledger, backtest, coverage, chains → docs/readme/data/
python3 scripts/readme-assets/charts.py         # → docs/readme/charts/ (needs matplotlib)
python3 scripts/readme-assets/endpoint-table.py # the endpoint table above
pnpm screenshots                                # stills and GIFs from a demo server on :3300 (needs Pillow)
```

**Deploy:** the included `Dockerfile` runs the web app and the worker in one container, with SQLite on a volume at `/data`. The live demo runs this way on Railway.

### Demo in 60 seconds

1. **Copy Lab:** who is worth following, in spot, perps and predictions, and what they hold now.
2. **Ask (⌘J):** select a chart and a token, ask which matters most.
3. **Cascades:** did proven early wallets lead the buying? Replay who entered first.
4. **Overview:** where Smart Money is moving, chain by chain, against each chain's own history.
5. **Token page:** the Verdict, both halves of the score and the 7-day odds.

---

<div align="center">

<a href="https://nansen.ai"><img src="public/brand/nansen/wordmark-greenwhite.svg" height="28" alt="Nansen" /></a>

Built for the **Nansen Meridian Buildathon** on the [Nansen API](https://nansen.ai/api) · Frozen submission: [`submission-2026-09-27`](https://github.com/ghostCODERWEB/peregrine-multichain/releases/tag/submission-2026-09-27)

</div>
