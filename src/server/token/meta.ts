// P4: token identity remembered from Nansen's own responses, so lists (risk
// ticker, Alpha, Desk, trade) can show a token's real logo without a call.
// Only https URLs Nansen returned are kept; the viewer's browser loads them.
import { getDb } from '@/server/nansen/db';
import { addressKey } from '@/lib/address-family';

export function rememberToken(chain: string, address: string, symbol: string | null, logo: string | null, now = Date.now()): void {
  const url = logo && /^https:\/\//.test(logo) ? logo : null;
  if (!url && !symbol) return;
  getDb().prepare(`INSERT INTO token_meta (chain, token_address, symbol, logo, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (chain, token_address) DO UPDATE SET symbol = COALESCE(excluded.symbol, symbol), logo = COALESCE(excluded.logo, logo), updated_at = excluded.updated_at`)
    .run(chain, addressKey(address), symbol, url, now);
}

const key = (chain: string, address: string) => `${chain}:${addressKey(address)}`;

/** Logos for many tokens at once; tokens never seen map to nothing. */
export function tokenLogos(tokens: Array<{ chain: string; address: string }>): Map<string, string> {
  const out = new Map<string, string>();
  if (!tokens.length) return out;
  const q = getDb().prepare('SELECT logo FROM token_meta WHERE chain = ? AND token_address = ? AND logo IS NOT NULL');
  for (const t of tokens) {
    const k = key(t.chain, t.address);
    if (out.has(k)) continue;
    const r = q.get(t.chain, addressKey(t.address)) as { logo: string } | undefined;
    if (r) out.set(k, r.logo);
  }
  return out;
}

export const logoOf = (logos: Map<string, string>, chain: string, address: string) => logos.get(key(chain, address)) ?? null;
