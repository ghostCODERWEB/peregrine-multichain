'use client';
// Recently viewed objects (coins, wallets, tokens, chains, sectors, entities),
// kept in this browser only. Written after navigation, read by the search
// palette and the workspace bar.
const KEY = 'peregrine:recent';
const MAX = 12;
export interface RecentItem { href: string; title: string; kind: string; at: number }

const KINDS: Array<[RegExp, string]> = [
  [/^\/perps\/[^/]+/, 'Perp'], [/^\/wallet\//, 'Wallet'], [/^\/token\//, 'Token'], [/^\/chain\//, 'Chain'],
  [/^\/sectors\/[^/]+/, 'Sector'], [/^\/entity\//, 'Entity'], [/^\/rug\/[^/]+\//, 'Rug check'],
];

export function recentKind(path: string): string | null {
  return KINDS.find(([re]) => re.test(path))?.[1] ?? null;
}

export function readRecent(): RecentItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as RecentItem[]; } catch { return []; }
}

export function remember(href: string, title: string) {
  const kind = recentKind(href.split('?')[0]);
  if (!kind) return;
  try {
    const base = href.split('?')[0];
    const list = readRecent().filter((r) => r.href.split('?')[0] !== base);
    list.unshift({ href, title: title.replace(/\s*·\s*Peregrine.*$/, '').trim() || base, kind, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event('peregrine:recent'));
  } catch { /* storage unavailable */ }
}
