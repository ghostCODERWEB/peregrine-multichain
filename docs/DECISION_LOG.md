# Decision log: the closed loop (L1–L5a)

Live API findings and product decisions made building "see who moved → prove why it matters → remember if you were right" (docs/modules/L1.md through L5a.md), 2026-09-24. Findings from the earlier M1–M10/D1 chapters are in `docs/nansen-contract.md`; this log covers only the closed-loop work. Every item below was verified against the real API or by a failing test before the fix, not assumed.

## Live API findings

| Chapter | Endpoint | Finding |
| --- | --- | --- |
| L1 | `tgm/token-ohlcv` | Honors exact ISO `date_range` windows: a `{start, end}` 3-hour window of 5-minute candles returned exactly 36 rows (3h × 12 candles/h), confirming the endpoint doesn't silently round to a wider bucket. This is what grading a call's exact window depends on. |
| L1 | `tgm/token-ohlcv` (5m candles) | `high === low === close` on 5-minute candles; `open` can fall outside that range. Grading uses **closes only**, never a high/low touch, for this reason. |
| L3 | `tgm/token-ohlcv` | A candle's close is only known at `interval_start + timeframe`, never at `interval_start` itself. A pre-existing grading path accepted a 5-minute candle that *started* before a call's deadline but *closed* after it — a look-ahead leak. Live grading of the overdue L1 test call exposed this; fixed to filter by close time, with a regression test. The one call already graded before the fix keeps its original (correct-direction, slightly different) result rather than being silently rewritten. |
| L4 | `tgm/dex-trades` | Also honors exact ISO windows: a 6-hour and a 1-hour window on the same token returned different top buyers, confirming sub-day windows aren't rounded. This is what "10 minutes before vs. after a smart-money buy" depends on. |
| L4 | `tgm/dex-trades` | A single busy token can fill a 100-row page in under 5 minutes. Follow-through cannot assume a full 10-minute window came back — it measures buyers **per covered minute**, not per fixed window, and flags when the tape was cut. |
| L5 | `tgm/who-bought-sold` | Same sub-day-window behavior as above, verified live for the `/who-bought` command: a 6h and a 1h request returned different top buyers. |
| L4 | `smart-money_trades` (TIDE's own scanner table, not a Nansen response) | Redistribution-sensitive by construction: it's restricted smart-money data TIDE itself stored. Follow-through's events come only from this table and are gated to the instance owner for that reason — not a live-API finding, but the reason L4 has no member-key path. |

## Product decisions

- **Three gauges, never one score** (L2). Direction, confidence and coordination risk are shown as three independent meters with three independent receipts. A strong direction on thin evidence, or buying next to linked holders, produces a visible conflict line instead of being averaged away into a single number that would hide the disagreement.
- **Falsifiers are written from the data, not a template** (L2). "What would break this?" pulls the actual flow, liquidation-band and holder-concentration numbers into the sentence, and marks a condition "Already happening" when the data already shows it — rather than a generic, unfalsifiable "monitor closely."
- **Calls are immutable** (L1). No edit, no delete, ever — a track record that can be rewritten after the fact isn't one. Grading writes once, from Nansen candles, using a fixed rule stated on every card (1%/3%/7% bands by horizon).
- **Follow-through never becomes a fixture, and is owner-only** (L4). The events are TIDE's own restricted smart-money data; the before/after tape windows are one-off, priced reads (`record: false`) so they can never leak which minute smart money traded into a public demo fixture. There is deliberately no member-key path yet.
- **Time Machine uses real recorded candles, not synthesized data** (L3). The demo's three replay windows are genuine historical Nansen responses (`scripts/record-replays.ts`), so practicing a decision against history is never practicing against invented prices.
- **Ask Nansen's context is fenced as data, explicitly not instructions** (L5a), and sent only with the first message of a fresh conversation — a follow-up never resends it, so context can't silently accumulate across a long conversation. The context itself is TIDE's own stored, timestamped readings, view-matched to the asker (a member never sees the owner's smart-money line) — never a fresh Nansen call on open, and never another account's data.
- **A research answer can be attached to a call as a note, never as an edit** (L5a). The call's stance, entry, grade and context stay exactly as recorded; a note is a separate, additive row.
- **The palette never spends on typing** (L5). Every command previews for free (Nansen's search, which the palette already used); only Enter on a priced command (`/who-bought`, `/related`) spends the shown 1 credit.

## Bugs found and fixed during this build

- **L1**: the saved-call message printed a raw float (`0.683947043826154`) instead of a readable price. Fixed with a shared 4-significant-figure formatter, used consistently across the call form, the Desk and the receipts.
- **L2**: a falsifier read "Informed 6h flow turns positive" even when that flow was *already* positive against the call's direction — describing a future condition that had already happened. Fixed to say "Already happening: …" and highlight it, with a regression test.
- **L3** (AI assistant): the candle-close-timing leak described above.
- **L5**: the command palette's translucent glass panel, nested inside a blurred overlay, didn't actually blur the page behind it in Chromium — readable on desktop, unreadable on a phone screenshot. Fixed to a solid theme-following surface.
- **L5a**: a Server Component (the wallet page) passed a render-prop *function* as a trigger into the `AskNansen` client component. This type-checks and lints cleanly — a function is a valid `ReactNode`-producing callback by its TypeScript shape — but fails only at request time, because React Server Components cannot serialize a function across the server/client boundary. Every load of the wallet page returned an HTTP 500. Caught by the demo end-to-end run, not by `tsc`; fixed by having the component own and render its own trigger button from string props, and guarded with a dedicated regression test that opens the panel specifically from that Server Component page.

## Credit spend, by chapter (intentional vs. incidental)

| Chapter | Intentional | Incidental | Cause of incidental spend |
| --- | ---: | ---: | --- |
| L1 | 1 | 31 | A live AERO page view on the public instance, used to check the UI, re-recorded 11 public-safe fixtures (an ordinary live public view, not a bug). |
| L2 | 0 | 16 | An in-app browser tab left open on a live page was reloaded by hot-module replacement after an unrelated code edit, re-streaming every wave. |
| L3 | 4 | 127 | Three real replay recordings plus one overdue live grade (intentional, 4); 102 credits from six token-wave refreshes on an open live page during edits, plus 25 from the background scanner over the same window (neither an L3 feature cost). |
| L4 | 6 | 187 | An opt-in owner browser-test instance was accidentally started with the real API key (inherited from `.env.local`) instead of keyless; opening the AERO page live-streamed every wave repeatedly across retries and devices. |
| L5 | 4 | 0 | Two live window probes plus two live command runs; no incidental spend. |
| L5a | 0 | 0 | Opening the panel makes no Nansen call; the live 750-credit question itself has not been run. |

**Lessons carried forward**:
1. Never leave the in-app browser open on a live token/chain page while editing code that page depends on — a hot reload re-streams every wave.
2. Any private (owner-mode) browser-test instance must be started explicitly keyless (`NANSEN_API_KEY=`), because `next start` otherwise inherits the real key from `.env.local`.

## Endpoints this closed loop actually calls live

Beyond what earlier chapters (M1–M10, D1) already put TIDE's ledger at 93/103 (see `docs/modules/D1c.md` and `/coverage`), the closed loop's own live traffic is:

- `tgm/token-ohlcv` — a call's entry price and its grading window (L1); the Time Machine's historical and outcome candles (L3); follow-through's 24-hour outcome (L4). Already counted in the ledger from M2/M9.
- `tgm/dex-trades` — follow-through's before/after tape windows (L4). Already counted from M2.
- `tgm/who-bought-sold` — the `/who-bought` and `/who-sold` commands (L5). Already counted from M6.
- `profiler/address/related-wallets` — the `/related` command (L5). Already counted from M4/D1a.
- `agent/expert` — Ask Nansen's question-asking path (L5a), reusing M7's integration exactly; no new endpoint, and no live call made yet in this chapter (see `docs/modules/L5a.md` → Not done).

No new Nansen endpoint was added to the surface area by L1–L5a; the loop is built entirely from endpoints TIDE already had access to, composed into a new product shape.
