> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/api-migration.md).

# API Migration

When part of the API is scheduled for removal or replacement, we announce it ahead of time and signal it on the wire so your integration never breaks without warning. This page explains each deprecation signal, lists everything that is currently deprecated, and shows how to migrate.

New deprecations and removals are announced in the [API Changelog](/api/changelog.md). Deprecated fields remain accepted during their migration window. For deprecated endpoints, any scheduled sunset is at least 90 days after deprecation begins.

### Deprecated endpoints: `Deprecation`, `Sunset` and `Link` headers

Responses from a deprecated endpoint carry a `Deprecation` header and may include other standard lifecycle headers:

```http
Deprecation: @1768435200
Sunset: Tue, 30 Jun 2026 00:00:00 GMT
Link: <https://docs.nansen.ai/api-migration>; rel="deprecation"
```

| Header                     | Meaning                                          | Format                                                                                |
| -------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `Deprecation`              | The endpoint is deprecated, and since when       | `@` followed by a Unix timestamp ([RFC 9745](https://www.rfc-editor.org/rfc/rfc9745)) |
| `Sunset`                   | The date after which the endpoint may be removed | HTTP date ([RFC 8594](https://www.rfc-editor.org/rfc/rfc8594))                        |
| `Link … rel="deprecation"` | Where the deprecation is documented              | URL in angle brackets ([RFC 8288](https://www.rfc-editor.org/rfc/rfc8288))            |

`Sunset` only appears once a removal date has been decided, and `Link` only appears when migration documentation is configured. An endpoint can be deprecated without either one. All three headers are readable from browser-based clients.

{% hint style="info" %}
No endpoint is deprecated right now — no live endpoint currently returns these headers. They are documented here so you can build detection before you ever need it.
{% endhint %}

### Deprecated request fields: the `Warning` header

Some endpoints have individual request fields that were replaced by better alternatives. The old field keeps working, but if your request includes one, the response carries a `Warning: 299` header telling you what to use instead:

```http
Warning: 299 - "The 'date_range' parameter is deprecated. Use 'date' instead."
```

The warning only appears when your request actually sends the deprecated field — requests that omit it are unaffected. If a request uses several deprecated fields, the warnings are comma-separated in a single header:

```http
Warning: 299 - "The 'date' parameter is deprecated. Use 'timeframe' instead.", 299 - "The 'filters.only_smart_money' parameter is deprecated. Use 'trader_type' instead."
```

Deprecated fields are also marked `deprecated: true` in the OpenAPI specification, so generated clients and API tooling flag them at build time.

### Currently deprecated request fields

| Endpoint                                         | Deprecated field           | Use instead           |
| ------------------------------------------------ | -------------------------- | --------------------- |
| `POST /api/v1/token-screener`                    | `date`                     | `timeframe`           |
| `POST /api/v1/token-screener`                    | `filters.only_smart_money` | `filters.trader_type` |
| `POST /api/v1/perp-screener`                     | `filters.only_smart_money` | `filters.trader_type` |
| `POST /api/v1/tgm/token-ohlcv`                   | `date_range`               | `date`                |
| `POST /api/v1/prediction-market/market-screener` | `sort_by`                  | `order_by`            |
| `POST /api/v1/prediction-market/event-screener`  | `sort_by`                  | `order_by`            |
| `POST /api/v1/prediction-market/ohlcv`           | `sort`                     | `order_by`            |
| `POST /api/v1/prediction-market/top-holders`     | `sort`                     | `order_by`            |
| `POST /api/v1beta1/token-screener/historical`    | `only_smart_money`         | `trader_type`         |

#### `only_smart_money` → `trader_type`

Map `only_smart_money: true` to `trader_type: "sm"`; when it is `false`, omit `trader_type` to keep the default behavior. `trader_type` also supports endpoint-specific cohorts such as `whale`, `public_figure`, `trending`, and `high_winrate_hl_perps_trader` — check the endpoint schema for its accepted values. When both fields are sent, `trader_type` wins.

**Before:**

```json
{ "filters": { "only_smart_money": true } }
```

**After:**

```json
{ "filters": { "trader_type": "sm" } }
```

#### `date` → `timeframe` (Token Screener)

Use a named window (`5m`, `10m`, `1h`, `6h`, `24h`, `7d`, `30d`) instead of an explicit date range. The two fields cannot be combined in one request.

**Before:**

```json
{ "chains": ["ethereum"], "date": { "from": "2025-01-01T00:00:00Z", "to": "2025-01-02T00:00:00Z" } }
```

**After:**

```json
{ "chains": ["ethereum"], "timeframe": "24h" }
```

#### `date_range` → `date` (Token OHLCV)

The replacement uses `from`/`to` keys instead of `start`/`end`. Sending both fields is rejected with a validation error.

**Before:**

```json
{ "date_range": { "start": "2025-01-01", "end": "2025-01-31" } }
```

**After:**

```json
{ "date": { "from": "2025-01-01", "to": "2025-01-31" } }
```

#### `sort` / `sort_by` → `order_by` (Prediction Markets)

`order_by` takes a list of sort criteria, each with a field and a direction. For the OHLCV and Top Holders endpoints, `sort` already had this shape — only the name changes.

**Before:**

```json
{ "sort_by": "volume_24hr" }
```

**After:**

```json
{ "order_by": [{ "field": "volume_24hr", "direction": "DESC" }] }
```

### Recommended migration process

1. **Watch the** [**API Changelog**](/api/changelog.md) — new deprecations and removals are announced there.
2. **Log deprecation signals in your client.** Check responses for `Warning`, `Deprecation` and `Sunset` headers and surface them in your logs or monitoring. This turns a future removal into a routine ticket instead of an outage.
3. **Migrate to the replacement** shown in the `Warning` message or the table above.
4. **Confirm the signal is gone.** Once your requests no longer use a deprecated field, the `Warning` header disappears.

{% hint style="info" %}
Treat the set of deprecation messages as open-ended: parse the header's presence, not its exact wording. After an endpoint passes its sunset date and is removed, calls to it return `404` with the `not_found` error code — see [Error Handling](/getting-started/error-handling.md).
{% endhint %}


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/api-migration.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
