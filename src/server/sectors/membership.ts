// Which tokens belong to which Nansen sector. The screener's rows carry no
// sector field, but it filters by sector, so once a day the worker asks it,
// per sector, for the tokens on the five largest chains; the scanner then
// sorts every screener row it already fetched into those sectors for free.
// Tokens outside that set (smaller chains, the long tail) are unclassified
// and the sector page says how many.
import { callNansen } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import type { TokenSectorsResponse } from '@/types/nansen/api.gen';

export const MEMBERSHIP_MAX_AGE_MS = 24 * 3_600_000;
const FALLBACK_CHAINS = ['ethereum', 'solana', 'base', 'bnb', 'arbitrum'];
const PER_PAGE = 1000;

/** EVM addresses compare case-insensitively; base58 and others do not. */
export const tokenKey = (chain: string, address: string) => `${chain}:${address.startsWith('0x') ? address.toLowerCase() : address}`;

/** Nansen's sector list (search/token-sectors, 1 credit, cached a day). */
export async function sectorList(): Promise<string[]> {
  const r = await callNansen<TokenSectorsResponse>('search/token-sectors', {}, { method: 'GET' });
  return [...new Set(r.data.data.map((d) => d.sector).filter(Boolean))].sort();
}

/** The five chains with the most 24h volume in the scanner's latest run. */
export function membershipChains(): string[] {
  const rows = getDb().prepare(`
    SELECT chain FROM chain_pressure_snapshots
    WHERE window = '24h' AND id IN (SELECT MAX(id) FROM chain_pressure_snapshots WHERE window = '24h' GROUP BY chain)
    ORDER BY volume_usd DESC LIMIT 5
  `).all() as Array<{ chain: string }>;
  return rows.length >= 3 ? rows.map((r) => r.chain) : FALLBACK_CHAINS;
}

export function membershipAge(now = Date.now()): number | null {
  const t = (getDb().prepare('SELECT MAX(refreshed_at) AS t FROM sector_members').get() as { t: number | null }).t;
  return t == null ? null : now - t;
}

export function membershipDue(now = Date.now()): boolean {
  const age = membershipAge(now);
  return age == null || age >= MEMBERSHIP_MAX_AGE_MS;
}

export const screenerSectorBody = (chains: string[], sector: string) => ({
  chains, timeframe: '24h', pagination: { page: 1, per_page: PER_PAGE },
  order_by: [{ field: 'volume', direction: 'DESC' }],
  filters: { sectors: [sector], include_stablecoins: false, include_native_tokens: false },
});

/** Loads the sector → token map; returns tokenKey → sectors. */
export function loadMembership(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of getDb().prepare('SELECT chain, token_address, sector FROM sector_members').all() as Array<{ chain: string; token_address: string; sector: string }>) {
    const k = tokenKey(r.chain, r.token_address);
    const list = out.get(k);
    if (list) list.push(r.sector); else out.set(k, [r.sector]);
  }
  return out;
}

/**
 * Rebuild membership: one screener call per sector (1 credit each) plus
 * the sector list. Estimates first and refuses above `cap`.
 */
export async function refreshMembership(opts: { cap: number; log?: (s: string) => void; now?: number }): Promise<{ sectors: number; tokens: number; credits: number; failed: string[] }> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? Date.now();
  const sectors = await sectorList();
  const estimate = sectors.length; // token-screener: 1 credit per call
  if (estimate > opts.cap) throw new Error(`Sector membership needs ~${estimate} credits, above SECTOR_REFRESH_CREDIT_CAP ${opts.cap}.`);
  const chains = membershipChains();
  log(`sector membership: ${sectors.length} sectors on ${chains.join(', ')} (~${estimate} credits)`);

  const rows: Array<{ chain: string; address: string; sector: string }> = [];
  const failed: string[] = [];
  let credits = 0;
  for (const sector of sectors) {
    try {
      const r = await callNansen<{ data?: Array<{ chain: string; token_address?: string | null }> }>('token-screener', screenerSectorBody(chains, sector), { record: false });
      credits += r.meta.creditsCost;
      for (const t of r.data.data ?? []) if (t.token_address) rows.push({ chain: t.chain, address: t.token_address, sector });
    } catch (e) {
      failed.push(`${sector}: ${(e as Error).message.slice(0, 100)}`);
    }
  }
  // Keep the old map when every call failed, rather than wiping it.
  if (rows.length === 0) throw new Error(`No sector returned any token (${failed.length} failed): ${failed.slice(0, 2).join(' | ')}`);
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM sector_members').run();
    const ins = db.prepare('INSERT OR IGNORE INTO sector_members (chain, token_address, sector, refreshed_at) VALUES (?, ?, ?, ?)');
    for (const r of rows) ins.run(r.chain, r.address.startsWith('0x') ? r.address.toLowerCase() : r.address, r.sector, now);
  })();
  const tokens = new Set(rows.map((r) => tokenKey(r.chain, r.address))).size;
  log(`sector membership: ${tokens} tokens in ${sectors.length - failed.length} sectors, ${credits} credits`);
  return { sectors: sectors.length, tokens, credits, failed };
}
