# 06 · Capture plan

## Setup

- **App:** production build, `DEMO_MODE=1 next start` on `localhost:3500`, fresh database seeded from `fixtures/scan-history.json` (recorded Nansen data, 2026-09-24). Deterministic: the same routes, tokens and wallets every take.
- **Browser:** Playwright with the preinstalled Chromium, headless, dark colour scheme, guided tour dismissed via `localStorage['pg-tour-v1'] = 'done'`, dev overlays removed. No browser chrome is ever in frame (page-only capture).
- **Desktop:** 1920 × 1080 viewport, device pixel ratio 1.
- **Phone:** 390 × 844, device pixel ratio 3, `isMobile`, `hasTouch`, touch taps via `page.tap`.
- **Recording:** Chrome DevTools screencast (`Page.startScreencast`, JPEG quality 92, every frame). Each frame is saved with its capture timestamp, so the editor places frames on real time and holds a frame until the next repaint. Target ≥ 30 captured fps in motion; the edit renders at 60 fps (frames held between repaints; camera moves are computed per output frame, so motion stays smooth).

## Deterministic data

- Token: Nock on Base, `0x9b5e262cf9bb04869ab40b19af91d2dc85761722` (Token Score 41, rug risk High).
- Wallet: `0xcbb811f129782ef87e19dea9d3375045219bae00` (trader score 57).
- Everything else is the recorded demo state.

## Per take (routes, waits, actions)

| Take | Start | Wait before record | Actions while recording | Hold after |
|---|---|---|---|---|
| overview | `/` | navigation starts inside the recording, so arcs draw on camera | mouse glide to the Ton node, hover 1 s | 3 s |
| alpha | `/alpha`, pre-warmed | 2.5 s settle | mouse drifts across 5 bubbles over 3 s | 0.5 s |
| flows | `/flows`, scrolled to the Flow Index chart | 2 s | mouse sweeps left→right across the chart | 0.5 s |
| token | navigation inside recording | — | wait for rings; click `1M`; wait 1.2 s; click `Line`; wait 0.8 s; click `Candles` | 1 s |
| rug | navigation inside recording | — | none | 2.5 s |
| analyze | token page, settled | 1 s | `Meta+j`; click "Select from page"; click the Token Score card; type the question at 45 ms per character; click send; stream plays | 4 s |
| wallet | navigation inside recording | — | none | 2.5 s |
| checker | `/token` | 2 s | wheel scroll 200 px over 1.5 s | 0.3 s |
| markets | `/predict`, `/perps`, `/sectors` | 2 s each | hover the first chart, 1.5 s each | — |
| phone | `/` phone | 2 s | tap Tokens, 1 s; tap Today, 1 s; scroll 0→1200→0 px over 2 s; tap Ask; wait 1 s; tap first suggestion; stream plays | 3 s |
| proof | navigation inside recording | — | none | 3.5 s |

## Genie Ask and Analyze

`capture.ts` patches `fetch` for `/api/explain` inside the page (an init script) and returns a timed server-sent event stream in the endpoint's own protocol: `tool` events, then the answer in word-sized `delta` events at about 22 words per second. The real panel, busy state, tool chips and streaming render are the product's own. The answer text uses only figures on the same screen (see 01, honesty note). With `LIVE_URL` set (an instance with a Nansen key), nothing is patched and the real agent answers.

## Liquid Glass

Captured on the phone take: the tab lens glides between tabs, and the bar shrinks and becomes translucent over moving content while scrolling. Content must be moving under the bar for the blur and refraction to read, so the scroll passes the colourful signal cards under it.

## Not cutting animations off

Recording starts before navigation for load-animated pages (overview, token, rug, wallet, proof), and every take holds 0.5–4 s after its last action. The edit chooses in-points later.

## Multiple takes

Overview (two takes: the main shot and the climax reprise with a different hover), analyze (the streaming timing must land), phone (tap timing). Each take is re-recorded until frames per second in motion exceed 25.
