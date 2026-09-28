'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ago } from '@/lib/viz/format';

// One shared 30 s clock for every <TimeAgo> on the page (a table of trades used to start one timer per row).
// It runs only while something listens.
const listeners = new Set<() => void>();
let now = 0;
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer) { now = Date.now(); timer = setInterval(() => { now = Date.now(); listeners.forEach((l) => l()); }, 30_000); }
  return () => { listeners.delete(fn); if (!listeners.size && timer) { clearInterval(timer); timer = undefined; } };
}
const snapshot = () => now;
const serverSnapshot = () => 0;

/**
 * "12m ago" that doesn't break hydration: the server's clock and the
 * browser's disagree by the render gap, so the first paint keeps the
 * server text (suppressHydrationWarning) and then renders against the
 * browser clock, refreshed every 30 s so it stays true.
 */
export function TimeAgo({ ts }: { ts: number | null | undefined }) {
  const clock = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <time suppressHydrationWarning dateTime={ts ? new Date(ts).toISOString() : undefined}>
      {ago(ts, mounted && clock ? clock : Date.now())}
    </time>
  );
}
