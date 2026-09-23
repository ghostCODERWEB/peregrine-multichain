// Wallet sessions: a random id in an httpOnly cookie, a row in `sessions`.
import crypto from 'node:crypto';
import { getDb } from '@/server/nansen/db';
import type { Family } from './wallet-sig';

export const SESSION_COOKIE = 'tide_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const NONCE_TTL_MS = 5 * 60_000;

export interface SessionUser { id: number; family: Family; address: string }

export function newNonce(): string {
  const nonce = crypto.randomBytes(12).toString('hex');
  const db = getDb();
  db.prepare('DELETE FROM auth_nonces WHERE created_at < ?').run(Date.now() - NONCE_TTL_MS);
  db.prepare('INSERT INTO auth_nonces (nonce, created_at) VALUES (?, ?)').run(nonce, Date.now());
  return nonce;
}

/** One-time: a nonce is valid once, within five minutes. */
export function consumeNonce(nonce: string): boolean {
  const r = getDb().prepare('DELETE FROM auth_nonces WHERE nonce = ? AND created_at >= ?').run(nonce, Date.now() - NONCE_TTL_MS);
  return r.changes === 1;
}

export function createSession(family: Family, address: string): { id: string; user: SessionUser } {
  const db = getDb();
  const addr = family === 'evm' ? address.toLowerCase() : address;
  db.prepare('INSERT OR IGNORE INTO users (family, address, created_at) VALUES (?, ?, ?)').run(family, addr, Date.now());
  const user = db.prepare('SELECT id, family, address FROM users WHERE family = ? AND address = ?').get(family, addr) as SessionUser;
  const id = crypto.randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(id, user.id, Date.now(), Date.now() + SESSION_TTL_MS);
  return { id, user };
}

export function sessionUser(sessionId: string | undefined | null): SessionUser | null {
  if (!sessionId) return null;
  const r = getDb().prepare(`
    SELECT u.id, u.family, u.address FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, Date.now()) as SessionUser | undefined;
  return r ?? null;
}

export function destroySession(sessionId: string): void {
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function cookieFrom(header: string | null, name = SESSION_COOKIE): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
