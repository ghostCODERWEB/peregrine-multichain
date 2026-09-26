'use client';
// The Research watchlist of public Hyperliquid traders, kept in this browser (analysis only, no copying).
const KEY = 'peregrine:hl-watch';
export interface Watched { address: string; label: string | null; addedAt: number }

export function watched(): Watched[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Watched[]; } catch { return []; }
}
export function isWatched(address: string): boolean {
  return watched().some((w) => w.address.toLowerCase() === address.toLowerCase());
}
/** Adds or removes a trader; returns whether it is now watched. */
export function toggleWatch(address: string, label: string | null): boolean {
  const list = watched();
  const has = list.some((w) => w.address.toLowerCase() === address.toLowerCase());
  const next = has ? list.filter((w) => w.address.toLowerCase() !== address.toLowerCase()) : [...list, { address, label, addedAt: Date.now() }];
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event('peregrine:watch'));
  return !has;
}
