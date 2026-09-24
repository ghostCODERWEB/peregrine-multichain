'use client';
import { useState } from 'react';

export function InferenceControls({ maxCredits, onUpdated }: { maxCredits: number; onUpdated: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <div className="mt-3 space-y-2">
    <button disabled={busy} className="rounded-lg border border-border px-3 py-2 text-sm text-ink disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage('');
      try {
        const r = await fetch('/api/weather/inferred', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmCredits: maxCredits }) });
        const result = await r.json();
        if (!r.ok) throw new Error(result.error ?? 'Relationship check failed.');
        setMessage(`Checked ${result.checked} wallets; ${result.calls} calls, ${result.credits} credits, ${result.failures} unavailable responses.`);
        await onUpdated();
      } catch (e) { setMessage((e as Error).message); }
      finally { setBusy(false); }
    }}>{busy ? 'Checking evidence…' : `Check funding evidence · up to ${maxCredits} credits`}</button>
    <p className="text-xs text-ink-muted">Explicit lookup of at most six recent high-volume wallets, page one only. At most once per hour. No paid labels, trades or alerts.</p>
    {message && <p className="text-sm text-ink-2" role="status">{message}</p>}
  </div>;
}
