> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api/changelog/24-08-2026-perp-leaderboard-roi-corrections.md).

# 24-08-2026: Perp Leaderboard ROI Corrections

**Affected endpoints:** `perp-leaderboard`

Two defects in the `roi` calculation were corrected together. Both change the values returned by the `roi` field and the behaviour of the `roi` range filter. They shipped in a single release so `roi` moves once.

ROI is computed as:

```
roi = total PnL / (traded notional + notional of positions still open)
```

One defect was in each term of that denominator.

## 1. Traded notional was measured in coin units, not USD

The traded-volume term summed position **sizes** rather than **price x size**, so the denominator mixed coin units with the USD open-position term. The result was neither a ratio nor a percentage, and its magnitude scaled with the inverse of the coin's price.

Two traders with an identical 10% return were reported as:

| Trader | Position                                          | True return | Previous `roi` |
| ------ | ------------------------------------------------- | ----------- | -------------- |
| A      | 1 BTC, $100,000 notional, $10,000 profit          | 0.10        | **10000**      |
| B      | 1,000,000 DOGE, $100,000 notional, $10,000 profit | 0.10        | **0.01**       |

This affected every row. Before the fix, 27% of traders showed a return above 100%, and ordering by `roi` effectively ranked traders by profit per coin traded rather than by return.

## 2. Open exposure netted longs against shorts

The open-position term summed each position's **signed** notional and then took the absolute value, so a long and a short in two unrelated coins cancelled. A book long $3.6M gold and short $3.6M S\&P 500 was recorded as $25,681 of open exposure rather than $7.2M. It now sums each position's absolute notional.

This affected traders holding more than one position — about one in eight of them, by a median factor of 2.4x. Its effect on `roi` is much smaller than defect 1, because the traded-notional term dominates the denominator for anyone trading actively.

## What this means for `roi`

* `roi` is a **fractional ratio**: `0.15` means 15%, `-0.20` means -20%. It is signed, so a loss is negative.
* It measures PnL per dollar **traded**, not return on capital. A position that was opened and closed contributes **both** fills to the denominator, so a round trip roughly doubles it.
* The denominator also includes the notional of positions still open, so a trader with a small amount of trading and a large open book has a much larger denominator than their traded volume alone suggests.
* The `roi` range filter uses the same unit. `{"min": 0.1}` selects traders returning 10% or better.
* Ordering by `roi` now ranks traders by return.

**Action required:** if your integration filters or thresholds on `roi`, convert your bounds to fractions. A filter of `{"min": 10}` intended as "10% or better" becomes `{"min": 0.1}`. If you display `roi` as a percentage, multiply by 100.

## Relationship to `tgm/historical-perp-leaderboard`

Values from the timestamp-certified `tgm/historical-perp-leaderboard` endpoint are unchanged: it already returned a fractional ratio and already summed absolute per-position notionals. After these corrections both endpoints use the **same unit and the same denominator definition**.

They can still return different numbers for the same trader. This endpoint values open positions at the current mark while the timestamp-certified route is as-of throughout, so a historical date range on this endpoint mixes the current open book into a past window.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api/changelog/24-08-2026-perp-leaderboard-roi-corrections.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
