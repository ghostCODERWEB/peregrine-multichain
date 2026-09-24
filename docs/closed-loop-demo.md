# TIDE closed loop: 45-second demo script

*"See who moved. Prove why it matters. Remember if you were right."*

This script walks the six chapters (L1–L5a) built after comparing TIDE with another buildathon brief: TIDE already had receipts, divergences and point-in-time rebuilds; the one idea it lacked was committing to a call and being graded on it. This is that loop, recorded end to end.

Record on the recorded demo (`pnpm dev:demo`, or a production build served from `.next-demo`/`.next-prod`), 1440×900, navy theme, so every step is real, replayable data with no live spend. AERO on Base is the token used throughout; every chapter's fixtures and tests already exercise it. Owner-only steps (follow-through, Ask Nansen context) need a private instance instead — see the note after the table.

| Time | Screen | Say / do |
| --- | --- | --- |
| **0:00** | ⌘K → type | Press <kbd>⌘K</kbd>. Type `who bought $aerodrome last 6h`. "One box, slash commands or plain English." The preview shows the price — **1 credit** — before anything runs. Press Enter: a live wallet list appears inline, right there in the palette, with the exact endpoint and cost shown underneath. |
| 0:08 | Token page (AERO, Base) | Press Enter on a result, or `/call aerodrome`, to land on the token. "Three readings, never one score." Point at **Direction**, **Confidence**, **Coordination risk** — each with its own meter and its own ⓘ receipt. Read one falsifier aloud: *"Informed 6h flow turns negative"* — "written from the data, not a template." |
| 0:18 | Same page, scroll to holders | Open the holder constellation. "Insider clusters: wallets sharing a first funder." Click one, then `/related 0x… on base` from the palette to confirm it inline — same evidence, a different door into it. |
| 0:25 | "Make a call" card | Pick **Bull**, horizon **24h**, setup **divergence**, type one line: *"Flow and price disagree; wait for the flow to confirm."* Click **Save the call**. "Saved with Nansen's live price this second, and a receipt for exactly which candle." |
| 0:32 | `/replay aerodrome 24h` | Open the Time Machine on the same token. The historical chart loads, the outcome hidden. "Practice the same decision at T−24h." Pick **PASS**, click **Lock**. Reveal: the price path draws in, the call is graded, saved to the Desk exactly like the live one. |
| 0:40 | `/desk` | "Every call lands here — live and replayed — graded from Nansen candles, never edited afterward." Trader DNA shows hit rate by setup and by source. Point at one graded row's grade receipt: "exit price, exact candle, the rule that decided it." |
| **0:45** | Desk, closing frame | "Made a call, practiced it against history, and it's already scoring me. Built only on the Nansen API." |

## Owner-only steps (skip on the public demo, show on a private instance)

- **Follow-through** (`/token/base/0x9401…?view=flow#follow`): "Did anyone follow smart money?" — reads the instance's own restricted trade tape, so it only runs for the key owner. One click, priced, per-event verdicts.
- **Ask Nansen** (the "Ask Nansen" button beside "Make a call", or `/ask aerodrome`): opens the panel, shows exactly what TIDE will send — each line timestamped and sourced — before any question is asked. A saved answer can be attached to the call just made, as a note, without ever touching the call's grade.

## What each step proves is real

- The palette's `/who-bought` and `/related` answers are live Nansen calls (`tgm/who-bought-sold`, `profiler/address/related-wallets`), 1 credit each, shown in the footer.
- The three gauges and every falsifier are computed in the browser from waves the page already streamed — no extra call, and their formulas are one click away.
- The call's entry price is the same `tgm/token-ohlcv` request the page's own price chart makes.
- The Time Machine's historical candles are recorded live data (`scripts/record-replays.ts`), not synthesized — see `docs/modules/L3.md`.
- Grading reads real candles for the exact call window and never looks past the due time — see `docs/modules/L1.md` and `L3.md` for the boundary fix a live grade exposed.

Full detail, live-verification evidence and exact credit spend for each step: `docs/modules/L1.md` through `L5a.md`. Live API findings from building this loop: `docs/DECISION_LOG.md`.
