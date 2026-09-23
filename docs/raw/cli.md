> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/cli.md).

# Nansen CLI

### Overview

The Nansen CLI (`nansen-cli`) is a command-line interface for the Nansen API. All output is structured JSON, making it ideal for AI agents, scripts, and automation pipelines.

```bash
npm install -g nansen-cli
```

Or run without installing:

```bash
npx nansen-cli help
```

Source code: [github.com/nansen-ai/nansen-cli](https://github.com/nansen-ai/nansen-cli)

### Authentication

The CLI uses the same API key as the REST API. Two options, in priority order:

**Environment variable** (recommended for agents and CI):

```bash
export NANSEN_API_KEY=your-api-key
```

**Interactive login** (persistent):

```bash
nansen login
```

Verify it works:

```bash
nansen schema | head -1
```

`schema` is free and requires no API key -- if you get JSON back, the CLI is installed correctly.

### Quick Start

```bash
# Trending tokens on Solana
nansen token screener --chain solana --timeframe 24h

# Smart Money flows
nansen smart-money netflow --chain solana

# Profile a wallet
nansen profiler balance --address 0x28c6c06298d514db089934071355e5743bf21d60 --chain ethereum

# Search for an entity
nansen profiler search --query "Vitalik Buterin"
```

### Schema Discovery

The CLI is fully self-documenting via `nansen schema`. This requires no API key and returns a machine-readable JSON reference of all commands, options, return fields, and supported chains.

```bash
nansen schema --pretty                    # Full schema
nansen schema smart-money --pretty        # Single command group
```

Example: query supported chains:

```bash
nansen schema | jq '.supportedChains'
```

Agents should use `nansen schema` as the source of truth for available commands and options.

### Output Format

All responses use a consistent JSON envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

Errors include a machine-readable code:

```json
{
  "success": false,
  "error": "Invalid API key",
  "code": "UNAUTHORIZED",
  "status": 401
}
```

Key error codes: `UNAUTHORIZED`, `CREDITS_EXHAUSTED`, `RATE_LIMITED`, `INVALID_ADDRESS`, `UNSUPPORTED_FILTER`. These are the CLI's own codes: it maps the HTTP API's lowercase `code` values onto them, so they differ from the codes listed in [Error Handling](/getting-started/error-handling.md).

### Tips for AI Agents

**Use `schema` for self-discovery.** Agents should call `nansen schema` at the start of a session to learn available commands, options, and supported chains -- it costs zero credits.

**Use `--fields` to reduce response size.** Large JSON responses waste agent context tokens.

```bash
nansen smart-money netflow --chain solana --fields token_symbol,net_flow_usd --limit 10
```

**Use `--stream` for large result sets.** Processes results line-by-line instead of buffering the entire response.

```bash
nansen token dex-trades --chain solana --limit 100 --stream
```

**Budget credits carefully.** Most calls cost 1 credit. `schema` and `help` are free. If you get `CREDITS_EXHAUSTED`, stop all calls immediately.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/cli.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
