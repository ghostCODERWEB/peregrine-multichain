'use client';
import { useEffect, useState } from 'react';

/** Fills the prediction layer in place on open (shared 15-minute cache). */
export function LoadCategories({ onLoaded }: { onLoaded: () => Promise<unknown> }) {
  const [message, setMessage] = useState('Loading category activity…');
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch('/api/weather/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmCredits: 1 }) });
        const result = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(result.error ?? 'Category activity is unavailable right now.');
        await onLoaded();
        if (live) setMessage('');
      } catch (e) { if (live) setMessage((e as Error).message); }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on open
  }, []);
  return message ? <p className="text-sm text-ink-muted" role="status">{message}</p> : null;
}
