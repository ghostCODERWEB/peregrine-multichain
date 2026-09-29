<div align="center">

<img src="public/brand/peregrine-256.png" width="96" alt="Peregrine" />

# Peregrine

**An onchain intelligence terminal built on the Nansen API.**<br/>
It reads Nansen's labeled data, runs its own tested models on it, and shows every answer with the evidence behind it, on desktop and as a phone app.

### [Submission release: `submission-2026-09-27`](https://github.com/ghostCODERWEB/peregrine-multichain/releases/tag/submission-2026-09-27)

The exact code submitted to the **Nansen Meridian Buildathon** on 27 September 2026.

[![Submission release](https://img.shields.io/badge/submission-release%202026--09--27-00FFA7?style=flat-square&labelColor=0d1114)](https://github.com/ghostCODERWEB/peregrine-multichain/releases/tag/submission-2026-09-27)
[![Live app](https://img.shields.io/badge/live-latest%20build-00FFA7?style=flat-square&labelColor=0d1114)](https://peregrine-submission.up.railway.app)
[![Nansen API calls](https://img.shields.io/badge/Nansen%20API%20calls-16%2C903-00FFA7?style=flat-square&labelColor=0d1114)](#proof-real-usage-and-tested-models)
[![Nansen API coverage](https://img.shields.io/badge/Nansen%20API%20covered-92.5%25%20(74%2F80)-00FFA7?style=flat-square&labelColor=0d1114)](#how-much-of-the-nansen-api-peregrine-uses)
[![Tests](https://img.shields.io/badge/tests-684%20unit%20%C2%B7%2077%20e2e-1fe0a3?style=flat-square&labelColor=0d1114)](#run-it-yourself)
[![Chains](https://img.shields.io/badge/chains-38-f2fbf7?style=flat-square&labelColor=0d1114)](#coverage)

[**Submission release**](https://github.com/ghostCODERWEB/peregrine-multichain/releases/tag/submission-2026-09-27) · [Live app (latest build)](https://peregrine-submission.up.railway.app) · [Submitted build, live](https://peregrine-nansen.up.railway.app) · [Proof page](https://peregrine-submission.up.railway.app/proof) · [60-second film](video-production/output/project-showcase-final.mp4) · [What changed since submission](#what-changed-since-the-submission)

</div>

<img src="docs/readme/numbers.png" alt="Peregrine in numbers: 16,903 Nansen API calls, 23,475 more served from cache, 82 Nansen endpoints, 38 chains, AUC 0.84, 45,329 Smart Money trades for Cascades, 684 tests, 35 pages" />

<img src="docs/readme/gifs/overview-tour.gif" alt="The Overview: where Smart Money is moving across every chain, then Risk Radar and Market Pulse" />

> **Every image and GIF in this README was captured on 29 September 2026 from the live build, running on the production database.** Nothing is mocked. The only edit is cutting the first page load from each GIF. [How they were made ↓](#how-this-readme-was-made)

## Contents

1. [What it answers](#what-it-answers)
2. [The features, most important first](#the-features-most-important-first)
   1. [Overview: where money is moving](#1-overview-where-money-is-moving)
   2. [Analyze with Nansen: ask about anything on screen](#2-analyze-with-nansen-ask-about-anything-on-screen)
   3. [Token Score, Verdict and Token Checker](#3-token-score-verdict-and-token-checker)
   4. [Alpha: the first Smart Money buys](#4-alpha-the-first-smart-money-buys)
   5. [Copy Lab: who is worth following](#5-copy-lab-who-is-worth-following)
   6. [Cascades: who moves Smart Money](#6-cascades-who-moves-smart-money)
   7. [Perps: Hyperliquid, coin by coin](#7-perps-hyperliquid-coin-by-coin)
   8. [Predictions: Polymarket through Nansen](#8-predictions-polymarket-through-nansen)
   9. [Chain flows and chain pages](#9-chain-flows-and-chain-pages)
   10. [Smart Money desk](#10-smart-money-desk)
   11. [Wallet Profiler](#11-wallet-profiler)
   12. [Sectors](#12-sectors)
   13. [Research Desk](#13-research-desk)
   14. [History and Time Machine](#14-history-and-time-machine)
   15. [Proof and Coverage](#15-proof-and-coverage)
   16. [The phone app](#16-the-phone-app)
   17. [Share previews and SEO](#17-share-previews-and-seo)
   18. [Built to hold up](#18-built-to-hold-up)
   19. [Everything else](#19-everything-else)
3. [How the models work](#how-the-models-work)
4. [Proof: real usage and tested models](#proof-real-usage-and-tested-models)
5. [How much of the Nansen API Peregrine uses](#how-much-of-the-nansen-api-peregrine-uses)
6. [Architecture](#architecture)
7. [Project structure](#project-structure)
8. [What changed since the submission](#what-changed-since-the-submission)
9. [Data sources and limits](#data-sources-and-limits)
10. [Run it yourself](#run-it-yourself)
11. [How this README was made](#how-this-readme-was-made)

## What it answers

| Question | Where Peregrine answers it |
|---|---|
| **Where is money moving right now, and on which chain?** | **Overview** and **Chain flows**: net flow for every chain the Nansen API covers, and a 0–100 Flow Index against each chain's own history |
| **What matters on this screen, and why?** | **Analyze with Nansen**: point at any chart, token or card and ask. The answer cites its numbers |
| **Is this token about to dump?** | **Token Score and Verdict**: 50% Nansen risk indicators, 50% Peregrine's model, plus fitted 7-day dump and breakout odds |
| **What is Smart Money buying first?** | **Alpha**: first Smart Money buys, sorted by net bought. One click opens the token, one more opens the wallet |
| **Who is worth following?** | **Copy Lab**: the most profitable traders in spot, perps and prediction markets, ranked by a copy score |
| **Who moves Smart Money?** | **Cascades**: which labeled wallets enter tokens *before* other Smart Money, tested against chance |
| **Where is the leverage?** | **Perps**: Hyperliquid open interest, funding, the Smart Money book and a liquidation radar per coin |
| **What is the crowd betting on?** | **Predictions**: Polymarket categories running hot, repricings and the traders behind them |
| **What is the full story?** | **Research Desk**: a research plan that gathers numbered evidence and writes a cited report |
| **Does any of this work?** | **Proof**: every Nansen call counted, and the models tested on a week they never saw |

## The features, most important first

### 1. Overview: where money is moving

<img src="docs/readme/shots/overview.jpg" alt="Overview: Buying Robinhood, selling BNB Chain, with the net flow map, top inflow and outflow, and Risk Radar" />

The Overview opens with a one-line verdict ("Buying Robinhood. Selling BNB Chain.") from Smart Money net flow over 24 hours. Under it:

- **Net flow map.** The chains that bought and sold the most, with the flow drawn from sellers to buyers.
- **Flow Index cards.** Top inflow and top outflow, each with a 0–100 Flow Index and its recent history.
- **Risk Radar.** Flags Smart Money buying into tokens that score 50 or more on the Token Score.
- **Market Pulse.** The day's signals: Smart Money net flow, unusual activity, accumulation, the largest trade, perps and funding, next to a one-paragraph read from Nansen's agent.

The view tabs switch the whole hero between **Chain flows, Perps, Predictions and Sectors**. When a layer's data is older than its refresh window, it loads the latest by itself and shows the last known board with its real age in the meantime. It never shows an empty "no data" state.

<img src="docs/readme/shots/overview-predictions-layer.jpg" alt="Overview on the Predictions layer: Rugby is running hot, category heat gauges" />

### 2. Analyze with Nansen: ask about anything on screen

<img src="docs/readme/gifs/analyze-desktop.gif" alt="Analyze with Nansen on desktop: select two charts from the page, they land as chips, then type a question" />

**⌘J** opens the Analyze panel on any page. **Select from page** highlights whatever is under the cursor: a chart, a token, a row, a wallet, a market or a card. Each click lands as a chip. The question then goes to Nansen's agent together with the numbers behind those chips, and the answer cites them. **Analyze this page** does the same for the whole screen.

<table><tr>
<td width="30%" valign="top"><img src="docs/readme/gifs/analyze-phone.gif" alt="Analyze on the phone: the panel grows out of the tab bar button" /></td>
<td valign="top">

**On the phone**, Ask grows out of the tab bar button (the "genie" animation) and folds back into it. It reads the page you are on and offers three starting questions built from what is on screen: *What matters most right now? Where is Smart Money rotating, and into what? What is the biggest risk on the board today?*

</td>
</tr></table>

### 3. Token Score, Verdict and Token Checker

<img src="docs/readme/shots/token-verdict.jpg" alt="Token page for Aerodrome: candles with Smart Money overlay, Token Score 26 of 100 with its inputs" />

Every token page opens with its price (candles, line or area; 1H to 1Y; MA20, MA50 and a Smart Money overlay) and the **Token Score**: a 0–100 dump-risk score, **half Nansen's risk indicators and half Peregrine's model**, with every input shown. Concentration, cohort shear, exit liquidity, sell pressure, insider clusters and Nansen risk each have their own bar.

The page goes on to cover:

- **Verdict:** the level, both halves of the score, up to four reasons that each cite a number, and a one-sentence read from Nansen's agent.
- **7-day odds** of a 50% dump and a 30% breakout, from two fitted models, each with its out-of-sample record.
- **DEX activity and a quick read:** net flow, buy against sell volume, and who is on each side.
- **Top buyers and sellers** over 7 days, on one shared USD scale.
- **Insider clusters:** linked top holders as bubbles sized by share of supply, with the shared first funder at the centre.
- **Make a call:** record a view on the token. It is graded at its horizon against Nansen candles, and the grade lands on the Desk.

<img src="docs/readme/shots/token-insiders.jpg" alt="Insider clusters: 8 of the top 25 holders sit in insider clusters; fresh wallets against top PnL wallets" />

<img src="docs/readme/gifs/token-checker.gif" alt="Token Checker: type aero, results appear across networks, open Aerodrome and its score resolves" />

**Token Checker** searches by name, symbol or address across 25 networks, with results as you type. Wallets can be found by ENS name. Its home page ranks **Token Scores from the last 7 days**, split into the Nansen and Peregrine halves with every input as a heat cell. It also shows the score distribution and which risky tokens Smart Money is buying.

<img src="docs/readme/shots/token-checker.jpg" alt="Token Checker: Token Scores for the last 7 days with each input, score distribution and Smart Money buying risk" />

### 4. Alpha: the first Smart Money buys

<img src="docs/readme/gifs/alpha-to-token.gif" alt="Alpha: early alpha buys, open a token, its Token Score resolves" />

**Early alpha buys** are the tokens Smart Money started buying first. Each card shows Smart Money buyers, net bought, market cap, the largest buyer and the price change, and the list can be filtered by chain and buyer count. One click opens the token with its Verdict and Token Score; one more opens the wallet that bought it. Below the cards, a **market map** plots tokens by Smart Money flow against price, next to alpha scores and spot-against-perps divergences.

<img src="docs/readme/shots/alpha.jpg" alt="Alpha: early alpha buy cards across chains" />

### 5. Copy Lab: who is worth following

<img src="docs/readme/gifs/copy-lab.gif" alt="Copy Lab: the board re-ranks for Perps, Predictions and Spot" />

Copy Lab ranks the most profitable traders straight from Nansen, so it works on the first day without waiting for history to build up:

| Tab | Source | Ranked by |
|---|---|---|
| **All** | Every board below, merged | Copy score |
| **Spot** | Smart Money PnL leaderboard over 7, 30 and 90 days, all chains | Copy score, with KOL, fund and trader tags |
| **Perps** | Hyperliquid leaderboard over 30 and 7 days | Return, consistency, banked profit and leverage |
| **Predictions** | Winners of the busiest Polymarket markets, then each one's lifetime record | Lifetime profit, win rate and markets traded |
| **KOLs and cohorts** | Nansen cohort flows: Public Figures, Top PnL traders, Smart Traders, whales, fresh wallets | What each group is buying and selling in 24 hours |

The **copy score** (0 to 100) rewards profit that repeats across windows, is realized rather than on paper, and comes from many tokens or markets. It marks down a single lucky trade, bots trading more than 30 times a day, and high leverage (`src/lib/models/copy-score.ts`). A second study, **If you see the trade late**, replays Smart Money buys against Nansen's 15-minute candles to show how much of the edge survives entering 15 minutes, 1 hour or 6 hours late.

<img src="docs/readme/shots/copy-lab.jpg" alt="Copy Lab: best to follow in every market, with copy scores" />

### 6. Cascades: who moves Smart Money

<img src="docs/readme/gifs/cascades.gif" alt="Cascades: the leadership map, the evidence panel and the cascade replay" />

**The question:** which labeled Smart Money wallets consistently buy tokens *before* other Smart Money wallets, and who follows whom?

- **Leadership map.** Places each wallet by its average entry rank.
- **Evidence panel.** Shows a wallet's episodes, how often it was first, and its typical lead.
- **Replay.** Drops one token's Smart Money buyers onto a timeline in the order they entered.

**The live result on 29 September 2026:**
- 13,016 Smart Money buys form **340 episodes**, and **473 wallets** have enough episodes to test.
- 19 wallets enter first at p < 0.05, but **none survives the 10% false-discovery correction**.
- **17 consistent followers** and **16 "enters before" links**.

The page says this plainly: a strict test that can come back empty is the point. [How it works ↓](#smart-money-cascades)

<img src="docs/readme/shots/cascades.jpg" alt="Cascades: 340 episodes, 473 wallets tested, leadership map and evidence" />

### 7. Perps: Hyperliquid, coin by coin

<img src="docs/readme/shots/perps.jpg" alt="Perps: perps pulse, crowding map and every coin scored" />

Hyperliquid through Nansen. The page shows:

- **Perps pulse** and the market's one-line read ("Perps are balanced…").
- A **crowding map** of yearly funding against the Smart Money long/short skew. It flags coins where the crowd and Smart Money disagree.
- **Every coin scored** with a 0–100 Perp Flow Index, filterable by bias.
- Open interest history, and the biggest open interest movers.
- **Price movers, funding extremes and the Smart Money book by coin.** Every coin, paged together so the three cards stay level on every page.

<img src="docs/readme/gifs/perps-pager.gif" alt="Perps: price movers, funding extremes and the Smart Money book page together, with the liquid page bubble" />

Each coin has its own terminal:

- **Market brief:** statements derived from observed positions. Select any statement to see its records.
- **Positioning history:** Smart Money long and short, and the whole book's long share, snapshot by snapshot. Select a point to replay it.
- **Liquidation Cascade Radar:** where the book's liquidations stack up, filterable to Smart Money only.
- **Holders, the crowd against Smart Money, and funding.**

<img src="docs/readme/gifs/perps-coin.gif" alt="BTC perp terminal: market brief, positioning history and the liquidation radar" />

<img src="docs/readme/shots/perps-coin.jpg" alt="BTC perp terminal" />

### 8. Predictions: Polymarket through Nansen

<img src="docs/readme/shots/predictions.jpg" alt="Predictions: Tennis is trading at 6.3x a normal day, heat gauge, prediction pulse" />

Each Polymarket category's activity is measured against its own weekly pace: "Tennis is trading at 6.3× a normal day", with a 0–100 heat gauge. The page then shows:

- The biggest repricings and the largest trades.
- Trending markets.
- Category pages.
- A full page per market: price history, order book, top holders valued at today's price, and whether skilled money agrees with the price.

### 9. Chain flows and chain pages

<img src="docs/readme/shots/chain-flows.jpg" alt="Chain flows: DEX volume, buy and sell imbalance, chain flow pulse, net flow by chain and Flow Index" />

**Chain flows** covers every chain the Nansen API supports:

- **Summary strip:** DEX volume, buy/sell imbalance, Smart Money DEX net, the top Smart Money buy and sell, and the fastest-growing chain.
- **Chain flow pulse.**
- **Net flow by chain.**
- **Flow Index history**, and the biggest Flow Index moves over 6 hours.
- **Rotations:** capital moving chain to chain through the same wallets within 12 hours.

<img src="docs/readme/shots/chain.jpg" alt="Solana chain page: Flow Index 26, distribution, and a heatmap of the most-traded tokens" />

Every chain has its own page. It shows:

- The chain's **Flow Index** and a plain reading ("distribution: smart money net selling").
- A flow gauge with 1h and 7d readings, and a 24h projection.
- Where the chain ranks among 24 chains by DEX volume, active addresses and transactions.
- A heatmap of its most-traded tokens.
- Token flows beside a sector treemap, sized to end level with each other.

### 10. Smart Money desk

<img src="docs/readme/shots/smart-money.jpg" alt="Smart Money desk: timeline of Smart Money trades, hourly DEX flow" />

The page covers:

- **What Smart Money holds and trades:** a live timeline of spot and perp trades, and hourly DEX flow.
- **Conviction and crowded exits.**
- The **PnL leaderboard**, perp tilt and Jupiter DCAs.
- A **wallet network** that groups wallets by the positions they share across markets.

### 11. Wallet Profiler

<img src="docs/readme/shots/profiler.jpg" alt="Wallet Profiler: trader score, spot/perps/predictions, quick read, allocation and chains" />

Profile any wallet or ENS name. The page shows:

- A **trader score** for spot, Hyperliquid perps and Polymarket, each with its own record.
- A quick read of what the wallet does, plus net worth, concentration and realized PnL.
- An allocation treemap, holdings by chain, holdings, PnL attribution, counterparties and the first funder.
- **Time Machine**, and the wallet's role in Cascades.
- Wallets can be compared side by side and saved to a watchlist.

### 12. Sectors

<img src="docs/readme/shots/sectors.jpg" alt="Sectors: top inflow and outflow sectors, sector pulse, net flow by sector over 2 days" />

The page shows which token sectors capital is moving into across chains: DeFi, AI, memecoins, RWAs and more. It includes a sector pulse, net flow by sector over 24 hours and over 2 days, and a page per sector with the tokens driving it.

### 13. Research Desk

<img src="docs/readme/shots/research-desk.jpg" alt="Ask: Research Desk with four modes and saved reports" />

Everything Peregrine knows about a token or wallet, gathered into one cited report:

- **Four modes:** Token due diligence, Wallet investigation, *Who is leading this token?*, and Market brief.
- **A live plan:** every step shows as it runs, and each finding lands as a numbered evidence card with its source.
- **A cited report:** verdict, reasons and what to watch. Tap a citation to highlight its evidence. Saved reports can be reopened.
- **Nansen Expert:** a second tab that asks Nansen's expert agent directly.

### 14. History and Time Machine

<img src="docs/readme/shots/history.jpg" alt="History: BTC and ETH Smart Money positioning, Flow Index for the chains that moved most, largest moves" />

**History** compares now with 24 hours and 7 days ago, from Peregrine's stored snapshots:

- Smart Money perp positioning on BTC and ETH.
- The Flow Index for the chains that moved most.
- The largest Flow Index moves and sector net-flow swings.

**Time Machine** replays a token from a past moment. You make a call with the outcome hidden, then reveal what happened.

### 15. Proof and Coverage

<img src="docs/readme/shots/proof.jpg" alt="Proof: 7,903 Nansen API calls during the buildathon, models tested on a week they never saw" />

**Proof** counts every Nansen call made during the buildathon, and tests the models on a week they never saw ([numbers below](#proof-real-usage-and-tested-models)). **Coverage** shows which Nansen data sets serve each of the 38 chains, what each view is built from, and live API usage.

<img src="docs/readme/shots/coverage.jpg" alt="Coverage: 38 chains, which Nansen data sets serve each one" />

### 16. The phone app

The phone version is its own app, not a shrunk desktop.

<table><tr>
<td width="33%" valign="top"><img src="docs/readme/gifs/phone-tabs.gif" alt="Liquid Glass tab bar: the lens glides between Today, Tokens, Copy and Wallets" /><br/><sub><b>Liquid Glass tab bar.</b> Today, Tokens, Copy and Wallets, plus Ask and Search. A glass lens glides to the active tab.</sub></td>
<td width="33%" valign="top"><img src="docs/readme/gifs/phone-pager.gif" alt="Numbered pages with the liquid bubble on the phone" /><br/><sub><b>Numbered pages.</b> Long lists page in tens, with the same liquid bubble as the tab bar, and the bar stays under your finger.</sub></td>
<td width="33%" valign="top"><img src="docs/readme/gifs/phone-scroll.gif" alt="Scrolling with the collapsing title and the section rail" /><br/><sub><b>Scrolling.</b> Large titles collapse, the tab bar shrinks, and a section rail on the right jumps between sections.</sub></td>
</tr></table>

<table><tr>
<td><img src="docs/readme/shots/phone-today.jpg" alt="Today" /><br/><sub>Today</sub></td>
<td><img src="docs/readme/shots/phone-tokens.jpg" alt="Tokens" /><br/><sub>Tokens</sub></td>
<td><img src="docs/readme/shots/phone-token.jpg" alt="Token page" /><br/><sub>Token</sub></td>
<td><img src="docs/readme/shots/phone-wallet.jpg" alt="Wallet" /><br/><sub>Wallet</sub></td>
</tr><tr>
<td><img src="docs/readme/shots/phone-copy.jpg" alt="Copy Lab" /><br/><sub>Copy Lab</sub></td>
<td><img src="docs/readme/shots/phone-perps.jpg" alt="Perps" /><br/><sub>Perps</sub></td>
<td><img src="docs/readme/shots/phone-predict.jpg" alt="Predictions" /><br/><sub>Predictions</sub></td>
<td></td>
</tr></table>

### 17. Share previews and SEO

<img src="docs/readme/share-cards.jpg" alt="Share cards for Overview, Perps, Chain flows, a token, Predictions and Cascades" />

Every section has its own **share card** (22 of them). Each is written from the page's own data at the moment of sharing: "Buying Base. Selling Near.", "AERO on Base: Low risk, 26 of 100", "Tennis is trading at 6.4× a normal day". They render at 1200×630 in the app's typeface.

Every page has full metadata, a canonical URL and structured data. The sitemap is built from what is stored today (about 190 URLs across chains, sectors, perps, markets and tokens), next to a robots file and a web app manifest.

### 18. Built to hold up

Details that don't make a screenshot but show on every visit:

- **No blank waits.** Nansen answers are cached per endpoint. A recently expired answer is served at once and refreshed in the background (stale-while-revalidate, up to 24 hours), so a page never goes empty while it reloads.
- **One failing section never blanks the page.** Every card has its own error boundary, which retries once by itself and then offers *Try again*; the rest of the page stays. The Overview ignores a malformed refresh and keeps the last good data. The page-level *Retry* refetches from the server instead of re-rendering the same data.
- **Live changes ease in.** A figure that updates fades from soft to sharp, and new rows settle in, instead of snapping.
- **Controls stay under the finger.** Pressing a pager, a date range or a filter never moves the page, even when a shorter page makes the document shorter near its end.
- **Long lists page themselves.** 15 rows per desktop page and 10 per phone page, with a rows-per-page choice. Later rows render only when used, which keeps pages light.
- **Keyboard and screen readers.** Every clickable row opens with Enter or Space, focus stays on the pager through a page change, and charts carry text labels.
- **Stale builds heal.** A tab opened before a redeploy reloads once for the new build instead of breaking.
- **Locked down in public.** Security headers on every response (strict CSP, HSTS, no framing). On the public site, the API answers only this site's own pages, visitors are rate-limited, and owner-only tools (keys, MCP, x402, trading, the paid expert agent) are switched off. A per-visitor daily credit cap applies.

### 19. Everything else

| Page or tool | What it does |
|---|---|
| **Desk** | Your calls from token pages, their entry receipts, grades at the horizon, and your "Trader DNA" once calls are graded |
| **Rug check** | A focused rug-risk read for any token |
| **Entity pages** | The wallets Nansen attributes to an entity, their holdings and recent flows |
| **Compare** | Perps side by side, and wallets side by side |
| **Alerts and watchlist** | Alerts on tokens, wallets and chains, and a wallet watchlist |
| **MCP server** (`packages/tide-mcp`) | Peregrine as a tool for other agents: `tide_weather`, `tide_storm_score` and `tide_rotation_fronts` over the Model Context Protocol. It reads Peregrine's own JSON APIs, so an agent asking it spends no Nansen credits |
| **x402 pay-per-call** | Nansen's x402 V2 payment flow, with the payment a wallet signs checked by the server before it is forwarded |
| **Trade** | Nansen trading-API quotes for spot and Hyperliquid, off by default and never run by the test suite |
| **Guided tour** | Five steps for first-time visitors, one tap each |
| **Light theme** | The whole app in a paper theme, with its own chart palette |

## How the models work

### Token Score

Every token gets a 0 to 100 dump-risk score, **50% Nansen and 50% Peregrine** (`src/lib/models/storm-score.ts`):

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

- **The Nansen half:** Nansen's own low, medium and high risk levels, weighted by indicator.
- **The Peregrine half:** a weighted mean of holder concentration, linked insider wallets, exit liquidity, sell pressure from top traders, and fresh-wallet buying against Smart Money selling. The weights are hand-set expert weights (`EXPERT_PRIOR_WEIGHTS`).
- **Size tier:** established assets (stablecoins, $10B+ caps, wrapped majors like WETH and WBTC) are scaled down, so a blue chip can't read Danger from onchain patterns alone.

Next to the score, each token page shows **7-day odds** of a 50% dump and of a 30% breakout, from two fitted logistic models (`src/server/token/forecast.ts`).

### Smart Money Cascades

Nansen's Smart Money trade feed covers the last 24 hours, and most tools treat Smart Money wallets as independent actors. Peregrine stores the trades (45,329 so far) and measures the *order* in which Smart Money wallets enter the same token, then tests that order against chance.

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

1. **Episodes.** For each token, every Smart Money wallet's first buy (≥ $500) within a 72-hour window. A new episode starts after the window closes. Each episode needs at least 3 wallets.
2. **Leaders.** Entry rank is scaled from 0 (first) to 1 (last). If entry order were random, a wallet's mean rank would be 0.5. Each wallet with 3+ episodes gets a z-test, and the results are corrected for testing hundreds of wallets at once (10% false-discovery rate).
3. **Precedence links.** For each pair of wallets that entered 3+ tokens together, an exact binomial test on how often each went first. Entries within a minute count as ties.

**Limits.** Entering first is not causation: two wallets can share a source. Pair links are not corrected for multiple testing. The backfill is capped at 1,000 trades per token, and labels change over time.

### Research Desk

```mermaid
sequenceDiagram
  participant U as You
  participant D as Research Desk
  participant P as Peregrine analytics
  participant N as Nansen agent
  U->>D: "GP" (Token due diligence)
  D->>P: resolve target
  D->>P: Token Score and Verdict
  D->>P: Smart Money flow, 24h and 7d
  D->>P: Cascades entry order
  D->>P: Copy Lab followability
  D->>P: market data
  P-->>D: numbered evidence E1 … En
  D->>N: write a report from this evidence only
  N-->>U: Verdict · Why [E2][E5] · Watch
```

### Other models

All of them are pure functions with unit tests in `src/lib/models/`:

- **Flow Index:** `cpi.ts` for chains and `ppi.ts` for perps.
- **Holt forecasts** with an 80% band: `holt-forecast.ts`.
- **Volatility cone:** `volatility-cone.ts`.
- **Liquidation levels:** `liquidation.ts`.
- **Rotation fronts** between chains: `rotation-fronts.ts` and `inferred-rotations.ts`.
- **Wallet clustering:** `wallet-clustering.ts`.
- **Trader grade:** `trader-grade.ts`.
- **Conviction:** `conviction.ts`.
- **Spot against perps divergence:** `spot-perp.ts`.

## Proof: real usage and tested models

<img src="docs/readme/calls-per-day.png" alt="16,903 Nansen API calls in eight days" />

- **16,903 Nansen API calls from 22 to 29 September 2026:**
  - 7,903 in the Proof page's buildathon ledger (22–26 September, `fixtures/proof-ledger.json`).
  - 9,000 in the live database after that window.
- **23,475 more requests were answered from the cache.** A background worker scans Nansen every 30 minutes and stores what it reads, so a page view costs no credits. **58%** of all data requests were free.

<img src="docs/readme/charts/calls-by-family.png" alt="Nansen API calls by endpoint family, buildathon window" />

<img src="docs/readme/charts/model-roc.png" alt="ROC curves for the dump-risk and breakout models on the held-out week" />

| Model | Test | Result | Source |
|---|---|---|---|
| Dump odds (fitted model) | ≥ 50% drawdown within 7 days | **AUC 0.84** (Token Score's hand-set weights: 0.71) | `fixtures/backtest-results.json` |
| Breakout odds (fitted model) | ≥ 30% run-up within 7 days | **AUC 0.84** (hand-set weights: 0.78) | `fixtures/backtest-results.json` |
| Volatility cone | price inside the 80% band after 1 day | **83%** of 754 token-days (target 80%) | `fixtures/backtest-results.json` |
| Flow projections | next Flow Index reading per chain | **7.0%** median error, 27 chains | live, [Proof page](https://peregrine-submission.up.railway.app/proof), 29 Sep 2026 |

**How the models were tested:**
- **Training and test data.** Trained on three earlier weeks (576 token-weeks) and tested on the week of 8 September 2026 (178 token-weeks), which they never saw, using Nansen point-in-time data.
- **Small dump sample.** The dump test has only 8 events, so its AUC interval runs from 0.67 to 1.00. The Proof page says so too.

## How much of the Nansen API Peregrine uses

<img src="docs/readme/charts/api-coverage.png" alt="Peregrine uses 92.5% of the documented Nansen API" />

Peregrine called **74 of the 80 documented Nansen endpoints (92.5%)**, plus 8 more that are not in the published docs (account, Hyperliquid trading, points and social posts): **82 endpoints** in total. The 6 it doesn't use are Smart Alert management (3), trade execution and bridge status (2), and premium labels (1).

- **The documented list** is `docs/openapi.json`, merged from docs.nansen.ai.
- **The calls** are the Proof page ledger (`fixtures/proof-ledger.json`).
- **Matching:** paths are compared after removing version prefixes (`v1`, `v1beta1`, `beta`).

<details>
<summary><b>Every endpoint and its call count in the buildathon window</b> (88 rows)</summary>

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

### Coverage

<img src="docs/readme/charts/chain-coverage.png" alt="38 chains, each feature where Nansen supports it" />

## Architecture

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
    OG[Share cards · sitemap]
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
  DB --> OG
```

Every Nansen call goes through one function, `callNansen` in `src/server/nansen/client.ts`:

```mermaid
flowchart LR
  R[Page, worker or script] --> C{Cache hit?<br/>per-endpoint TTL}
  C -->|fresh| A[Answer · 0 credits]
  C -->|expired, under 24h| S[Serve it now,<br/>refresh in background]
  C -->|miss| B{Visitor daily<br/>credit cap left?}
  B -->|no| L[Last known answer,<br/>or say why]
  B -->|yes| T[Rate limiter<br/>per-second and per-minute buckets]
  T --> N[Nansen API<br/>retry on 429 with Retry-After]
  N --> V[Validate schema · write cache<br/>ledger row · demo fixture]
  V --> A2[Answer]
```

- **Stored, not re-fetched.** Pages read from storage, so history builds up over time and a page view costs no credits.
- **Models are pure functions** with unit tests (`src/lib/models/*`).
- **Every number has its source.** Charts can carry an info popover that lists the Nansen calls behind them, and research results cite their evidence.
- **Stack:** Next.js 15 (App Router, Turbopack), React 19, Tailwind v4, ECharts, TanStack Query, SQLite (better-sqlite3), zod, viem (ENS), Vitest, Playwright.

## Project structure

The numbers below were counted from the repository on 29 September 2026:
- **632 files in `src`**: 35 pages, 56 API routes, 22 share-card routes, 181 components, and about 59,000 lines of TypeScript.
- **103 unit and integration test files** with 684 tests.
- **19 end-to-end specs.**

```text
Peregrine/
├── src/
│   ├── app/                          Next.js App Router: every page, API route and share card
│   │   ├── page.tsx                  Overview (desktop) and Today (phone)
│   │   ├── layout.tsx                shell: sidebar, market strip, tab bar, providers, metadata, JSON-LD
│   │   ├── error.tsx                 page-level error screen: Retry refetches from the server
│   │   ├── global-error.tsx          last resort when the layout itself fails
│   │   ├── globals.css               design tokens (dark + paper themes), glass, pager, rail, motion
│   │   ├── opengraph-image.tsx       share card for the Overview (one per section, 22 in all)
│   │   ├── sitemap.ts · robots.ts · manifest.ts
│   │   ├── alpha/                    Alpha: early Smart Money buys, market map
│   │   ├── token/                    Token Checker, token pages ([chain]/[address]) with Verdict
│   │   ├── copy/                     Copy Lab
│   │   ├── cascade/                  Smart Money Cascades
│   │   ├── perps/                    Perps board, [symbol] coin terminal, compare
│   │   ├── predict/                  Predictions, [id] market pages, category/[name]
│   │   ├── flows/                    Chain flows
│   │   ├── chain/[chain]/            one page per chain
│   │   ├── sectors/                  Sectors and [sector] pages
│   │   ├── smart-money/              Smart Money desk
│   │   ├── wallet/                   Wallet Profiler, [address], compare, watchlist
│   │   ├── entity/[name]/            entity wallets and flows
│   │   ├── agent/                    Ask: Research Desk and Nansen Expert
│   │   ├── history/                  what changed in 24h and 7d
│   │   ├── replay/                   Time Machine
│   │   ├── desk/                     your calls and their grades
│   │   ├── rug/                      rug check
│   │   ├── proof/ · coverage/        proof of usage and models · chain coverage
│   │   ├── portfolio/ · trade/ · alerts/ · account/ · lab/
│   │   └── api/                      56 route handlers: weather, token, verdict, perps, predict, cascade,
│   │                                 wallet, search, research, ask, agent, time-machine, replay, desk,
│   │                                 public (JSON for MCP), mcp, x402, trade, auth, health, …
│   ├── components/                   181 React components
│   │   ├── weather/                  Overview: net flow ring, layers, prediction activity, chain table
│   │   ├── analyze/                  Analyze with Nansen dock, pick mode, genie animation
│   │   ├── token/                    Token Score ring, Verdict, candles, insider clusters, make a call
│   │   ├── perps/                    perps board, crowding map, coin terminal, liquidation radar
│   │   ├── chain/ · sectors/ · predict/ · smart-money/ · wallet/ · alpha/ · cascade/ · pulse/
│   │   ├── research/ · agent/ · desk/ · history/ · rug/ · trade/ · x402/ · search/
│   │   ├── mobile/                   the phone app: Today, Tokens, Copy Lab, Wallets
│   │   ├── shell/                    sidebar, market strip, Liquid Glass tab bar, navigation progress
│   │   ├── charts/ · viz/            ECharts wrappers, ranked lists, maps, gauges
│   │   ├── ui/                       shared primitives (segmented control, keyboard activation, …)
│   │   ├── Card.tsx                  the section card; every card has its own error boundary
│   │   ├── SectionBoundary.tsx       per-section error boundary: retries once, then offers Try again
│   │   ├── Pager.tsx                 numbered pages for long tables and lists, with the liquid lens
│   │   ├── LaterBody.tsx             long tables render their later rows only when used
│   │   ├── LiveValues.tsx            figures that change ease in instead of snapping
│   │   ├── SectionRail.tsx           the fast-scroll section rail
│   │   └── GuidedTour.tsx            five-step first-visit tour
│   ├── server/                       server-only code (never shipped to the browser)
│   │   ├── nansen/                   callNansen: cache, stale-while-revalidate, rate limiter,
│   │   │                             credit ledger, demo fixtures, x402, health
│   │   ├── weather/                  scanner, bulletin, layers, chain pages, inferred rotations
│   │   ├── token/                    Token Score sweep, Verdict, forecasts, candles, on-demand reads
│   │   ├── perps/ · predict/ · alpha/ · copy/ · cascade/ · sectors/ · smart-money/ · wallet/
│   │   ├── agents/                   Nansen agent calls: ask, quick briefs, expert, alerts, perps analyst
│   │   ├── research/ · desk/ · history/ · backtest/ · graph/ · portfolio/ · trade/ · search/
│   │   ├── jobs/                     background jobs (scans, sweeps, backfills)
│   │   ├── mcp/                      MCP endpoint
│   │   ├── auth/                     accounts, sessions, API keys (off on the public site)
│   │   ├── seo.ts · og-data.ts       site URL, page metadata, share-card data
│   │   └── insights.ts · pulse.ts    the pulse panels' findings
│   ├── lib/
│   │   ├── models/                   pure, tested models: storm-score, cascade, copy-score, cpi, ppi,
│   │   │                             holt-forecast, volatility-cone, liquidation, logistic, trader-grade,
│   │   │                             wallet-clustering, rotation-fronts, conviction, spot-perp, …
│   │   ├── viz/                      formatting, colour scales, net flow map layout
│   │   ├── og/                       share-card renderer and its fonts
│   │   └── …                         provenance, capabilities, commands, x402, hydration, stale-build
│   ├── worker/                       the background worker (index.ts) and one-off scan (scan.ts)
│   ├── config/                       capability registry, endpoint ledger, external hosts
│   └── middleware.ts                 security headers (strict CSP, HSTS, no framing), public-site guard:
│                                     same-origin API, per-visitor rate limits, owner-only tools off
├── e2e/                              Playwright: 19 specs on desktop and phone; the 3 trading specs skip
│                                     unless pointed at a private trading instance
├── fixtures/                         recorded Nansen responses for demo mode, backtest results,
│                                     the Proof page ledger
├── scripts/                          worker start, backfills, backtest, capability probes,
│   │                                 assert-nansen-only, fixture tools, stress and smoke tests
│   └── readme-assets/                charts, endpoint table, and the capture and GIF pipeline
├── packages/tide-mcp/                MCP server over stdio for other agents
├── docs/
│   ├── readme/                       every image and GIF in this README
│   ├── openapi.json                  the documented Nansen API, merged from docs.nansen.ai
│   ├── nansen-audit/ · design/       API audit notes and design references
│   └── DECISION_LOG.md · SCORECARD.md · api-validation.md · nansen-quirks-v1.md
├── public/                           brand marks and 126 token and protocol logos
├── video-production/                 the 60-second film: plan, capture and render scripts, output
├── Dockerfile · docker-compose.yml   one container: web app + worker, SQLite on a volume at /data
└── package.json                      pnpm scripts (see below)
```

## What changed since the submission

The submitted code is the [`submission-2026-09-27` release](https://github.com/ghostCODERWEB/peregrine-multichain/releases/tag/submission-2026-09-27). This branch continues from it ([full diff](https://github.com/ghostCODERWEB/peregrine-multichain/compare/submission-2026-09-27...ui-qa-fixes)):

- **Paging everywhere.** Long tables and lists have numbered pages, a rows-per-page choice and a liquid page bubble. The Perps books page together. Later rows render only when used.
- **Reliability.** Every section has its own error boundary. Expired cache answers are served at once and refreshed in the background. Prediction activity fills itself in. Retry refetches from the server.
- **Motion and feel.** Live values ease in. Controls stay under the finger. Side-by-side cards end level. The section rail on phones is bigger.
- **Performance.** 44% less JavaScript, no layout shift, no idle CPU burn, and lighter page loads.
- **Share previews and SEO.** 22 share cards, full metadata, a sitemap, robots and a manifest.
- **Production audit.** Security headers everywhere, the trusted client IP, correct API status codes, Nansen attribution on public views, and a truthful market map.
- **Tests.** The unit test run now excludes third-party test files and runs the project's own 684 tests. The end-to-end specs follow the current UI.

## Data sources and limits

- **Nansen** is the data source for every analytic, score and model in Peregrine.
- **Other sources, not used for analytics:**
  - token and protocol logos (DexScreener, Jupiter, CoinGecko, CoinCap, Financial Modeling Prep, DefiLlama icons)
  - ENS name resolution (public Ethereum RPCs and ensideas)
  - Hyperliquid's public info API, used in perps wallet research for full fill history and candles, next to Nansen's positions.

  `pnpm assert-nansen-only` lists every such host.
- **Call counts:** the 16,903 figure is the Proof page ledger (22–26 September) plus the live database after that window (to 29 September). The two don't overlap.
- **Model limits:** the dump test has 8 events. Cascades links are not corrected for multiple testing. Labels change over time.

## Run it yourself

```bash
pnpm install
cp .env.example .env.local        # add NANSEN_API_KEY
pnpm dev                          # web app on http://localhost:3000
pnpm worker                       # background scanner, in a second terminal
pnpm tsx scripts/cascade-backfill.ts   # optional: fill 30 days of Cascades history now
pnpm test                         # 684 unit and integration tests
pnpm e2e                          # Playwright end-to-end, desktop and phone
pnpm dev:demo                     # demo mode on :3300 from recorded Nansen responses, no key needed
pnpm verify                       # Nansen-only check, types, tests and a production build
```

**Deploy:** the `Dockerfile` runs the web app and the worker in one container, with SQLite on a volume at `/data`. The live app runs this way on Railway.

## How this README was made

- **Screenshots and GIFs:** `scripts/readme-assets/capture.mjs` drives a real browser through the live build: desktop at 1440×900, phone as an iPhone 14 Pro. It saves stills and records each interaction. `scripts/readme-assets/clip-to-gif.sh` turns a recording into a GIF. The only edit is cutting the first page load.
- **Numbers** come from the live database and this repository on 29 September 2026. The buildathon charts in `docs/readme/charts/` are redrawn from `docs/readme/data/` by `scripts/readme-assets/charts.py`.

```bash
BASE=https://peregrine-submission.up.railway.app node scripts/readme-assets/capture.mjs shots   # stills
BASE=https://peregrine-submission.up.railway.app node scripts/readme-assets/capture.mjs clips   # recordings
scripts/readme-assets/clip-to-gif.sh overview-tour 760 8 80                                    # one GIF
python3 scripts/readme-assets/charts.py                                                        # buildathon charts
```

---

<div align="center">

<a href="https://nansen.ai"><img src="public/brand/nansen/wordmark-greenwhite.svg" height="28" alt="Nansen" /></a>

Built for the **Nansen Meridian Buildathon** on the [Nansen API](https://nansen.ai/api) · [Submission release](https://github.com/ghostCODERWEB/peregrine-multichain/releases/tag/submission-2026-09-27)

</div>
