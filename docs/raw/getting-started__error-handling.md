> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/getting-started/error-handling.md).

# Error Handling

API responses are delivered in JSON format. The client applications must parse this JSON to extract the required data. Equally important is handling the HTTP status code returned with each response to determine success or failure.

**Common HTTP Status Codes:**

<table data-header-hidden><thead><tr><th width="112.921875" valign="top">Status Code</th><th valign="top">Meaning</th><th valign="top">What to Do</th></tr></thead><tbody><tr><td valign="top">400</td><td valign="top">Bad Request: Malformed request, invalid parameters or format</td><td valign="top">Check your request syntax and parameters</td></tr><tr><td valign="top">401</td><td valign="top">Unauthorized: Authentication failed (missing, invalid, or expired token)</td><td valign="top">Obtain or refresh your API Key</td></tr><tr><td valign="top">402</td><td valign="top">x402: Payment Required</td><td valign="top">Please make the payment for API request and try again</td></tr><tr><td valign="top">403</td><td valign="top">Forbidden: Auth succeeded, but no permission for resource</td><td valign="top">Ensure your account has access rights</td></tr><tr><td valign="top">404</td><td valign="top">Not Found: Resource or endpoint does not exist</td><td valign="top">Verify the endpoint path and resource identifiers</td></tr><tr><td valign="top">422</td><td valign="top">Unprocessable Content</td><td valign="top">Please verify your parameters</td></tr><tr><td valign="top">429</td><td valign="top">Too Many Requests: Rate limit exceeded</td><td valign="top">Slow down requests; respect rate limits</td></tr><tr><td valign="top">500</td><td valign="top">Internal Server Error: Unexpected server issue</td><td valign="top">Try again later; contact support if persistent</td></tr><tr><td valign="top">504</td><td valign="top">Gateway Timeout: Backend server did not respond in time</td><td valign="top">Retry after a short wait; check for heavy queries</td></tr></tbody></table>

## Error Codes

Except for HTTP 402 payment challenges, error responses carry a structured JSON body with a stable, machine-readable `code` field:

```json
{
  "error": "Missing field",
  "message": "Required field 'body -> chain' is missing. Must be a valid chain name, e.g., 'ethereum', 'solana', 'bnb'",
  "code": "missing_field",
  "status": 422,
  "request_id": "req-6b1f6f3f2b724e4bb8b2f6d0a9e4c1aa",
  "doc_url": "https://docs.nansen.ai/getting-started/error-handling#missing_field",
  "param": "chain"
}
```

* `code` — a stable identifier for the error; safe to branch on in client code.
* `status` — the HTTP status code, repeated in the body.
* `request_id` — include this when contacting support.
* `doc_url` — links back to this page, anchored to the specific code.
* `param` — only present when the error relates to a specific request field.
* `retry_after` — only present when the request can be retried after a delay, in seconds. The same value is sent in the `Retry-After` response header.

**All error codes:**

