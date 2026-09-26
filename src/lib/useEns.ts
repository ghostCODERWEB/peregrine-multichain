'use client';
import { useEffect, useState } from 'react';

// One batched /api/ens request per animation frame for every address on screen; answers are kept for the session.
const known = new Map<string, string | null>();
const waiting = new Map<string, Array<(n: string | null) => void>>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const batch = [...waiting.keys()].slice(0, 60);
  const cbs = batch.map((a) => [a, waiting.get(a)!] as const);
  batch.forEach((a) => waiting.delete(a));
  fetch(`/api/ens?a=${batch.join(',')}`)
    .then((r) => r.json() as Promise<{ names: Record<string, string | null> }>)
    .then(({ names }) => cbs.forEach(([a, fns]) => { const n = names[a] ?? null; known.set(a, n); fns.forEach((f) => f(n)); }))
    .catch(() => cbs.forEach(([a, fns]) => { known.set(a, null); fns.forEach((f) => f(null)); }));
  if (waiting.size) timer = setTimeout(flush, 60);
}

/** The address's ENS name once resolved (EVM addresses only), else null. */
export function useEnsName(address: string | null | undefined, enabled = true): string | null {
  const a = address && /^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : null;
  const [name, setName] = useState<string | null>(a ? known.get(a) ?? null : null);
  useEffect(() => {
    if (!a || !enabled) return;
    if (known.has(a)) { setName(known.get(a)!); return; }
    let live = true;
    const list = waiting.get(a) ?? [];
    list.push((n) => { if (live) setName(n); });
    waiting.set(a, list);
    if (!timer) timer = setTimeout(flush, 60);
    return () => { live = false; };
  }, [a, enabled]);
  return name;
}
