> For the complete documentation index, see [llms.txt](https://docs.nansen.ai/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.nansen.ai/mcp/connecting.md).

# Connecting to Nansen MCP

The Nansen MCP server provides AI assistants with access to comprehensive blockchain analytics through a secure API. This guide covers how to connect to Nansen MCP.

{% hint style="info" %}
**AI assistant and Grok use OAuth with your Nansen account.** Install the [Nansen plugin for AI assistant](/mcp/AI assistant.md) from the AI assistant directory, or follow [Grok (OAuth)](/mcp/grok.md) using `https://mcp.nansen.ai/ra/connector-curated/mcp`. These connections do not require an API key or npx. The prerequisites below apply to API-key clients.
{% endhint %}

### Prerequisites

Before connecting, you'll need:

1. **Nansen API Key**: Get yours at <https://app.nansen.ai/auth/agent-setup>
2. **npx**: Only needed for the "Other MCP Clients" section below, which bridges through `mcp-remote`. It ships with Node.js — no separate install. AI assistant Desktop, your AI assistant, and Cursor connect directly and do not need it, though the Nansen CLI recommended for Cursor is itself installed with `npm`.

### Installation Guide

#### 1. AI assistant Desktop (One-Click Install; AI assistant Desktop Required)

The easiest way to get started with Nansen MCP. Double-click the downloaded .dxt file to configure automatically.

[**Quick Install Link**](https://github.com/nansen-ai/nansen-mcp-dxt/raw/refs/heads/main/nansen.dxt)

The bundle is versioned independently of this page, so its embedded connection settings may lag the values documented below. Prefer the bundle for a working install; use this page as the reference for the current endpoint and header.

#### 2. your AI assistant (Terminal Integration)

Connect Nansen MCP through your terminal:

{% code overflow="wrap" %}

```bash
mcp add --transport http nansen https://mcp.nansen.ai/ra/mcp --header "NANSEN-API-KEY: YOUR_API_KEY_HERE"
```

{% endcode %}

#### 3. Cursor IDE

The recommended setup is the Nansen CLI. It merges the `nansen` server into Cursor's existing configuration without removing other servers:

```bash
npm install -g nansen-cli@latest
nansen login --human
nansen mcp install cursor
```

`nansen login --human` prompts for your API key so it never enters shell history, and checks the key against the API before saving it. If `NANSEN_API_KEY` is already exported in your shell, skip the login step — the install command reads the key from the environment. Re-run the install after rotating your key.

The command writes `~/.cursor/mcp.json` (on Windows, `%USERPROFILE%\.cursor\mcp.json`), keeps a copy of any existing file at `mcp.json.bak`, and leaves the result with `0600` permissions on macOS/Linux whether or not the file already existed. The backup holds the previous contents, including any earlier key, so delete it once you have confirmed the change.

If you cannot use the CLI, create the file manually with the same configuration the command generates, replacing `YOUR_API_KEY_HERE` before saving:

```json
{
  "mcpServers": {
    "nansen": {
      "url": "https://mcp.nansen.ai/ra/mcp",
      "headers": {
        "NANSEN-API-KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

If `mcp.json` already exists, add only the `nansen` entry under its existing `mcpServers` object. On macOS/Linux, run `chmod 600 ~/.cursor/mcp.json` because the file contains an API key.

Whichever way you created the file, re-check its mode after editing servers through the Cursor UI, since a rewrite can reset it. Restart Cursor (or toggle the server in Cursor Settings > MCP) to pick up the change, then follow [Verifying your connection](#verifying-your-connection) below.

If your Cursor build does not support the `url` field, use the `mcp-remote` bridge from the "Other MCP Clients" section instead.

Cursor install deep links (`cursor://anysphere.cursor-deeplink/mcp/install?...`) are no longer published. Cursor saves the link's decoded configuration as-is, so the link could only ever ship a placeholder key that you still had to find and replace inside an opaque payload — and a link carrying a real key would put that key in your clipboard history, chat logs, and link previews. The CLI installer and the explicit configuration above replace it.

#### 4. Other MCP Clients

Integration example for various other tools supporting MCPs

**Server configuration:**

* Server: `https://mcp.nansen.ai/ra/mcp`
* HTTP header: `NANSEN-API-KEY: YOUR_API_KEY_HERE`
* Transport: `mcp-remote`

Clients that speak streamable HTTP natively should use the `url` + `headers` form shown in the Cursor section above. Only stdio-only clients need the `mcp-remote` bridge below.

```json
{
  "mcpServers": {
    "nansen": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@0.2.1",
        "https://mcp.nansen.ai/ra/mcp",
        "--header",
        "NANSEN-API-KEY:${NANSEN_API_KEY}"
      ],
      "env": {
        "NANSEN_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

`mcp-remote` substitutes `${NANSEN_API_KEY}` in the header from the environment, so the key lives in `env` rather than in the argument list — prefer that form, since arguments are visible in process listings. If the variable is unset the header is sent empty and every tool call fails, so keep the `env` entry.

`--header` and its value must be two separate entries in `args`. Whitespace after the colon is trimmed, so `NANSEN-API-KEY: ${NANSEN_API_KEY}` works too, but the value must contain both the header name and the key.

`mcp-remote` is pinned to an exact version rather than `@latest` because the bridge handles your API key on every request, and `npx` would otherwise pull a new release automatically the first time you run it. `0.2.1` is the current release at the time of writing and the version these instructions are tested against. Bumping it is safe and encouraged — check the latest version, review what changed, and update this pin.

**NPX example:**

```bash
export NANSEN_API_KEY=YOUR_API_KEY_HERE
npx -y mcp-remote@0.2.1 https://mcp.nansen.ai/ra/mcp \
  --header 'NANSEN-API-KEY:${NANSEN_API_KEY}'
```

### Verifying your connection

Your client showing Nansen tools in its list does **not** mean authentication works: the server answers `initialize` and `tools/list` without any API key at all. Only a tool call is authenticated, so verify with one.

**In your client:** ask it for token information for a well-known token — for example, "use Nansen to get token info for USDT on ethereum". Real figures mean the key works. An error mentioning `Invalid API key` or `NANSEN-API-KEY header is required` means the key never reached the server; re-check the header name and value in your configuration, then restart the client.

**From a terminal**, to test the key independently of any client, run `nansen mcp verify` if you installed the Nansen CLI — it makes the same authenticated tool call below with your saved key — or call the server directly:

{% code overflow="wrap" %}

```bash
curl -s -X POST https://mcp.nansen.ai/ra/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "NANSEN-API-KEY: YOUR_API_KEY_HERE" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"token_info","arguments":{"request":{"chain":"ethereum","token_address":"0xdAC17F958D2ee523a2206206994597C13D831ec7"}}}}'
```

{% endcode %}

Read the response body, not the HTTP status — an invalid key still returns `200`, with the failure reported as `"isError": true` inside the result. This call consumes credits, like any other tool call.

The `Accept` header above is required when calling the server directly with `curl`. MCP clients set it for you.

### Authentication

⚠️ Nansen MCP uses the same API as your regular API keys. Ensure you have sufficient credits for your usage.


---

# Agent Instructions
This documentation is published with GitBook. GitBook is the documentation platform designed so that both humans and AI agents can read, navigate, and reason over technical content effectively. Learn more at gitbook.com.

## Querying This Documentation
If you need additional information that is not directly available in this page, you can query the documentation dynamically by asking a question.

Perform an HTTP GET request on the current page URL with the `ask` query parameter, and the optional `goal` query parameter:

```
GET https://docs.nansen.ai/mcp/connecting.md?ask=<question>&goal=<endgoal>
```

`ask` is the immediate question: it should be specific, self-contained, and written in natural language.
`goal` is optional and describes the broader end goal you are ultimately trying to accomplish on behalf of the user. GitBook uses it to tailor the answer towards what is most useful for that goal.

The response will contain a direct answer to the question and relevant excerpts and sources from the documentation.

Use this mechanism when the answer is not explicitly present in the current page, you need clarification or additional context, or you want to retrieve related documentation sections.
