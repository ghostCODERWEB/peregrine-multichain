> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/guides/quant-signals/btc-drop-reflexivity.md).

# BTC Drop Reflexivity

Measure how a token behaves when Bitcoin drops—a risk signal for market drawdowns.

### What is BTC Drop Reflexivity?

BTC Drop Reflexivity measures how much a token typically falls (or rises) relative to Bitcoin during significant BTC price drops. It answers the question: *"When Bitcoin drops 5%, does this token drop 5%, 15%, or does it actually hold steady?"*

This metric helps you:

* **Assess downside risk**: Understand how exposed a token is to broad market selloffs
* **Compare relative stability**: Find tokens that show strength during BTC drawdowns
* **Inform position sizing**: Higher reflexivity = higher risk during market corrections

***

### Use Cases

1. **Portfolio risk management**: Screen out high-reflexivity tokens when reducing risk exposure
2. **Flight to quality**: During uncertain markets, identify tokens with lower reflexivity scores
3. **Position sizing**: Allocate smaller positions to high-reflexivity assets
4. **Relative value**: Compare reflexivity across similar tokens (e.g., competing L1s or DeFi protocols)

***

### How It Works

#### Calculation

1. We identify days when **Bitcoin drops more than 3%** within a 24-hour period
2. For each drop event, we calculate the **reflexivity ratio**:

   ```
   Reflexivity Ratio = Token % Change / BTC % Change
   ```

   *Example: If BTC drops -5% and a token drops -15%, the ratio is -15% / -5% = 3.0*
3. We compute a **rolling median** across the last 4-5 qualifying BTC drop events to smooth out noise

#### What the Ratio Means

| Ratio      | Interpretation                                                |
| ---------- | ------------------------------------------------------------- |
| **< 0**    | Token *gains* when BTC drops (very rare, inverse correlation) |
| **0 to 1** | Token drops *less* than BTC (more stable)                     |
| **= 1**    | Token drops the *same* as BTC                                 |
| **> 1**    | Token drops *more* than BTC (amplified volatility)            |

***

### API Response Fields

The `btc_drop_reflexivity` object is included in the Token Information endpoint response:

| Field               | Type    | Description                                                                   |
| ------------------- | ------- | ----------------------------------------------------------------------------- |
| `signal`            | number  | **Primary metric.** Rolling 5-drop median reflexivity ratio. Lower is better. |
| `avg_signal`        | number  | TBD                                                                           |
| `volatility`        | number  | TBD                                                                           |
| `signal_percentile` | number  | TBD                                                                           |
| `score`             | string  | Risk classification: `"low"`, `"medium"`, or `"high"`                         |
| `drops_in_window`   | integer | Number of BTC drop events used in the calculation (4-5 required)              |
| `is_stablecoin`     | boolean | Whether the token is classified as a stablecoin                               |

**Note:** Returns `null` if there are fewer than 4 qualifying BTC drop events in the last 365 days.

***

### Interpreting the Results

#### Example Response

```json
{
  "btc_drop_reflexivity": {
    "drops_in_window": 5,
    "signal": 1.42,
    "avg_signal": 1.58,
    "volatility": 0.31,
    "signal_percentile": 62.5,
    "score": "medium",
    "is_stablecoin": false
  }
}
```

**Interpretation:** This token typically drops \~1.4x more than Bitcoin during drawdowns (e.g., if BTC drops 5%, expect this token to drop \~7%). The medium score indicates moderate risk. The volatility of 0.31 suggests reasonably consistent behavior. At the 62.5th percentile, it's slightly more volatile than the median token in its market cap tier.

***

### Key Considerations

* **New tokens:** Reflexivity data requires sufficient BTC drop events. Tokens deployed recently may return `null`.
* **Stablecoins:** Will show values near 0 and are flagged via `is_stablecoin: true`.
* **Upside correlation:** Tokens with high downside reflexivity often also amplify gains during upswings. High reflexivity doesn't mean "bad", it means higher risk *and* potentially higher reward.
* **Slow-changing signal:** This is a general risk characteristic, not a real-time alert. It updates only when new BTC drop events occur.

***


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/guides/quant-signals/btc-drop-reflexivity.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
