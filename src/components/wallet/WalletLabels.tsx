'use client';
import { useState } from 'react';
import { Card, Unavailable } from '@/components/Card';

export function WalletLabels({ address, enabled }: { address: string; enabled: boolean }) {
  const [pending, setPending] = useState<number | null>(null), [busy, setBusy] = useState(false);
  const [labels, setLabels] = useState<string[] | null>(null), [error, setError] = useState('');
  async function lookup() {
    if (pending == null) return;
    setBusy(true); setError(''); setLabels(null);
    try {
      const r = await fetch('/api/wallet/labels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address, chain: 'all', premium: pending === 500, confirmCredits: pending }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Label lookup failed.');
      setLabels(data.labels.map((l: { label: string }) => l.label));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); setPending(null); }
  }
  return <Card id="wallet-labels" title="Nansen wallet labels" sub="Optional, private enrichment. No lookup runs until you confirm its credit price.">{enabled ? <>
    <div className="flex flex-wrap gap-2">{[100, 500].map((cost) => <button key={cost} disabled={busy} onClick={() => setPending(cost)} className="rounded-md border border-border px-3 py-2 text-xs">{cost === 100 ? 'Standard labels' : 'Premium labels'} · {cost} credits</button>)}</div>
    {pending != null && <div className="mt-3 rounded-lg border border-border bg-accent/40 p-3"><p className="text-sm">Use up to {pending} credits from your Nansen key for this address? Cached results cost zero.</p><div className="mt-2 flex gap-3"><button disabled={busy} className="rounded border border-border px-3 py-2 text-xs" onClick={lookup}>{busy ? 'Loading…' : `Confirm ${pending}-credit lookup`}</button><button disabled={busy} className="text-xs" onClick={() => setPending(null)}>Cancel</button></div></div>}
    <div aria-live="polite" className="mt-3">{error && <Unavailable text={error} />}{labels && (labels.length ? <ul className="flex flex-wrap gap-2">{labels.map((l, i) => <li key={i} className="rounded border border-border px-3 py-1 text-xs">{l}</li>)}</ul> : <Unavailable text="Nansen returned no labels for this wallet." />)}</div>
  </> : <Unavailable text="Sign in with your own Nansen key to request labels. Labels are withheld from public views and demo recordings." />}</Card>;
}
