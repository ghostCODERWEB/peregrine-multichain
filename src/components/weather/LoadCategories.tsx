'use client';
import { useEffect, useState } from 'react';

// One load per page, however many times the panel mounts (a remount while the layer refreshes, React's
// development double-run): every mount shares the request in flight, and a load that succeeded is not
// repeated for a minute. Each request is priced (1 credit when the shared cache is cold).
let inflight: Promise<void> | null = null;
let loadedAt = 0;

function loadOnce(): Promise<void> {
  if (Date.now() - loadedAt < 60_000) return Promise.resolve();
  inflight ??= (async () => {
    try {
      const r = await fetch('/api/weather/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmCredits: 1 }) });
      const result = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(result.error ?? 'Category activity is unavailable right now.');
      loadedAt = Date.now();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Fills the prediction layer in place on open (shared 15-minute cache). */
export function LoadCategories({ onLoaded }: { onLoaded: () => Promise<unknown> }) {
  const [message, setMessage] = useState('Loading category activity…');
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await loadOnce();
        await onLoaded();
        if (live) setMessage('');
      } catch (e) { if (live) setMessage((e as Error).message); }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on open
  }, []);
  return message ? <p className="text-sm text-ink-muted" role="status">{message}</p> : null;
}
