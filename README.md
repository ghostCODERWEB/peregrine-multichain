# Peregrine

**Peregrine scores every token's dump risk (50% Nansen, 50% our own model), flags when Smart Money buys into danger, and measures which Smart Money wallets you can actually copy when you see their trade late.**

**Live:** https://peregrine-nansen.up.railway.app · **Proof:** [/proof](https://peregrine-nansen.up.railway.app/proof)

| | |
|---|---|
| **7,903** real Nansen API calls during the buildathon | **82** endpoints across 19 Nansen API families |
| **0.84 AUC** for the dump-risk score on unseen test weeks | **25** networks in one token search, with ENS names for wallets |

## Flagship research feature: Smart Money Cascades

**Peregrine can test which labeled Smart Money wallets consistently enter tokens *before* other Smart Money wallets, and who follows whom, by deriving entry-order statistics and a precedence network from Nansen's labeled Smart Money trades.** I could not find this workflow implemented directly in Nansen or the competitors reviewed (Arkham, Bubblemaps, Dune dashboards, ChainfiAI and others): tools show who bought a token, or how early Smart Money is versus the market price, not the ordering *among* Smart Money wallets, tested against chance.

**Research question.** When several Smart Money wallets buy the same token, is the order random, or do some wallets reliably get there first, and do specific wallets reliably precede specific others?

**Why existing tools are insufficient.** Nansen's Smart Money trade feed (`smart-money/dex-trades`) covers only the trailing 24 hours with no date parameter, so ordering across weeks cannot be read from it; Token God Mode shows one token at a time. Answering the question means joining trades across hundreds of tokens, ordering entries, and testing against a null model: an export-to-Python job today.

**Nansen data used.**
| Endpoint | Role |
|---|---|
| `smart-money/dex-trades` | the live labeled Smart Money tape, stored every scan (trailing 24h per call) |
| `tgm/dex-trades` with `only_smart_money: true` and a date range | 30 days of labeled Smart Money trades per token, backfilled daily for the 150 most-touched tokens |
| Nansen wallet labels (in both) | who each wallet is; the whole analysis is defined over Nansen's Smart Money set |

**Method** (`src/lib/models/cascade.ts`, unit-tested):
1. *Episodes.* Per token, each wallet's first buy (≥ $500) within a 72-hour window; a new episode starts after the window closes. Episodes need 3+ distinct wallets.
2. *Leaders.* Entry rank is scaled to r = (rank − 1)/(k − 1). If order were random, r has mean ½ and variance (k+1)/(12(k−1)). A z-test on each wallet's mean rank across its episodes (3+ episodes), then Benjamini–Hochberg at a 10% false-discovery rate across all wallets tested.
3. *Precedence links.* For each pair that co-entered 3+ tokens, an exact two-sided binomial test on how often each entered first; entries within a minute are ties.

**Evidence model.** Every claim opens to its trades: a wallet's episodes (token, rank of k, minutes ahead of the median Smart Money entrant), a link's record (e.g. 7/7), tokens and typical gap, and a replay of any episode's entry sequence. Wallet pages show the wallet's cascade role.

**Current result (30 days, local run).** 12,443 Smart Money buys → 334 episodes → 463 wallets tested: 17 lead at p < 0.05, **4 survive the 10% FDR correction**, 16 consistently follow, 18 pairwise links at p ≤ 0.1.

**Limitations.** Entering first is not causation: two wallets can share an information source. Links are not multiple-testing corrected (treat them as leads for research). The 30-day backfill is capped at 1,000 trades per token, and Smart Money labels change over time. Small tokens with few Smart Money entrants are excluded by design.

**Architecture.** Nansen API → `server/cascade/backfill.ts` (daily, in the scanner job) and the live scan → SQLite (`cascade_trades`, `smart_money_trades`) → `lib/models/cascade.ts` (pure statistics) → `server/cascade/cascades.ts` (30-minute cache, view shaping) → `/cascade` (Leadership map, Evidence, Cascade replay, links table, method).

**Demo.** Open `/cascade`: the ringed dots on the left of the Leadership map are FDR-surviving leaders; click one for its evidence, pick a token in Cascade replay to watch who entered first, then open the wallet.

## The story in five taps

1. **Token Verdict:** open any token and get *Low risk / Watch / Danger*, the Token Score with its Nansen and Peregrine halves, reasons that each cite a number, and one sentence from Nansen's AI agent.
2. **Risk Radar:** the Overview leads with Smart Money wallets buying tokens that score High or Critical, each one tap from its verdict and a share to X.
3. **Copy Lab (new):** every Smart Money buy replayed against Nansen's 15-minute price candles: the 24-hour return of entering at the same moment, 15 minutes, 1 hour and 6 hours late. Each wallet gets a Followability score. On our data the median Smart Money buy is down 7.6% a day later, a third of the average edge is gone within 15 minutes, and only a handful of wallets stay profitable to follow.
4. **The wallet behind the move:** one-page wallet profile with holdings, realized PnL, counterparties, first funder, ENS name and Hyperliquid positions.
5. **Proof:** every Nansen endpoint used and how often, plus the score's ROC curve and calibration on unseen data, with its limits stated.

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
