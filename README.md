<div align="center">

<img src="public/brand/peregrine-256.png" width="96" alt="Peregrine" />

# Peregrine

**A Smart Money terminal that runs entirely on the Nansen API.**<br/>
It reads Nansen's labeled onchain data, stores it, runs its own tested models on it, and answers a trader's questions with the evidence behind every number, on desktop and as a phone app.

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

<img src="docs/readme/charts/stat-tiles.png" width="100%" alt="At submission: 7,903 Nansen API calls, 92.5% of the documented Nansen API, 12,888 requests served from cache, 0.84 AUC, 38 chains, 667 tests" />

<img src="docs/readme/gifs/overview.gif" width="100%" alt="The Overview: 'Buying Ton. Selling Near.' over a live net-flow ring whose arcs draw in and carry particles from the chains losing money to the chains gaining it, with Flow Index sparklines for the top inflow and outflow chains" />

Peregrine started as a list of things I would love Nansen to do next. It opens with **six features Nansen does not have yet**, then walks through **every page** of the terminal, the **phone app**, **how the AI works**, the **proof** that it is real and tested, and **how it is built**.

### At a glance

| | |
|---|---|
| **What it answers** | Where is Smart Money moving? Is this token about to dump? Who is worth following? Is this wallet any good? Who leads Smart Money? What is the full story? |
| **Built on Nansen** | 82 Nansen endpoints; 7,903 real calls during the buildathon; 38 chains; token search on 25 networks |
| **Its own models** | 34 pure, unit-tested models: Token Score, dump and breakout odds, Flow Index and 24h forecasts, Perp Flow Index, copy score, trader grade, Cascades statistics, volatility cone, wallet clustering |
| **The product** | 35 pages and 56 API routes: a desktop terminal, a native-feeling phone app, an AI layer on Nansen's agents, and an MCP server for other agents |
| **Proof** | Out-of-sample backtests (AUC 0.84), a ledger of every Nansen call, 667 unit and integration tests at submission plus Playwright end-to-end tests on desktop and phone |

## Contents

