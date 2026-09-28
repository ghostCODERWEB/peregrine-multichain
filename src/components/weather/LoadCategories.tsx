'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';

// One load per page, however many times the panel mounts (a remount while the layer refreshes, React's
// development double-run): every mount shares the request in flight, and a load that succeeded is not
// repeated for a minute. Each request is priced (1 credit when the shared cache is cold).
let inflight: Promise<void> | null = null;
let loadedAt = 0;

// The load's state for the rest of the view: while it runs the hero says it is loading, not that there is no
// data; only a failed load shows a message.
type Status = 'idle' | 'loading' | 'failed';
let status: Status = 'idle';
const listeners = new Set<() => void>();
const setStatus = (s: Status) => { status = s; listeners.forEach((l) => l()); };
export const useCategoryLoad = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => status, () => 'idle' as Status);

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

/** Fills the prediction layer in place on open (shared 15-minute cache): skeleton tiles while it loads, the
 *  reason only if it fails. */
export function LoadCategories({ onLoaded, unavailable }: { onLoaded: () => Promise<unknown>; unavailable?: string | null }) {
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setStatus('loading');
    (async () => {
      try {
        await loadOnce();
        const r = (await onLoaded()) as { data?: { layers?: Array<{ id: string; readings?: unknown[] }> } } | undefined;
        // The refreshed board decides: readings mean the tiles take over; none means there is nothing to show, so
        // stop saying it is loading.
        const readings = r?.data?.layers?.find((l) => l.id === 'predictions')?.readings?.length ?? 0;
        if (readings) setStatus('idle');
        else { setStatus('failed'); if (live) setError('Nansen has no category activity to show right now.'); }
      } catch (e) {
        setStatus('failed');
        if (live) setError((e as Error).message);
      }
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on open
  }, []);
  if (error) return <div className="inset-well space-y-1 p-4"><p className="text-sm text-ink-2" role="status">{error}</p>{unavailable && <p className="text-[12.5px] text-ink-muted">{unavailable}</p>}</div>;
  return (
    <ul aria-busy="true" aria-label="Loading category activity" className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => <li key={i} className="inset-well h-[78px] animate-pulse rounded-[16px]" />)}
    </ul>
  );
}
