# Scorecard — 2026-09-25 19:39 UTC

Each metric is the share of its checks that pass (scripts/scorecard.ts, run on the keyless demo).

| Metric | Score |
| --- | --- |
| Code quality | **60** |
| Nansen data | **100** |
| UI/UX | **60** |

## Code quality

- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 problems
- ✅ Unit tests all pass — Tests  535 passed | 1 skipped
- ❌ Line coverage of src/lib + src/server ≥ 80% — 50.1%
- ❌ No code lines over 220 characters (excluding prose strings) — 132: src/app/api/alerts/route.ts:59, src/app/api/desk/route.ts:58, src/app/api/lab/rule/route.ts:10, src/app/api/public/storm/route.ts:19, src/app/api/rug/[chain]/[address]/route.ts:35, src/app/api/trade/route.ts:16

## Nansen data

- ✅ Every API operation used, or skipped with a written reason (0 planned, 0 unaccounted) — 93 used + 10 skipped with reasons of 103
- ✅ At least 90% of API operations in use — 90.3%
- ✅ Every used operation has a redistribution class
- ✅ Only Nansen data hosts in src/
- ✅ Redaction, label guard, public-site and budget tests pass — Tests  33 passed (33)

## UI/UX

- ❌ No legacy (pre-redesign) panel or heading styles — 19: src/app/trade/page.tsx:26, src/app/smart-money/page.tsx:23, src/app/smart-money/page.tsx:30, src/app/lab/page.tsx:173, src/app/agent/page.tsx:31
- ✅ First-load JS ≤ 250 kB on every route — all within budget
- ✅ No sideways scroll on 20 routes × 3 views — 60 pages
- ✅ No page or console errors — 60 pages
- ❌ No serious or critical WCAG 2.1 AA violations (axe) — 36: /perps (desktop dark): color-contrast×29, scrollable-region-focusable×1; /predict (desktop dark): color-contrast×21, scrollable-region-focusable×1; /wallet/0xcbb811f129782ef87e19dea9d3375045219bae00 (desktop dark): scrollable-region-focusable×1; /coverage (desktop dark): scrollable-region-focusable×1; /perps (phone dark): color-contrast×30, scrollable-region-focusable×2; /predict (phone dark): color-contrast×21, scrollable-region-focusable×1; /wallet/0xcbb811f129782ef87e19dea9d3375045219bae00 (phone dark): scrollable-region-focusable×1; /lab (phone dark): scrollable-region-focusable×1; /coverage (phone dark): scrollable-region-focusable×2; / (desktop light): color-contrast×4

