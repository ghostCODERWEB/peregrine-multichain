// Encrypts users' own Nansen API keys at rest (AES-256-GCM). The key
// encryption key comes from TIDE_KMS_KEY (32 bytes, base64 or hex) and is
// never stored with the data. Without it, bring-your-own-key is disabled
// rather than keys being stored in the clear.
import crypto from 'node:crypto';

export interface Sealed { ciphertext: string; iv: string; tag: string }

function kek(): Buffer | null {
  const raw = process.env.TIDE_KMS_KEY?.trim();
  if (!raw) return null;
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return buf.length === 32 ? buf : null;
}

export const vaultReady = () => kek() !== null;

export function seal(plaintext: string): Sealed {
  const key = kek();
  if (!key) throw new Error('TIDE_KMS_KEY is not set (32 bytes, base64 or hex): bring-your-own-key is disabled.');
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return { ciphertext: ct.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') };
}

export function open(s: Sealed): string {
  const key = kek();
  if (!key) throw new Error('TIDE_KMS_KEY is not set.');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(s.iv, 'base64'));
  d.setAuthTag(Buffer.from(s.tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(s.ciphertext, 'base64')), d.final()]).toString('utf8');
}
