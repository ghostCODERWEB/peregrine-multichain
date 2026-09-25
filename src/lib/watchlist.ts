// The visitor's watchlist: tokens they marked on a token page, listed on the
// Desk. Kept in this browser only (a per-visitor convenience, no account);
// every read and write tolerates storage being unavailable.
export interface Watched { chain: string; address: string; symbol: string | null; at: number }
const KEY = 'peregrine-watchlist';

// EVM hex addresses are case-insensitive. Base58 addresses (e.g. Solana)
// are not: folding their case can watch or remove a different token.
const addressKey = (address: string) => /^0x[\da-f]{40}$/i.test(address) ? address.toLowerCase() : address;
const valid = (value: unknown): value is Watched => {
  if (value === null || typeof value !== 'object') return false;
  const w = value as Partial<Watched>;
  return typeof w.chain === 'string' && w.chain.trim().length > 0
    && typeof w.address === 'string' && w.address.trim().length > 0
    && (w.symbol === null || typeof w.symbol === 'string')
    && typeof w.at === 'number' && Number.isFinite(w.at) && w.at >= 0;
};

export function watchlist(): Watched[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter(valid).filter(w => {
      const key = JSON.stringify([w.chain, addressKey(w.address)]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 50);
  } catch { return []; }
}
const same = (w: Watched, chain: string, address: string) => w.chain === chain && addressKey(w.address) === addressKey(address);
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
