// Names for page titles and share cards, read from what the app has stored: link previews are fetched by
// crawlers, so they never call Nansen.
import { getDb } from '@/server/nansen/db';

const CONTROL = /[\u0000-\u001F\u007F]/g;
const clean = (s: string | null | undefined) => (s ? s.replace(CONTROL, '').trim().slice(0, 24) || null : null);

/** A token's symbol as last seen: its stored metadata, its latest Token Score, or a Smart Money trade. */
export function tokenSymbol(chain: string, address: string): string | null {
  const db = getDb();
  const lower = address.toLowerCase();
  const meta = db.prepare('SELECT symbol FROM token_meta WHERE chain = ? AND token_address IN (?, ?) AND symbol IS NOT NULL LIMIT 1').get(chain, address, lower) as { symbol: string } | undefined;
  if (meta?.symbol) return clean(meta.symbol);
  const score = db.prepare('SELECT symbol FROM storm_scores WHERE chain = ? AND token_address IN (?, ?) AND symbol IS NOT NULL ORDER BY id DESC LIMIT 1').get(chain, address, lower) as { symbol: string } | undefined;
  if (score?.symbol) return clean(score.symbol);
  const trade = db.prepare('SELECT token_symbol AS symbol FROM smart_money_trades WHERE chain = ? AND token_address IN (?, ?) AND token_symbol IS NOT NULL LIMIT 1').get(chain, address, lower) as { symbol: string } | undefined;
  return clean(trade?.symbol);
}
