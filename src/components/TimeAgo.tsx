'use client';
import { useEffect, useState } from 'react';
import { ago } from '@/lib/viz/format';

/**
 * "12m ago" that doesn't break hydration: the server's clock and the
 * browser's disagree by the render gap, so the first paint keeps the
 * server text (suppressHydrationWarning) and the effect re-renders it
 * against the browser clock, then every 30 s so it stays true.
 */
export function TimeAgo({ ts }: { ts: number | null | undefined }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <time suppressHydrationWarning dateTime={ts ? new Date(ts).toISOString() : undefined}>
      {ago(ts, now ?? Date.now())}
    </time>
  );
}
