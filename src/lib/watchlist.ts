// The visitor's watchlist: tokens they marked on a token page, listed on the
// Desk. Kept in this browser only (a per-visitor convenience, no account);
// every read and write tolerates storage being unavailable.
export interface Watched { chain: string; address: string; symbol: string | null; at: number }
const KEY = 'peregrine-watchlist';

export function watchlist(): Watched[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.slice(0, 50) : []; } catch { return []; }
}
const same = (w: Watched, chain: string, address: string) => w.chain === chain && w.address.toLowerCase() === address.toLowerCase();
export const isWatched = (chain: string, address: string) => watchlist().some((w) => same(w, chain, address));

/** Adds or removes the token; returns whether it is now watched. */
export function toggleWatch(t: { chain: string; address: string; symbol: string | null }): boolean {
  const list = watchlist();
  const on = !list.some((w) => same(w, t.chain, t.address));
  const next = on ? [{ ...t, at: Date.now() }, ...list].slice(0, 50) : list.filter((w) => !same(w, t.chain, t.address));
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { return false; }
  window.dispatchEvent(new Event('peregrine-watchlist'));
  return on;
}
