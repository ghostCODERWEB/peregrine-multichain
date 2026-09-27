'use client';
import { useState } from 'react';
import { friendlyError } from '@/lib/friendly-error';

/** Look up any cross-chain route's status by its source transaction (Nansen trade/bridge-status). Read-only. */
export function BridgeStatusLookup() {
  const [tx, setTx] = useState('');
  const [from, setFrom] = useState('base');
  const [to, setTo] = useState('ethereum');
  const [res, setRes] = useState<{ status: string | null; substatus: string | null } | { error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch('/api/trade', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'bridge', txHash: tx.trim(), from, to }) });
      const d = await r.json(); setRes(r.ok ? d : { error: d.error ?? 'Unavailable.' });
    } catch { setRes({ error: 'Could not reach the server.' }); } finally { setBusy(false); }
  };
  const chains = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb', 'solana', 'avalanche'];
  return (
    <section aria-labelledby="bridge-lookup" className="material p-4 sm:p-5">
      <h2 id="bridge-lookup" className="t-section">Bridge transfer status</h2>
      <p className="mt-0.5 text-[12.5px] text-ink-2">Paste a source transaction to track a bridge route. Read-only.</p>
      <form onSubmit={run} className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">
        <input value={tx} onChange={(e) => setTx(e.target.value)} placeholder="Source transaction hash" aria-label="Source transaction hash" className="inset-well h-9 min-w-[260px] flex-1 rounded-[8px] px-3 font-mono text-[12px]" />
        <select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From chain" className="inset-well h-9 rounded-[8px] px-2">{chains.map((c) => <option key={c}>{c}</option>)}</select>
        <span className="text-ink-muted">to</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="To chain" className="inset-well h-9 rounded-[8px] px-2">{chains.map((c) => <option key={c}>{c}</option>)}</select>
        <button type="submit" disabled={busy || tx.trim().length < 20} className="pill-button pill-secondary min-h-9 px-4 py-1.5">{busy ? 'Checking…' : 'Check status'}</button>
      </form>
      {res && ('error' in res ? <p role="alert" className="mt-2 text-[12.5px] text-[var(--flare)]">{friendlyError(res.error)}</p> : <p className="mt-2 text-[13px] text-ink">Status: <span className="font-semibold">{res.status ?? 'unknown'}</span>{res.substatus ? ` · ${res.substatus}` : ''}</p>)}
    </section>
  );
}
