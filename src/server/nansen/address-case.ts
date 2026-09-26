// Dump Risk rows store token addresses lowercased (their lookup key). EVM
// addresses are case-insensitive, but Solana, Sui and other base58/move
// addresses are not: a lowercased Solana mint is a different token. This
// restores the original casing from tables that keep it, for links and lookups.
import { getDb } from '@/server/nansen/db';

const memo = new Map<string, string>();

export function properAddress(chain: string, address: string): string {
  if (address.startsWith('0x') || address !== address.toLowerCase()) return address;
  const key = `${chain}:${address}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const db = getDb();
  let found: string | undefined;
  for (const sql of [
    'SELECT token_address AS a FROM token_pulse WHERE chain = ? AND lower(token_address) = ? LIMIT 1',
    'SELECT token_address AS a FROM smart_money_trades WHERE chain = ? AND lower(token_address) = ? LIMIT 1',
    'SELECT token_address AS a FROM sector_members WHERE chain = ? AND lower(token_address) = ? LIMIT 1',
  ]) {
    try { found = (db.prepare(sql).get(chain, address) as { a: string } | undefined)?.a; } catch { /* table may not exist */ }
    if (found) break;
  }
  const out = found ?? address;
  memo.set(key, out);
  return out;
}
