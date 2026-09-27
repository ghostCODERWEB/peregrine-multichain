// Short-lived memo for boards built from the scanner's stored tables. The
// ticker, nav status and several pages each rebuilt the same board on every
// request (tens of ms each); the tables only change when the scanner runs.
// Only live reads are memoized: a read at another time (backtests) always
// computes, and the scanner clears the memo after it writes.

const store = new Map<string, { at: number; value: unknown }>();

export function liveMemo<T>(key: string, now: number, ttlMs: number, compute: () => T): T {
  const t = Date.now();
  if (Math.abs(t - now) > 5_000) return compute();
  const hit = store.get(key);
  if (hit && t - hit.at < ttlMs) return hit.value as T;
  const value = compute();
  store.set(key, { at: t, value });
  return value;
}

/** Drop memoized values whose key starts with `prefix` (all of them without one). */
export function clearLiveMemo(prefix = ''): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
