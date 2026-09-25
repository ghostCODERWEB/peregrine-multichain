'use client';
import { useEffect, useState } from 'react';

/** Personal MCP access: connect AI assistant, an IDE or an agent to TIDE's signals as this account. */
export function McpAccess() {
  const [info, setInfo] = useState<{ canCreate: boolean; token: { createdAt: number; lastUsedAt: number | null } | null } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // The origin is known only in the browser; set after mount so server and client render the same first.
  const [url, setUrl] = useState('/api/mcp');
  const load = () =>
    fetch('/api/mcp/token')
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setErr('Could not reach Peregrine.'));
  useEffect(() => {
    setUrl(`${window.location.origin}/api/mcp`);
    void load();
  }, []);

  async function create() {
    setErr(null);
    const r = await fetch('/api/mcp/token', { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.error ?? 'Failed.');
      return;
    }
    setFresh(j.token);
    void load();
  }
  async function revoke() {
    await fetch('/api/mcp/token', { method: 'DELETE' });
    setFresh(null);
    void load();
  }
  const cmd = `mcp add --transport http tide ${url}${fresh ? ` --header "Authorization: Bearer ${fresh}"` : ''}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3 text-[13px] text-ink-2">
      <p>
        Peregrine is also an MCP server. Point AI assistant, an IDE or your own agent at it and ask for chain flow, dump-risk scores, alpha, perp
        flow, prediction weather, sectors and (with a token) your private smart-money views.
      </p>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink-muted">Connect</div>
        <pre
          tabIndex={0}
          role="region"
          aria-label="MCP command"
          className="num mt-1 overflow-x-auto rounded-lg bg-page/60 p-2 text-[12px] text-ink"
        >
          {cmd}
        </pre>
        <button onClick={copy} className="mt-1 text-[12px] text-ink-2 hover:text-ink">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {fresh && (
        <p className="rounded-lg border border-border bg-raised/60 p-2 text-ink">
          Your token is in the command above. It is shown once: copy it now. Anyone with it sees what you see here.
        </p>
      )}
      {info?.canCreate ? (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={create} className="rounded bg-brand/15 px-3 py-1 text-ink ring-1 ring-brand/40 hover:bg-brand/25">
            {info.token ? 'Replace my MCP token' : 'Create an MCP token'}
          </button>
          {info.token && (
            <button onClick={revoke} className="text-[12px] text-ink-2 hover:text-ink">
              Revoke
            </button>
          )}
          {info.token && (
            <span className="num text-[11.5px] text-ink-muted">
              created {new Date(info.token.createdAt).toISOString().slice(0, 10)}
              {info.token.lastUsedAt
                ? ` · last used ${new Date(info.token.lastUsedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`
                : ' · not used yet'}
            </span>
          )}
        </div>
      ) : (
        <p className="text-[12.5px] text-ink-muted">
          Without a token, MCP clients see the public view. Sign in with your Nansen key to create one for your private views.
        </p>
      )}
      {err && <p className="text-ink">{err}</p>}
    </div>
  );
}
