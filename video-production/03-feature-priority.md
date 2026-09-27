# 03 · Feature priority

Scores 1–5. Screen time is in the final cut.

## HERO FEATURES

| Feature | Route / component | Importance | Presentation value | Visual strength | Uniqueness | Screen time | Device | Interaction | Animation | Camera | In film |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Overview hero: headline + flow ring | `/` · `WeatherView`, `FlowOrbital` | 5 | 5 | 5 | 5 | 5.0 s (+4.5 s climax reprise) | Desktop 1920 | Page load, hover a chain node | Arc draw-in, particles along arcs, sparkline draw | Slow push-in from 100% to 112% on the ring | Yes |
| Token page: Token Score + chart | `/token/base/0x9b5e…` · `TokenView`, `StormDial`, `TokenPriceChart` | 5 | 5 | 5 | 4 | 7.0 s | Desktop | Load, switch range 14D → 1M, toggle Line → Candles | Rings animate in, chart re-renders | Push to rings, then reframe to chart | Yes |
| Analyze with Nansen (desktop) | `AnalyzeDock` | 5 | 5 | 4 | 5 | 9.0 s | Desktop | ⌘J, "Select from page" on the score card, type question, send | Panel slide-in, selection outline, streamed text | Reframe right third, push on answer | Yes |
| Phone app + Liquid Glass + Genie Ask | `/` phone, `TabBar`, `AnalyzeDock` | 5 | 5 | 5 | 5 | 8.0 s | Phone 390 × 844 @3x | Tap tabs, scroll, tap Ask, ask | Lens glide, bar shrink, genie open, stream | Device on dark stage, slight tilt-free float | Yes |

## SUPPORTING FEATURES

| Feature | Route | Importance | Presentation value | Visual strength | Uniqueness | Screen time | Device | Interaction | Animation | Camera | In film |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Alpha market map | `/alpha` | 4 | 5 | 5 | 4 | 3.5 s | Desktop | Hover bubbles | Bubble hover emphasis | Slow drift across the map | Yes |
| Rug verdict | `/rug/base/0x9b5e…` | 4 | 5 | 4 | 4 | 3.0 s | Desktop | Load | Score ring, cards stagger | Push on "Rug risk: High" | Yes |
| Proof | `/proof` | 4 | 4 | 4 | 5 | 4.0 s | Desktop | Load | Bars and ROC draw | Push on 7,903 | Yes |
| Chain flows · Flow Index | `/flows` | 3 | 4 | 4 | 3 | 2.5 s | Desktop | Hover a line | Chart tooltip | Pan across chart | Yes |

## FAST GLIMPSES

| Feature | Route | Screen time | Device | In film |
|---|---|---|---|---|
| Profiler trader score | `/wallet/0xcbb8…` | 2.0 s | Desktop | Yes |
| Token Checker table | `/token` | 1.5 s | Desktop | Yes |
| Phone Tokens tab | `/token` phone (via the tab bar) | 1.0 s | Phone | Yes |
| Market boards: predictions, perps, sectors | `/predict`, `/perps`, `/sectors` | 6.0 s (2 s each) | Desktop | Yes |

## DO NOT SHOW

| Feature | Reason |
|---|---|
| Copy Lab, Cascades, Smart Money network, Risk Radar (Smart Money) | Owner-only; demo shows a locked message |
| Perps coin terminal, liquidation radar | Not in the demo recording |
| Hyperliquid positions on a wallet | Demo wallet has none; Hyperliquid API unreachable from capture |
| Prediction market detail | Several n/a tiles in demo data |
| Coverage, admin, accounts, alerts, trade, x402 | Operator surfaces |
| Any error, empty, or "owner view" state | Breaks the product impression |
