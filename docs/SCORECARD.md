# Scorecard — 2026-09-25 22:42 UTC

Each metric is the share of its checks that pass (scripts/scorecard.ts, run on the keyless demo).

| Metric | Score |
| --- | --- |
| Code quality | **100** |
| Nansen data | **100** |
| Novelty | **100** |
| UI/UX | **80** |

## Code quality

- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 problems
- ✅ Unit tests all pass — Tests  597 passed | 1 skipped
- ✅ Line coverage of src/lib + src/server ≥ 80% — 80.5%
- ✅ No code lines over 220 characters (excluding prose strings) — 0

## Nansen data

- ✅ Every API operation used, or skipped with a written reason (0 planned, 0 unaccounted) — 93 used + 10 skipped with reasons of 103
- ✅ At least 90% of API operations in use — 90.3%
- ✅ Every used operation has a redistribution class
- ✅ Only Nansen data hosts in src/
- ✅ Redaction, label guard, public-site and budget tests pass — Tests  33 passed (33)

## Novelty

- ✅ Cross-chain capital map (wallet rotations for the owner; measured net flow with modeled arcs in public) — nav: Capital Flows · e2e/flows.spec.ts
- ✅ Rug Checker: six measured checks and a model verdict on 25 networks — nav: Rug Checker · e2e/rug.spec.ts
- ✅ Calls graded against real candles, with Trader DNA — nav: Desk · e2e/desk.spec.ts
- ✅ Time Machine: lock a call on past data, then reveal — token page → Make a call · e2e/replay.spec.ts
- ✅ Dump Risk model with a published out-of-sample backtest — nav: Backtest Lab · src/lib/models/storm-score.test.ts
- ✅ Ask Nansen on any token, with a public label guard — every token page · src/server/agents/quick.test.ts
- ✅ Public site on one key: no wallet, same-origin API, daily budget — TIDE_PUBLIC_SITE=1 · src/middleware.test.ts

## UI/UX

- ✅ No legacy (pre-redesign) panel or heading styles — 0
- ✅ First-load JS ≤ 250 kB on every route — all within budget
- ✅ No sideways scroll on 20 routes × 3 views — 60 pages
- ✅ No page or console errors — 60 pages
- ❌ No serious or critical WCAG 2.1 AA violations (axe) — 8: /wallet/0xcbb811f129782ef87e19dea9d3375045219bae00 (desktop dark): scrollable-region-focusable×1; /wallet/0xcbb811f129782ef87e19dea9d3375045219bae00 (phone dark): scrollable-region-focusable×1; /rug/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631 (desktop light): color-contrast×2; /wallet/0xcbb811f129782ef87e19dea9d3375045219bae00 (desktop light): link-in-text-block×1, scrollable-region-focusable×1; /trade (desktop light): link-in-text-block×1; /alerts (desktop light): link-in-text-block×1; /agent (desktop light): link-in-text-block×1

