// A user's own Nansen API key: verified against GET /api/v1/account (0
// credits) before it is stored, sealed at rest, shown only as its last 4.
import { getDb, audit } from '@/server/nansen/db';
import { seal, open, vaultReady } from './vault';

export interface StoredKey { last4: string; plan: string | null; verifiedAt: number }

export function keyInfo(userId: number): StoredKey | null {
  const r = getDb().prepare('SELECT last4, plan, verified_at FROM api_keys WHERE user_id = ?').get(userId) as { last4: string; plan: string | null; verified_at: number } | undefined;
  return r ? { last4: r.last4, plan: r.plan, verifiedAt: r.verified_at } : null;
}

export function userApiKey(userId: number): string | null {
  if (!vaultReady()) return null;
  const r = getDb().prepare('SELECT ciphertext, iv, tag FROM api_keys WHERE user_id = ?').get(userId) as { ciphertext: string; iv: string; tag: string } | undefined;
  if (!r) return null;
  try { return open(r); } catch { return null; }
}

/** Checks the key with Nansen (0 credits) and stores it sealed. */
export async function saveUserKey(userId: number, apiKey: string): Promise<StoredKey> {
  const key = apiKey.trim();
  if (!/^[A-Za-z0-9_\-.]{16,200}$/.test(key)) throw new Error('That does not look like a Nansen API key.');
  const res = await fetch('https://api.nansen.ai/api/v1/account', { headers: { apikey: key }, signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  if (res.status === 401 || res.status === 403) throw new Error('Nansen rejected this key.');
  if (!res.ok) throw new Error(`Nansen could not check the key right now (${res.status}).`);
  const body = (await res.json()) as { plan?: string; credits_remaining?: number };
  const sealed = seal(key);
  const info: StoredKey = { last4: key.slice(-4), plan: body.plan ?? null, verifiedAt: Date.now() };
  getDb().prepare(`
    INSERT INTO api_keys (user_id, ciphertext, iv, tag, last4, plan, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, tag = excluded.tag, last4 = excluded.last4, plan = excluded.plan, verified_at = excluded.verified_at
  `).run(userId, sealed.ciphertext, sealed.iv, sealed.tag, info.last4, info.plan, info.verifiedAt);
  audit(userId, 'key.saved', `…${info.last4}`);
  return info;
}

export function deleteUserKey(userId: number): void {
  getDb().prepare('DELETE FROM api_keys WHERE user_id = ?').run(userId);
  audit(userId, 'key.deleted');
}