1. **[Six features Nansen doesn't have yet](#six-features-nansen-doesnt-have-yet):** [Copy Lab](#1-copy-lab) · [Ask about anything on screen](#2-ask-about-anything-on-screen) · [Cascades](#3-cascades) · [Flow Index](#4-flow-index) · [Token Verdict](#5-token-verdict) · [Section rail](#6-section-rail)
2. **[A tour of every page](#a-tour-of-every-page):** [Overview](#overview) · [Alpha](#alpha) · [Chain flows and chain pages](#chain-flows-and-chain-pages) · [Sectors](#sectors) · [Perps](#perps) · [Prediction markets](#prediction-markets) · [Token pages](#token-pages) · [Profiler and portfolio](#profiler-and-portfolio) · [Smart Money desk](#smart-money-desk) · [History](#history) · [Everything else](#everything-else)
3. **[The phone app](#the-phone-app)**
4. **[How the AI works](#how-the-ai-works)**
5. **[Details that make it feel finished](#details-that-make-it-feel-finished)**
6. **[Proof](#proof)** · [API coverage](#how-much-of-the-nansen-api-it-uses)
7. **[How Peregrine is built](#how-peregrine-is-built)** · [Project structure](#project-structure) · [Run it yourself](#run-it-yourself)
8. **[Appendix: every Nansen endpoint and its call count](#appendix-every-nansen-endpoint-and-its-call-count)**

---

## Six features Nansen doesn't have yet

### 1. Copy Lab

<img src="docs/readme/gifs/copy-lab.gif" width="100%" alt="Copy Lab: 215 traders on one board, spot, perps and prediction markets together, re-ranked when the Perps tab is chosen" />

*Recorded from the live app on 27 September 2026: the All board, then the Perps tab re-ranking Hyperliquid traders.*

A PnL leaderboard tells you who made money. It does not tell you whether you could have made that money by following them. **Copy Lab ranks Smart Money spot traders, Hyperliquid perp traders and Polymarket winners on one board** (215 of them in the recording), each with a **copy score** from 0 to 100:

- **It goes up** when profit repeats across 7, 30 and 90 days, has actually been taken rather than sitting on paper, and comes from many tokens or markets.
- **It goes down** for one lucky trade, for bots that trade dozens of times a day, and for heavy leverage (`src/lib/models/copy-score.ts`).
- **Every row shows what the trader holds right now**, so the list is something you can act on. The *All* board also shows where the leaders agree.
- **If you see the trade late** replays Smart Money buys on Nansen's 15-minute candles and shows how much edge is left if you only notice the trade 15 minutes, 1 hour or 6 hours later.
- Tabs: **All**, **Spot** (Smart Money PnL leaderboard), **Perps** (Hyperliquid leaderboard, with return, consistency, banked profit and leverage), **Predictions** (winners of the busiest Polymarket markets, with their lifetime record), and **KOLs and cohorts** (what Public Figures, Top PnL traders, whales and fresh wallets bought and sold in 24 hours).

### 2. Ask about anything on screen

Most AI chat means copying numbers into a text box. In Peregrine you point at things.

<img src="docs/readme/gifs/analyze.gif" width="100%" alt="Desktop: Cmd+J opens Analyze with Nansen beside the token page with questions written for this page; Select from page outlines the Token Score card, it becomes a chip in the question, and a question is typed" />

*The current app: **⌘J** opens **Analyze with Nansen** beside any page, with suggested questions written for what is on screen. **Select from page** lets you click any chart, token, wallet, market or card: it is outlined, attached to the question as a chip, and the suggestions change to questions about your selection.*

<img src="docs/readme/gifs/ask-anything.gif" width="100%" alt="The full loop on the live Overview: two elements picked from the page and a question answered by Nansen's agent, citing the exact numbers it used" />

*Recorded from the live app on 27 September 2026: two elements picked on the Overview, one question, and the answer from Nansen's agent. It quotes the exact numbers it used and names its evidence at the end.*

<table>
<tr>
<td width="50%" valign="top"><img src="docs/readme/gifs/phone-genie.gif" width="100%" alt="Phone, current app: Ask grows out of the tab bar like the macOS genie, already showing questions about the token on screen, and folds back into the button" /></td>
<td width="50%" valign="top"><img src="docs/readme/gifs/ask-phone.gif" width="100%" alt="Phone, live app on 27 September 2026: Ask grows out of the tab bar on Today, a question is typed and the answer streams in with its evidence" /></td>
</tr>
<tr>
<td valign="top"><b>Genie Ask on the phone.</b> The Ask button in the tab bar grows into the panel, like the macOS genie, already knowing which page you are on, and folds back into the button.</td>
<td valign="top"><b>A full answer on the phone</b> (live app, 27 September 2026): the question is typed and the answer streams in, with the evidence it used listed underneath.</td>
</tr>
</table>

**Why it is trustworthy:** the question never goes to the agent alone. Peregrine builds the context on the server from its own stored readings, each line with its time and source, adds the real stored records behind anything you selected (`src/server/analyze/enrich.ts`), fences it as data, and asks Nansen's agent to answer from it. The full AI layer is described in [How the AI works](#how-the-ai-works).

### 3. Cascades

<img src="docs/readme/gifs/cascades.gif" width="100%" alt="Cascades: the leadership map of Smart Money wallets by average entry rank, one wallet's evidence token by token, and a replay of who entered first" />

*Recorded from the live app on 27 September 2026.*

Smart Money labels treat every wallet the same. But some wallets keep buying first, and others keep following them. **Cascades find the leaders, then test whether it is real or luck.**

- **Leadership map:** every Smart Money wallet placed by its average position in the queue, from *enters first* (left) to *enters late* (right). Arrows mark pairs where one wallet reliably buys before the other.
- **Evidence:** select a wallet to see each token it entered, its rank of *k*, and how many hours ahead of or behind the median Smart Money buyer it was.
- **Cascade replay:** pick a token and watch its Smart Money buyers drop onto a timeline in the order they entered.
- **Honest results:** the recording shows 204 episodes and 304 wallets tested, and **no leader survives the correction**. The page says so plainly rather than showing a list that is always full. The result moves as the 30-day window rolls.

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

1. **Episodes.** For each token, every Smart Money wallet's first buy (≥ $500) within a 72-hour window, with at least 3 wallets.
2. **Leaders.** Entry rank runs from 0 (first) to 1 (last); under random order a wallet's mean rank is 0.5. Each wallet with 3+ episodes is z-tested, then corrected for testing hundreds of wallets at once (10% false-discovery rate).
3. **Pairs.** For wallets that entered 3+ tokens together, an exact binomial test on how often each went first. Entries within a minute count as ties.

**Limits:** entering first is not causation (two wallets can share a source); pair links are not corrected for multiple testing; the backfill is capped at 1,000 trades per token; labels change over time.

### 4. Flow Index

$10M of Smart Money inflow means nothing on Ethereum and a lot on a small chain. So instead of comparing chains with each other, **the Flow Index compares each chain with its own history**: 0 to 100, above 65 accumulating more than usual, below 35 leaving. Its inputs are net flow and volume, scored against the chain's own recent past so one whale cannot throw it off. The Overview (top of this page) sums it up in one sentence over the live net-flow ring.

<img src="docs/readme/shots/overview-index.jpg" width="100%" alt="Flow Index on the Overview: one card per chain with its reading, its 6-hour change and a mood of Accumulation, Neutral or Distribution" />

*Every measured chain on one screen: its Flow Index, how far it moved in 6 hours, and its mood. A Map/Table switch shows the same readings as a sortable table.*

<img src="docs/readme/shots/chain-flows.jpg" width="100%" alt="Chain flows: tracked DEX volume and buy/sell imbalance, the chain flow pulse, net flow by chain for 24 hours and the Flow Index over 21 hours, one line per chain" />

*Chain flows: the pulse of the day in three sentences (net flow, fastest change, breadth), net flow by chain, and each chain's Flow Index over time. Select a bar to open that chain, or a line to isolate it.*

<img src="docs/readme/shots/chain-rotation.jpg" width="100%" alt="Flow Index change over 6 hours per chain, and the market-wide net flow between chains: a ring of chains with arcs from outflow to inflow and the modeled rotation Near to Ton" />

*Where the money went: each chain's Flow Index change over 6 hours, and the rotation ring, with arcs from the chains that lost money to the chains that gained it and the largest modeled rotations listed beside it.*

<img src="docs/readme/shots/overview-risk.jpg" width="100%" alt="Risk alerts, the highest Token Scores across chains, and 24h projections: for each chain furthest from neutral, its recent Flow Index, the forecast and an 80% band" />

*Peregrine forecasts the next 24 hours of every chain's Flow Index (Holt's method, with an 80% range and each forecast's typical error) and lists the riskiest tokens it has scored across chains. At submission, the forecasts' median error was 5.9%.*

### 5. Token Verdict

<img src="docs/readme/gifs/token-checker.gif" width="100%" alt="Token Checker: type pump, results appear across networks as you type, open PUMP and its Token Score, chart and Verdict resolve" />

*Recorded from the live app on 27 September 2026: type a name, pick a result, and the token page resolves with its Token Score, chart and Verdict, including the one-line read from Nansen's agent.*

Every token gets a score from 0 to 100: **half Nansen's own risk indicators, half Peregrine's model** (holder concentration, linked insider wallets, exit liquidity, sell pressure and cohort shear). On top sits a **one-line verdict with up to four reasons, each backed by a number**, a read from Nansen's agent, and **7-day odds** of a 50% dump and a 30% breakout from two fitted models. On a week the models never saw, both scored **AUC 0.84**.

<table>
<tr>
<td width="36%" valign="top"><img src="docs/readme/shots/token-score.jpg" width="100%" alt="The Token Score card expanded: 41 of 100, Moderate, rings for exit liquidity, cohort shear, Nansen risk and sell pressure, all six inputs with their values, and a radar of Nansen's own indicators" /></td>
<td valign="top">
<b>The score, opened up.</b> The rings show the four largest inputs; <i>All inputs and Nansen indicators</i> opens all six, each 0 to 100, higher is riskier:<br/><br/>
<b>Concentration:</b> how much of the supply the ten largest real holders own (exchanges and contracts excluded).<br/><br/>
<b>Insider clusters:</b> top holders linked by a shared first funder, a Nansen relation or the deployer, who can exit together.<br/><br/>
<b>Cohort shear:</b> fresh wallets buying while Smart Money sells, the classic distribution pattern.<br/><br/>
<b>Exit liquidity:</b> DEX liquidity against market cap: whether a large holder could sell without crashing the price.<br/><br/>
<b>Sell pressure:</b> the week's top sellers against its top buyers.<br/><br/>
<b>Nansen risk:</b> Nansen's own indicators, drawn as a radar (liquidity risk, BTC reflexivity, price momentum, token supply inflation), each a percentile against every token Nansen scores.<br/><br/>
<b>Confidence</b> is the share of the model's weight that had data; missing inputs are named, never guessed. Two candidates for the next version (social heat, DCA overhang) are shown but not yet counted.
</td>
</tr>
</table>

```mermaid
flowchart TB
  N["Nansen risk indicators<br/>liquidity · supply inflation<br/>CEX flows · BTC reflexivity"] -->|50%| S((Token Score))
  P["Peregrine model<br/>concentration · insider clusters<br/>exit liquidity · sell pressure<br/>cohort shear"] -->|50%| S
  S --> T["× size tier<br/>stablecoin 0.35 · $10B+ 0.45<br/>$1B+ 0.7 · $100M+ 0.9"]
  T --> V{Verdict}
  V -->|55+| D[Danger]
  V -->|35+| W[Watch]
  V -->|below 35| L[Low risk]
```

The size tier scales established assets down, so a blue chip can't read Danger from onchain patterns alone (`src/lib/models/storm-score.ts`, `src/server/token/forecast.ts`).

<img src="docs/readme/shots/rug.jpg" width="100%" alt="Rug check for NOCK: Rug risk High, Token Score 41, and six checks with pass or fail and the number behind each: exit liquidity, top-10 holders, insider clusters, token age, sell pressure, Nansen risk indicators" />

*The rug check (`/rug/…`) is the fastest answer in the app: one verdict and six pass/fail checks, each with the number behind it and a sentence on why it matters.*

<img src="docs/readme/shots/token-checker.jpg" width="100%" alt="Token Checker: Token Scores from the last 7 days with each input as a coloured cell, the score distribution, and the 100 most traded tokens with price, volume, liquidity, volume-to-liquidity, market cap, age and net flow" />

*The Token Checker: every token scored in the last 7 days with all of its inputs side by side, how the scores are distributed, and the most traded tokens across networks. A volume-to-liquidity ratio above 5× flags thin pools.*

### 6. Section rail

<table>
<tr>
<td width="72%" valign="top"><img src="docs/readme/gifs/section-rail.gif" width="100%" alt="Desktop: hovering the rail on the right edge previews each section's name, and a click jumps to it" /></td>
<td valign="top"><img src="docs/readme/gifs/phone-rail.gif" width="100%" alt="Phone: dragging the rail scrubs through the page with the section's name riding beside the finger" /></td>
</tr>
</table>

Every page has a thin rail on its right edge, one tick per section, the current one longest. **Hover it on desktop or drag it on the phone** and a label shows where you will land (*8/12 · 4 of the top 25 holders sit in insider clusters*); click or let go to jump there. Long pages never feel long.

---

## A tour of every page

### Overview

The home screen answers *what is the market doing?* in a sentence (see the top of this README), then fans out: Market Pulse (the day's four strongest signals across perps, funding, sectors and risk), the Flow Index of every chain, dump-risk leaders, the highest Alpha scores, risk alerts and 24h projections. Each card opens the page behind it.

<img src="docs/readme/gifs/theme.gif" width="100%" alt="The whole terminal switching from the navy theme to the paper theme and back" />

*Two themes: navy, and a paper theme for daylight. Charts, rings and moods are drawn for both.*

### Alpha

<img src="docs/readme/gifs/alpha.gif" width="100%" alt="Alpha, live app on 27 September 2026: the first Smart Money buys, one click to the token and its Verdict, one more to the wallet that bought it" />

*Recorded from the live app on 27 September 2026: early Smart Money buys, sorted by how much went in. One click opens the token and its Verdict, one more the wallet that bought it.*

<img src="docs/readme/gifs/alpha-map.gif" width="100%" alt="The market map: 150 tokens placed by net flow against price change in four quadrants, bubble size by volume, colour by alpha score; hovering a bubble shows its flow, price, volume, liquidity and alpha score" />

*The market map puts 150 tokens in four quadrants (bought and rising, sold while rising, bought while falling, sold and falling). Bubble size is 24h volume, colour is the alpha score, and hovering shows the numbers.*

<img src="docs/readme/shots/alpha-leaders.jpg" width="100%" alt="60 tokens worth a look across every chain: alpha score rings, net buying, 12-scan sparklines, 24h change, liquidity, market cap and the reasons behind each score" />

*Tokens worth a look, filterable by chain: each alpha score comes with its reasons as tags (+24 net buying, +15 persistence, −8 thin liquidity), so you can see why a token ranks.*

### Chain flows and chain pages

<img src="docs/readme/shots/chain-page.jpg" width="100%" alt="The Base chain page: Flow Index 46 neutral, tier and ranks by DEX volume, active addresses and transactions, 7-day stats, and a heatmap of the 96 most-traded tokens coloured by 24h change" />

*Every chain has its own page: its Flow Index and ranks, 7-day activity, and a heatmap of its busiest tokens (toggle between 24h price change and net flow per volume).*

<img src="docs/readme/shots/chain-gauge.jpg" width="100%" alt="Base's flow gauge at 46.5 with 1h, 24h and 7d readings and a 24h projection, and the running all-trader net flow into Base with a shaded 24h Holt projection" />

*The flow gauge with its 1h, 24h and 7d readings and a 24h projection, and the running net flow into the chain with its forecast fan.*

### Sectors

<img src="docs/readme/shots/sectors.jpg" width="100%" alt="Sectors: top inflow and outflow sectors, how many accumulate and distribute, the sector pulse, net flow by sector over 24h and net flow over 8 hours for the most active sectors" />

*Which themes money is moving into and out of: the sector pulse, net flow by sector, and the most active sectors over time. Select a bar to open a sector.*

<img src="docs/readme/shots/sector-tokens.jpg" width="100%" alt="Tokens driving sector flow: the largest single-token flows across sectors with sector, chain, share of the sector's flow and 24h net flow" />

*The tokens behind each sector's flow, so a sector's move can be traced to the handful of tokens driving it.*

### Perps

<img src="docs/readme/gifs/perps.gif" width="100%" alt="Perps, live app on 27 September 2026: BTC's liquidation cascade radar re-rendered for Smart Money only, then positioning history under the pointer" />

*Recorded from the live app on 27 September 2026: the BTC terminal's **liquidation cascade radar** filtered to Smart Money, then positioning history under the pointer. Each coin has its own terminal with a context-aware AI analyst.*

<img src="docs/readme/shots/perps.jpg" width="100%" alt="Perps: highest and lowest funding, spot versus perps divergence, the headline 'Perps are balanced', open interest, median funding, taker flow, coins scored, the Perp Flow Index dial and the perps pulse" />

*Hyperliquid through Nansen in one sentence and one dial: the **Perp Flow Index** (open-interest weighted, 0 to 100) says whether perps lean long or short, next to funding extremes and the day's perps pulse.*

<img src="docs/readme/shots/perps-index.jpg" width="100%" alt="Every coin by Perp Flow Index: a grid of Hyperliquid coins with over $1M open interest, green leaning long and orange leaning short, with the index and 24h change" />

*Every coin with over $1M of open interest, scored the same way as the Flow Index: green leans long, orange leans short. Select one for its terminal.*

<img src="docs/readme/shots/perps-movers.jpg" width="100%" alt="Price movers over 24 hours and yearly funding extremes, each as a paged bar list" />

*Price movers and funding extremes (positive: longs pay), paged 15, 30, 60 or all at a time.*

### Prediction markets

<img src="docs/readme/shots/predictions.jpg" width="100%" alt="Predictions: the day in one sentence, open interest, volume, active markets and traders, a heat dial reading Hot at 1.6 times the week's pace, the prediction pulse and trending markets" />

*Polymarket through Nansen: the day in one sentence, a heat dial for prediction flows against the week's pace, six pulse signals (hottest category, biggest repricing, largest market, concentration, most traders, liquidity) and the trending markets.*

<img src="docs/readme/shots/predictions-movers.jpg" width="100%" alt="Biggest probability movers, largest markets by open interest, and volume by category" />

*What is moving, what is biggest, and where the volume is, by category.*

<img src="docs/readme/shots/predictions-categories.jpg" width="100%" alt="Categories running hot: each category's 24h volume against its daily pace over the last week, with open interest and traders" />

*Each category's volume against its own weekly pace: green is busier than usual, red quieter.*

<img src="docs/readme/shots/prediction-market.jpg" width="100%" alt="A market page: Will Bitcoin reach $87,500 in September? Implied probability 40%, volume, open interest, bid/ask, traders, a market pulse of six signals, 7-day stats and trade flow" />

*Every market has a full page: implied probability and its 24h move, volume, open interest, spread, a six-signal market pulse, 7-day range and volatility, book imbalance and holder concentration.*

<img src="docs/readme/shots/prediction-book.jpg" width="100%" alt="Implied probability over 140 hours with hourly volume, and the order book depth with bids and asks" />

*The price history with hourly volume (scroll or drag to zoom), and the live order book. Further down: who holds each side, skilled holders against the price, positions with cost basis, and recent trades.*

### Token pages

The token page is where the Verdict lives (see [Token Verdict](#5-token-verdict)); its sections stream in one by one, and tabs regroup them: **Overview**, **Flow**, **Holders**, **Leverage**, **Terminal** and **All**, kept in the URL.

<img src="docs/readme/gifs/token-chart.gif" width="100%" alt="Token page: the price chart switching range to one month and style from candles to line to area and back, with a crosshair tooltip, beside the Token Score rings" />

*The price chart: 1H to 1Y ranges, candles, line or area, moving averages, Smart Money buys marked on the chart, and a zoom slider.*

<img src="docs/readme/gifs/holders.gif" width="100%" alt="Holders tab: the top holders floating in a 3D sphere that turns under the pointer, insider clusters in gold and linked holders in green, beside the largest buyers and sellers this week" />

*Holders: the top holders float in 3D and turn under your pointer. Wallets that share a first funder, a relation or a deployer are grouped into **insider clusters**, with the share of supply each cluster holds.*

<img src="docs/readme/shots/token-flow.jpg" width="100%" alt="Flow tab: net flow by Nansen wallet segment for 1h, 6h, 1d and 7d, the same as a ring chart, and the ten largest buyers and sellers of the week" />

*Flow: who is moving the token, by Nansen wallet segment (Smart traders, whales, top PnL, public figures, fresh wallets, exchanges), as bars and as a ring across four windows, and the week's largest buyers and sellers with insider-cluster members marked.*

<img src="docs/readme/shots/token-trades.jpg" width="100%" alt="Terminal tab: the latest 100 DEX trades with side, amount, USD and trader, and the day's largest transfers outside DEX trades" />

*Terminal: the latest DEX trades across the token's pools (select a row for the whole transaction) and the day's largest transfers outside DEX trades. Further sections cover DCA ladders, social pulse, the perp flow gauge, top traders by PnL, and a Token Time Machine.*

### Profiler and portfolio

<img src="docs/readme/shots/profiler.jpg" width="100%" alt="Profiler: trader score 57, Profitable, low hit rate; grades for spot, Hyperliquid perps and Polymarket; net worth, chains, largest holding, top-5 share, effective positions, stablecoins, realized PnL and win rate; allocation treemap and holdings by chain" />

*Any wallet or ENS name: one **trader score** with a grade for spot, Hyperliquid perps and Polymarket, each from that market's own record (no grade without enough trades), then what it holds, by chain and by asset.*

<img src="docs/readme/shots/profiler-holdings.jpg" width="100%" alt="Holdings table with balance, price, value and share, and where realized PnL came from" />

<img src="docs/readme/shots/profiler-pnl.jpg" width="100%" alt="Realized PnL over 30 days with return, tokens and exits, the best tokens by realized PnL, counterparties sent and received, and the wallet's first funder" />

*Holdings (each token opens its page, each risk report its checklist), where realized PnL came from, counterparties, and who funded the wallet first. The full page adds the Hyperliquid workspace, the Polymarket record, a wallet Time Machine and its Cascades role.*

<img src="docs/readme/shots/portfolio.jpg" width="100%" alt="Portfolio of up to five wallets: 10 chains, 66 priced positions as a treemap by value, and the positions table" />

*Portfolio: up to five wallets analyzed together, with coverage by Token Score, the links between the wallets, and a stress test of the largest positions moving together.*

### Smart Money desk

Nansen's Smart Money holdings, trades and labels are kept out of public views by Nansen's redistribution rules, so the desk shows only to the instance owner or to a signed-in member with their own Nansen key. It holds the **Smart Money timeline** (every large Smart Money move of the day, spot and perps together, filterable by kind), a **conviction map** (every token Smart Money holds, by its 24h balance change and how many Smart Money wallets hold it), a **conviction score**, **crowded exits**, the **PnL leaderboard and follow list**, **perp tilt and DCAs**, and the **wallet network** (wallets active in two or more markets, grouped by their position pattern). Copy Lab and Cascades follow the same rule, which is why their recordings come from the owner view of the live app.

### History

<img src="docs/readme/shots/history.jpg" width="100%" alt="History: the Flow Index of the chains that moved most over 24 hours, from stored snapshots" />

*Because Peregrine stores what it reads, it can compare now with 24 hours or 7 days ago: the chains whose Flow Index moved most, the largest Flow Index moves and the largest sector swings.*

### Everything else

| Page | What it does |
|---|---|
| **Research Desk** (`/agent`) | Pick a mode (token due diligence, wallet investigation, who is leading this token, market brief) and a target. A live plan gathers numbered evidence cards from the Token Score, Smart Money flow, Cascades and Copy Lab; Nansen's agent writes a report from that evidence only, with citations you can tap. Saved reports reopen any time. |
| **Desk** (`/desk`) | Make a call on a token (BUY, PASS or SHORT). It is saved with the price Nansen reported at that moment and graded from Nansen candles once its horizon passes. Calls can't be edited: a track record that can be rewritten isn't one. |
| **Alerts** (`/alerts`) | Build Nansen Smart Alerts and Token Score alerts, delivered to Telegram, Discord, Slack or a webhook. |
| **Trade** (`/trade`) | Quotes and prepared transactions through Nansen's trade endpoints; the user always signs in their own wallet. Off unless the operator enables it. |
| **x402** | Pay Nansen per request from your own wallet: Peregrine fetches Nansen's price for a request, forwards the signed payment, and returns the data to you alone. |
| **Time Machine** (`/replay/…`) | Read the evidence at a past cutoff, lock BUY, PASS or SHORT, then reveal what happened. |
| **Coverage** (`/coverage`) | What Nansen serves, chain by chain, and which Peregrine views are built from it (below). |
| **Public API and MCP** | `/api/public/*` serves Peregrine's own numbers (Flow Index forecasts, Token Scores) with no Nansen credits per request; `/api/mcp` is an MCP server for other agents (see [How the AI works](#how-the-ai-works)). |

<img src="docs/readme/shots/coverage-matrix.jpg" width="100%" alt="Coverage: what Nansen serves, chain by chain, as a matrix of chains against Smart Money, Token God Mode, Profiler, trade and backtesting endpoints" />

*The coverage matrix: which Nansen data sets exist for each chain. Peregrine shows each feature wherever Nansen supports it, and says so where it doesn't.*

---

## The phone app

The phone version is its own app, not a squeezed desktop: a Liquid Glass tab bar (Today, Tokens, Copy, Wallets, plus Ask and Search), large titles, inset lists, swipeable card rails, a draggable section rail and Genie Ask.

<table>
<tr>
<td width="33%" valign="top"><img src="docs/readme/gifs/phone-tabs.gif" width="100%" alt="The Liquid Glass tab bar: the glass lens glides from Today to Tokens to Wallets and back as the screens change" /></td>
<td width="33%" valign="top"><img src="docs/readme/gifs/phone-scroll.gif" width="100%" alt="Scrolling Today: the large title collapses into the glass header, content slides under the glass, and the tab bar shrinks" /></td>
<td width="33%" valign="top"><img src="docs/readme/gifs/phone-preview.gif" width="100%" alt="A long panel opens as a preview under a fade; one tap on Show all expands it in place" /></td>
</tr>
<tr>
<td valign="top"><b>Liquid Glass tab bar.</b> A glass lens glides to the active tab while the screen changes underneath it.</td>
<td valign="top"><b>Large titles.</b> The title collapses into the glass header as you scroll, content moves under the glass, and the bar shrinks out of the way.</td>
<td valign="top"><b>Previews.</b> Long panels open as a preview with one tap to expand, so a page stays scannable. Price charts and scorecards always show in full.</td>
</tr>
</table>

Genie Ask and the draggable section rail are shown in [Ask about anything on screen](#2-ask-about-anything-on-screen) and [Section rail](#6-section-rail).

<table>
<tr>
<td width="33%"><img src="docs/readme/shots/phone-today.jpg" width="100%" alt="Phone: Today, with today's date, all-trader net flow across 27 chains, the Explore grid and signals" /></td>
<td width="33%"><img src="docs/readme/shots/phone-tokens.jpg" width="100%" alt="Phone: Tokens, with Token Scores and what is trading now" /></td>
<td width="33%"><img src="docs/readme/shots/phone-token.jpg" width="100%" alt="Phone: a token page with price, changes and the full price chart" /></td>
</tr>
<tr>
<td valign="top"><b>Today.</b> The market in one card, an Explore grid to every area, and the day's signals.</td>
<td valign="top"><b>Tokens.</b> Token Scores and what is trading now; search on 25 networks.</td>
<td valign="top"><b>Token page.</b> The chart stays whole, with every range and style.</td>
</tr>
<tr>
<td><img src="docs/readme/shots/phone-token-score.jpg" width="100%" alt="Phone: the Token Score rings and inputs, expanded" /></td>
<td><img src="docs/readme/shots/phone-rug.jpg" width="100%" alt="Phone: the rug check with Rug risk High and its checks" /></td>
<td><img src="docs/readme/shots/phone-wallet.jpg" width="100%" alt="Phone: a wallet's trader score and its grades per market" /></td>
</tr>
<tr>
<td valign="top"><b>Token Score.</b> The same rings and inputs as on desktop.</td>
<td valign="top"><b>Rug check.</b> The verdict and each check, one per card.</td>
<td valign="top"><b>Wallets.</b> Trader score and a grade per market.</td>
</tr>
<tr>
<td><img src="docs/readme/shots/phone-alpha.jpg" width="100%" alt="Phone: Alpha's market map and spot versus perps" /></td>
<td><img src="docs/readme/shots/phone-flows.jpg" width="100%" alt="Phone: net flow by chain and the Flow Index over 21 hours" /></td>
<td><img src="docs/readme/shots/phone-sectors.jpg" width="100%" alt="Phone: the sector pulse and net flow by sector" /></td>
</tr>
<tr>
<td valign="top"><b>Alpha.</b> The market map, redrawn for a tall screen.</td>
<td valign="top"><b>Chain flows.</b> Net flow and the Flow Index lines.</td>
<td valign="top"><b>Sectors.</b> The pulse and the flows behind it.</td>
</tr>
<tr>
<td><img src="docs/readme/shots/phone-perps.jpg" width="100%" alt="Phone: perps with funding extremes, the headline and the Perp Flow Index dial" /></td>
<td><img src="docs/readme/shots/phone-predict.jpg" width="100%" alt="Phone: prediction markets with the heat dial and pulse" /></td>
<td><img src="docs/readme/shots/phone-market.jpg" width="100%" alt="Phone: a prediction market page with implied probability, volume and market pulse" /></td>
</tr>
<tr>
<td valign="top"><b>Perps.</b> The headline and the Perp Flow Index dial.</td>
<td valign="top"><b>Predictions.</b> The heat dial and the day's pulse.</td>
<td valign="top"><b>A market.</b> Probability, volume, spread and pulse.</td>
</tr>
</table>

---

## How the AI works

Peregrine's AI runs on **Nansen's own agent API** (`agent/fast` and `agent/expert`). Its job is not to chat: it is to explain numbers Peregrine has already computed, and to say where each came from.

```mermaid
flowchart LR
  U["You<br/>a question, and optionally<br/>elements picked on the page"] --> C
  subgraph Server["Peregrine server"]
    C["Context builder<br/>the page's stored readings,<br/>each with its time and source"]
    E["Enrichment<br/>real stored records behind each<br/>selected token, wallet or coin"]
    R["Redaction<br/>public views never carry<br/>Smart Money labels"]
    L["Guards<br/>per-question cache · daily caps<br/>price acknowledgement for expert"]
  end
  C --> E --> R --> L --> N["Nansen agent<br/>agent/fast · agent/expert"]
  N --> A["Streamed answer<br/>quotes the numbers it used<br/>and lists its evidence"]
```

1. **It knows the page.** Each page tells the panel what it shows; the server rebuilds that context from Peregrine's stored readings, each line with its time and source, in the asker's own view.
2. **You can point.** *Select from page* attaches any chart, token, wallet, market or card; the server adds the real stored records behind it (`src/server/analyze/enrich.ts`), at no extra Nansen cost.
3. **It is fenced.** The context is passed as data; names inside it are untrusted and sanitized.
4. **It respects Nansen's rules.** An answer in a public view can't carry wallet labels or Smart Money activity: a public answer is held until complete, and one that drew on a labeled source is replaced by a plain reading.
5. **It is budgeted.** The same question about the same subject within an hour is answered from the cache for free; public views share a daily cap; the expert agent (750 credits a question) needs the price acknowledged every time.

| AI surface | Where | What it does |
|---|---|---|
| **Analyze with Nansen** | ⌘J on any desktop page | Page-aware questions, *Select from page*, streamed answers that cite their numbers |
| **Genie Ask** | ✦ in the phone tab bar | The same panel, grown out of the tab bar, for the screen you are on |
| **Ask Nansen about a token** | Token pages | Suggested questions about that token (*Who is buying NOCK this week? Is there enough liquidity to exit?*), answered from the scores Peregrine computed |
| **Verdict read** | Every token's Verdict card | A one-sentence read from Nansen's agent next to the numbers |
| **AI briefs** | Token pages, chain pages, perps terminal | A four-sentence brief written by Nansen's agent from Peregrine's numbers, reused for an hour, generated only on request |
| **Research Desk** | `/agent` | A live research plan, numbered evidence cards, and a report written from that evidence only, with tappable citations |
| **Expert research** | Research Desk, perps terminal | `agent/expert` with follow-ups that keep the conversation; answers saved privately to the account |
| **Perps analyst** | Each coin's terminal | Reads the filters, liquidation band and positions in view; quick or deep mode |
| **MCP server** | `/api/mcp` | Peregrine as a tool for other agents: 10 tools (market weather, a chain, a token's score, alpha, perps, predictions, sectors, rotation fronts, Smart Money, search), public view by default, private with an account token |

---

## Details that make it feel finished

<img src="docs/readme/gifs/pager.gif" width="100%" alt="The pager on the most traded tokens table: the green lens glides from page to page, and the rows swap in place without the page jumping" />

*Long tables and lists are paged (15, 30, 60 or all rows). The current page's green lens glides between numbers like the phone tab bar's, and the controls stay under the pointer: nothing jumps.*

- **Every chart names its sources.** An info popover lists the Nansen calls behind each chart, and research results cite their evidence.
- **Streaming pages.** Token pages arrive section by section as each server-sent wave lands, with placeholders the exact size of what replaces them, so nothing shifts.
- **One failing section never blanks a page.** Every card has its own error boundary that retries once, with a Retry that refetches from the server.
- **Performance.** After the submission: 44% less JavaScript, no layout shift, no idle CPU use, and long tables render their later rows only when used.
- **Share cards.** Every section has its own link preview, and a shared token link previews its verdict, score dial and sub-scores.
- **Keyboard.** ⌘K search across tokens, wallets and ENS names; ⌘J Analyze; table rows work from the keyboard.
- **A guided tour** on first visit, and plain-language empty states that say why data is missing instead of showing a blank.

---

## Proof

Every number in this section is from the submission (the Proof page ledger, 22 to 26 September 2026). `docs/readme/data/` holds the exact exports, and `scripts/readme-assets/` redraws every chart from them.

<img src="docs/readme/shots/proof-calls.jpg" width="100%" alt="The Proof page: 7,903 Nansen API calls during the buildathon, 7.9 times the 1,000 required, 82 endpoints, 12,888 more served from cache, calls per day, and calls by endpoint family" />

*The Proof page's ledger: every Nansen call Peregrine made, by day and by endpoint family.*

<img src="docs/readme/charts/calls-per-day.png" width="100%" alt="7,903 Nansen API calls in five days" />

<img src="docs/readme/charts/calls-by-family.png" width="100%" alt="Nansen API calls by endpoint family" />

<img src="docs/readme/charts/live-vs-cache.png" width="100%" alt="Data requests answered live vs from cache" />

A background worker reads Nansen every 30 minutes and stores what it finds, so most page views cost no credits: **12,888** requests (**62%** of all data requests in the ledger window) were answered from the cache.

<img src="docs/readme/charts/model-roc.png" width="100%" alt="ROC curves for the dump-risk and breakout models on the held-out week" />

| Model | Test | Result at submission |
|---|---|---|
| Dump odds (fitted model) | ≥ 50% drawdown within 7 days | **AUC 0.84** (the Token Score's hand-set weights: 0.71) |
| Breakout odds (fitted model) | ≥ 30% run-up within 7 days | **AUC 0.84** (hand-set weights: 0.78) |
| Volatility cone | price inside the 80% band after 1 day | **83%** of 754 token-days (target 80%) |
| Flow projections | next Flow Index reading per chain | **5.9%** median error |

Models are trained on three earlier weeks (576 token-weeks) and tested on the week of 8 September 2026 (178 token-weeks) that they never saw, using Nansen point-in-time data. The dump test has only 8 events, so its AUC interval runs from 0.67 to 1.00; the Proof page states this too.

### How much of the Nansen API it uses

<img src="docs/readme/charts/api-coverage.png" width="100%" alt="Peregrine uses 92.5% of the documented Nansen API" />

Peregrine called **74 of the 80 documented Nansen endpoints (92.5%)**, plus 8 that are not in the published docs (account, Hyperliquid trading, points and social posts): **82 endpoints** in total. The 6 unused are Smart Alert management (3), trade execution and bridge status (2), and premium labels (1). The documented list is `docs/openapi.json` (merged from docs.nansen.ai); the calls are the Proof page ledger (`fixtures/proof-ledger.json`). Paths are compared after removing version prefixes (`v1`, `v1beta1`, `beta`). Every endpoint and its call count is listed in the [appendix](#appendix-every-nansen-endpoint-and-its-call-count).

<img src="docs/readme/charts/chain-coverage.png" width="100%" alt="38 chains, each feature where Nansen supports it" />

---

## How Peregrine is built

```mermaid
flowchart TB
  subgraph Nansen["Nansen API · 82 endpoints"]
    SM[smart-money/*]
    TGM[tgm/* Token God Mode]
    PR[profiler/*]
    HL[perp-screener · perp-leaderboard]
    PM[prediction-market/*]
    BT[historical / backtesting]
    AG[agent/fast · agent/expert]
  end
  subgraph Worker["Background worker · every 30 min"]
    SC[Scanner: flows, trades, snapshots]
    SW[Token Score sweep]
    CB[Cascades backfill, daily]
  end
  subgraph Store["SQLite"]
    DB[(trades · snapshots · scores<br/>cache · credit ledger · jobs)]
  end
  subgraph Models["34 pure, tested models"]
    M1[Token Score · odds]
    M2[Cascades statistics]
    M3[Copy score · trader grade]
    M4[Flow Index · forecasts]
  end
  subgraph App["Next.js app"]
    API[56 API routes · streaming]
    AI[AI layer]
    UI[Desktop terminal]
    PH[Phone app]
    MCP[MCP server · public API]
  end
  SM & TGM & HL & PM --> SC
  TGM --> CB
  BT --> M1
  SC & SW & CB --> DB
  DB --> M1 & M2 & M3 & M4
  M1 & M2 & M3 & M4 --> API
  PR & TGM --> API
  AG --> AI --> API
  API --> UI & PH & MCP
```

- **Stored, not re-fetched.** A background worker scans Nansen every 30 minutes and stores flows, trades and snapshots in SQLite. Pages read from storage, so a page view costs no credits and history builds up over time (Flow Index lines, History, forecasts, Cascades).
- **Models are pure functions** in `src/lib/models/` with unit tests: they take stored readings and return scores, so every number on screen is reproducible.
- **One path to Nansen.** Every call goes through `callNansen` (`src/server/nansen/client.ts`), shown below.
- **Display modes on the server.** Each request resolves to *owner*, *member* (a signed-in user with their own Nansen key) or *public*, and Smart Money labels and scanner history only reach the views Nansen's redistribution rules allow.
- **Security.** Strict CSP and security headers on every response, same-origin checks on the API, per-visitor rate limits keyed on the trusted client address, and a health check for the platform.

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

### Project structure

```text
src/
  app/          35 pages and 56 API routes (Next.js App Router)
  components/   the UI: desktop terminal, phone app (mobile/), charts (ECharts, SVG), AI panel (analyze/, agent/)
  server/       Nansen client and cache, display modes, the scanner jobs, and one module per product area:
                weather (Flow Index), token, wallet, perps, predict, sectors, alpha, cascade, copy, research,
                agents (AI), mcp, desk, trade, x402
  lib/models/   34 pure models with unit tests: storm-score, logistic odds, holt-forecast, cpi (Flow Index),
                ppi (Perp Flow Index), copy-score, trader-grade, cascade, volatility-cone, wallet-clustering, ...
  worker/       `pnpm worker`: the background process that scans Nansen and runs queued jobs
packages/
  tide-mcp/     a dependency-free MCP bridge over stdio for local agents
fixtures/       recorded Nansen responses for demo mode, the submission's call ledger and backtest results
e2e/            Playwright end-to-end tests on desktop and phone
scripts/        backtests, Cascades backfill, API validation, README assets
```

**Stack:** Next.js 15, React 19, Tailwind v4, ECharts, SQLite (better-sqlite3), Vitest, Playwright, viem (for ENS). One Docker container runs the web app and the worker, with SQLite on a volume.

### Data sources and captures

- **Nansen** is the data source for every analytic, score and model in Peregrine.
- **Other sources, not used for analytics:** token and protocol logos (DexScreener, Jupiter, CoinGecko, CoinCap, Financial Modeling Prep, DefiLlama icons); ENS name resolution (public Ethereum RPCs and ensideas); and, in perps wallet research, Hyperliquid's public info API for full fill history and candles, next to Nansen's positions. `pnpm assert-nansen-only` lists every such host.
- **Recorded from the live app on 27 September 2026** (owner view, network waits cut out): the Copy Lab, Ask (desktop and phone answers), Cascades, Perps, Alpha and Token Checker GIFs. Their opening fade from black was trimmed; nothing else was changed.
- **Captured from the current app** in demo mode (recorded Nansen data, browser clock set to 27 September 2026) with `pnpm screenshots`: every other screenshot and GIF. Desktop captures are cropped to the page area beside the sidebar.

### Run it yourself

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
python3 scripts/readme-assets/endpoint-table.py # the endpoint table below
pnpm screenshots                                # stills and GIFs from a demo server on :3300 (needs Pillow, numpy, ffmpeg)
```

**Deploy:** the included `Dockerfile` runs the web app and the worker in one container, with SQLite on a volume at `/data`. The live demo runs this way on Railway.

### Demo in 60 seconds

1. **Copy Lab:** who is worth following, in spot, perps and predictions, and what they hold now.
2. **Ask (⌘J):** select a chart and a token, ask which matters most.
3. **Cascades:** did proven early wallets lead the buying? Replay who entered first.
4. **Overview:** where money is moving, chain by chain, against each chain's own history.
5. **Token page:** the Verdict, both halves of the score, the holders sphere and the 7-day odds.

---

## Appendix: every Nansen endpoint and its call count

From the submission's Proof page ledger (22 to 26 September 2026). Generated by `python3 scripts/readme-assets/endpoint-table.py`.

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

