'use client';
import { useState } from 'react';

/** One explicit, priced read that fills the prediction layer in place. */
export function LoadCategories({ onLoaded }: { onLoaded: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <div className="space-y-2">
    <button type="button" disabled={busy} className="rounded-lg border border-border px-3 py-2 text-sm text-ink hover:bg-accent disabled:opacity-50" onClick={async () => {
      setBusy(true); setMessage('');
      try {
        const r = await fetch('/api/weather/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmCredits: 1 }) });
        const result = await r.json() as { error?: string; cached?: boolean; credits?: number };
        if (!r.ok) throw new Error(result.error ?? 'Loading categories failed.');
        setMessage(result.cached ? 'Loaded from the shared 15-minute cache; no credits spent.' : `Loaded from Nansen; ${result.credits} credit spent.`);
        await onLoaded();
      } catch (e) { setMessage((e as Error).message); }
      finally { setBusy(false); }
    }}>{busy ? 'Loading categories…' : 'Load category activity · 1 credit'}</button>
    <p className="text-xs text-ink-muted">The same cached call the Predictions page makes, on the instance key. Free while the shared 15-minute cache is fresh.</p>
    {message && <p className="text-sm text-ink-2" role="status">{message}</p>}
  </div>;
}