<table><thead><tr><th valign="top">Code</th><th valign="top">Meaning</th><th valign="top">Typical cause</th><th valign="top">Retryable</th></tr></thead><tbody><tr><td valign="top"><code>missing_field</code></td><td valign="top">A required field is missing from the request</td><td valign="top">A required body field (e.g. <code>chain</code>, <code>date</code>) was not provided</td><td valign="top">No — add the field</td></tr><tr><td valign="top"><code>unknown_field</code></td><td valign="top">The request contains a field the endpoint does not recognize</td><td valign="top">A typo, a camelCase name (the API uses snake_case), or <code>page</code>/<code>per_page</code> outside the <code>pagination</code> object</td><td valign="top">No — fix the field name</td></tr><tr><td valign="top"><code>invalid_field_value</code></td><td valign="top">A field value is invalid for this endpoint</td><td valign="top">Wrong type, or a value outside the allowed options (e.g. an unsupported chain name)</td><td valign="top">No — fix the value</td></tr><tr><td valign="top"><code>invalid_address_format</code></td><td valign="top">A wallet or token address is not valid for the specified chain</td><td valign="top">Missing <code>0x</code> prefix, wrong length, non-hex characters, or an address from a different chain</td><td valign="top">No — fix the address</td></tr><tr><td valign="top"><code>invalid_date_format</code></td><td valign="top">A date is not in the expected format</td><td valign="top">Dates must be <code>{"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}</code></td><td valign="top">No — fix the date format</td></tr><tr><td valign="top"><code>invalid_date_range</code></td><td valign="top">The requested date range is not allowed</td><td valign="top">Range longer than one year, or beyond the per-address limit for high-volume addresses</td><td valign="top">No — narrow the range</td></tr><tr><td valign="top"><code>mutually_exclusive_fields</code></td><td valign="top">Two fields that cannot be combined were both provided</td><td valign="top">Sending both of a pair of alternative parameters in the same request</td><td valign="top">No — remove one of the fields</td></tr><tr><td valign="top"><code>value_out_of_range</code></td><td valign="top">A value is outside the allowed bounds</td><td valign="top">A number above or below the documented limit, or a string that is too short or too long</td><td valign="top">No — adjust the value</td></tr><tr><td valign="top"><code>too_many_items</code></td><td valign="top">A list contains more items than allowed</td><td valign="top">More entries than the field's maximum length</td><td valign="top">No — split into smaller batches</td></tr><tr><td valign="top"><code>unauthenticated</code></td><td valign="top">Authentication failed</td><td valign="top">Missing, invalid, or expired API key</td><td valign="top">No — obtain or refresh your API key</td></tr><tr><td valign="top"><code>forbidden</code></td><td valign="top">Authenticated, but no permission for this resource</td><td valign="top">Your account lacks access rights for the endpoint or data</td><td valign="top">No — check your account's access</td></tr><tr><td valign="top"><code>geo_blocked</code></td><td valign="top">Access is blocked in your region</td><td valign="top">Request originates from a restricted jurisdiction</td><td valign="top">No</td></tr><tr><td valign="top"><code>plan_upgrade_required</code></td><td valign="top">The feature requires a higher subscription plan</td><td valign="top">Using a paid feature (e.g. <code>premium_labels=true</code>) on a Free plan</td><td valign="top">No — upgrade your plan</td></tr><tr><td valign="top"><code>insufficient_credits</code></td><td valign="top">Not enough API credits remain to call this endpoint</td><td valign="top">Credit balance is below the endpoint's credit cost</td><td valign="top">No — add credits or upgrade your plan</td></tr><tr><td valign="top"><code>rate_limit_exceeded</code></td><td valign="top">Too many requests</td><td valign="top">Request rate above your plan's rate limit</td><td valign="top">Yes — wait <code>Retry-After</code> seconds, then retry</td></tr><tr><td valign="top"><code>not_found</code></td><td valign="top">The endpoint or resource does not exist, or is no longer available</td><td valign="top">Wrong endpoint path or resource identifier</td><td valign="top">No — verify the path</td></tr><tr><td valign="top"><code>method_not_allowed</code></td><td valign="top">The HTTP method is not allowed for this endpoint</td><td valign="top">Using <code>GET</code> on a <code>POST</code>-only endpoint</td><td valign="top">No — use the documented method</td></tr><tr><td valign="top"><code>conflict</code></td><td valign="top">The request conflicts with the current state</td><td valign="top">A duplicate or contradictory operation</td><td valign="top">No — check your data</td></tr><tr><td valign="top"><code>payload_too_large</code></td><td valign="top">The request body is too large</td><td valign="top">Payload exceeds the size limit</td><td valign="top">No — reduce the payload</td></tr><tr><td valign="top"><code>query_timeout</code></td><td valign="top">The query took too long to complete</td><td valign="top">A very wide date range or an expensive, unfiltered query</td><td valign="top">Yes — retry with backoff; wait <code>Retry-After</code> seconds when present; consider narrowing the query</td></tr><tr><td valign="top"><code>query_too_large</code></td><td valign="top">The query exceeds system limits</td><td valign="top">The time range or parameter set would produce too much data</td><td valign="top">No — reduce the time range or add filters</td></tr><tr><td valign="top"><code>upstream_unavailable</code></td><td valign="top">An upstream service is temporarily unavailable</td><td valign="top">Maintenance or overload of a backend service</td><td valign="top">Yes — retry with backoff; wait <code>Retry-After</code> seconds when present</td></tr><tr><td valign="top"><code>internal_error</code></td><td valign="top">Unexpected server-side error</td><td valign="top">A fault on our side, not your request</td><td valign="top">Yes — retry with backoff; contact support with your <code>request_id</code> if it persists</td></tr></tbody></table>

{% hint style="info" %}
The set of error codes may expand over time. Clients must tolerate unknown codes: when you receive a `code` you don't recognize, fall back to handling the response by its HTTP status.
{% endhint %}

<br>


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/getting-started/error-handling.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
