# 01 · Product analysis

Written after running the app (production build, `DEMO_MODE=1`, recorded Nansen data from 2026-09-24) on desktop (1440 and 1920 wide) and phone (390 × 844, touch), and reading the server code behind each feature.

## What Peregrine is

An onchain intelligence terminal on the Nansen API. It does three things Nansen alone does not:

1. **It keeps history.** A worker scans Nansen every 30 minutes and stores flows, trades and snapshots, so pages read from storage (a page view costs no credits) and time-based views exist (Flow Index over 7 days, sector flow over time, Time Machine).
2. **It models.** Pure, tested models turn Nansen data into scores: the Token Score (50% Nansen risk indicators, 50% Peregrine's model), the Flow Index per chain, copy scores for traders, trader grades for wallets, Cascades statistics. Models are backtested on the Proof page (dump-risk AUC 0.84 on unseen weeks).
3. **It explains.** Analyze with Nansen (Genie Ask on the phone) reads whatever is on screen, or an element the user picks, and answers with Nansen's agent.

**Who it is for:** onchain traders and researchers who already use Nansen and want answers (is this token dangerous, who is worth following, is this wallet any good, where is money moving) rather than raw tables.

## Main use cases, as they flow in the app

| Use case | Where | What the user gets |
|---|---|---|
| Read the market in one look | Overview `/` | Headline "Accumulating Ton. Distributing Near.", animated net-flow ring between chains, Flow Index sparklines, Market Pulse signals |
| Find what is moving | Alpha `/alpha` | Market map of ~150 tokens: flow against price, bubble = volume, colour = alpha score |
| Judge a token | Token page `/token/[chain]/[address]` | Token Score rings, verdict, candlestick chart with ranges and MAs, DEX activity, holders, insider clusters |
| Check for a rug fast | `/rug/[chain]/[address]` | One verdict ("Rug risk: High"), six pass/fail checks with the number behind each |
| Judge a wallet | Profiler `/wallet/[address]` | Trader score (spot, perps, Polymarket), holdings treemap, PnL, counterparties, Time Machine |
| Ask about anything | Analyze dock (⌘J) / Genie Ask (phone) | Suggestions, pick-an-element, streamed answer from Nansen's agent |
| Trust the numbers | Proof `/proof` | 7,903 real Nansen calls, 82 endpoints, backtest AUC curves |
| Use it on the go | Phone app | Liquid Glass tab bar, large titles, card rails, Genie Ask |

## Strongest features (discovered, not assumed)

1. **Overview hero.** The single strongest establishing frame: a plain-English headline, a live flow ring with particles running along the arcs, and two Flow Index sparklines. Reads in one second.
2. **Token page.** Token Score concentric rings animate in, and the candlestick chart responds to range switching (14D → 1M) with a real re-render. This is where "50% Nansen, 50% model" becomes visible.
3. **Alpha market map.** Visually dense and unique. Shows breadth: 150 tokens positioned by real flow.
4. **Rug risk.** The fastest "answer" screen in the app: a big red verdict and six evidence cards.
5. **Analyze with Nansen / Genie Ask.** The AI layer. The genie animation on the phone is the most distinctive motion in the product. On desktop, "Select from page" (pick a chart, the element is outlined in the signal colour and attached to the question) shows the AI is grounded in page data.
6. **Phone app with Liquid Glass.** A real app layout, not a squeezed desktop: glass tab bar with a gliding lens, shrink-on-scroll, blur over moving content.
7. **Proof page.** Credibility in one frame: 7,903 Nansen calls, 7.9× the buildathon requirement, and backtest ROC curves.
8. **Profiler trader score.** A 0–100 ring and a verdict per market. Strong concept; in demo data the wallet is "Break-even 57" with no perps or Polymarket record, so it is a supporting shot, not a hero.

## Strongest technical capabilities

- 82 Nansen endpoints across 19 API families, cached with per-endpoint TTLs, a credit ledger and a daily cap.
- Streaming token page: every section arrives as its own server-sent event wave (visible as sections filling in).
- Backtested models, point-in-time data, out-of-sample evaluation.
- Redistribution-aware display modes (owner, member, public) enforced on the server.

## Strongest visual features

The flow ring with moving particles; the Token Score rings; the market map bubbles; the genie open/close; the Liquid Glass lens gliding between tabs; the candlestick chart re-rendering on range change; staggered card entrances.

## Strongest Nansen-powered functionality

Everything on screen is Nansen data. The clearest proof points for a viewer: "Nansen risk" as a named ring in the Token Score, "Open in Nansen" and "Get Nansen" buttons, "Nansen risk indicators" on the rug page, and the Proof page's call counts by endpoint family (tgm, profiler, smart-money, prediction-market, agent).

## Strongest AI functionality

Analyze with Nansen: page-aware questions, element picking, streamed answers from Nansen's agent. On the phone it opens as Genie Ask from the tab bar.

## Strongest mobile functionality

Today screen (large title, hero card, Explore grid, signal list), the Liquid Glass tab bar, Genie Ask, and token and wallet pages that keep charts whole.

## Areas NOT to emphasise

- **Owner-only views** (Copy Lab, Cascades, Smart Money network, Risk Radar with Smart Money): they need an owner instance with a key. The demo build shows a locked message, so they are not filmed. The story does not depend on them.
- **Perps coin terminal** (`/perps/BTC`): the positions feed is not in the demo recording ("Not part of the demo recording"). Excluded.
- **Hyperliquid positions and liquidation data on wallets**: the demo wallet has none, and Hyperliquid's public API is not reachable from the capture sandbox. Excluded; mentioned only through the perps board.
- **Prediction market detail page**: several "n/a" tiles in demo data. Excluded. The predictions board is fine for a glimpse.
- **Admin, coverage, accounts, alerts, x402, trade**: operator surfaces, not product story.

## Weak or unfinished parts to exclude

- Any panel showing "Not part of the demo recording", "owner view", "n/a" or an empty state.
- The Nansen logo image in the sidebar CTA (the capture sandbox blocks its host, so it falls back to an "N" tile; frame it small or out).
- External token logos that fail to load in the sandbox (initials fallback): avoid tight crops on logo-heavy tables.

## Honesty note for production

The capture sandbox has no Nansen API key and cannot reach the live deployment, so the AI cannot produce a live answer here. The Genie Ask and Analyze answers in the film are **replayed text composed only from figures visible on the same screen** (Token Score 41, exit liquidity 79, $766K bought vs $943K sold), streamed through the real panel so the real UI animates. Every other frame is the real application on recorded Nansen data. `video-production/src/capture.ts` accepts `LIVE_URL` to recapture the AI shots against an instance with a key.
