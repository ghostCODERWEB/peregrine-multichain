import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { buildMessage, parseMessage, verifyEvm, verifySolana, base58Decode } from './wallet-sig';
import { seal, open } from './vault';
import { resolveMode } from '../mode';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(buf: Buffer): string {
  let n = BigInt('0x' + (buf.toString('hex') || '0'));
  let out = '';
  while (n > BigInt(0)) { out = B58[Number(n % BigInt(58))] + out; n /= BigInt(58); }
  for (const b of buf) { if (b !== 0) break; out = '1' + out; }
  return out;
}

describe('wallet sign-in', () => {
  const base = { domain: 'localhost:3200', uri: 'http://localhost:3200', nonce: 'abc123', issuedAt: '2026-09-23T20:00:00.000Z' };

  it('round-trips the sign-in message', () => {
    const m = buildMessage({ ...base, family: 'evm', address: '0x1111111111111111111111111111111111111111' });
    expect(parseMessage(m)).toEqual({ domain: 'localhost:3200', address: '0x1111111111111111111111111111111111111111', nonce: 'abc123', issuedAt: base.issuedAt });
  });

  it('verifies a real Ethereum personal_sign signature and rejects another address', async () => {
    const acct = privateKeyToAccount(generatePrivateKey());
    const message = buildMessage({ ...base, family: 'evm', address: acct.address });
    const sig = await acct.signMessage({ message });
    expect(await verifyEvm(acct.address, message, sig)).toBe(true);
    const other = privateKeyToAccount(generatePrivateKey());
    expect(await verifyEvm(other.address, message, sig)).toBe(false);
    expect(await verifyEvm(acct.address, message + 'x', sig)).toBe(false);
  });

  it('verifies a real Solana ed25519 signature (base64 and base58) and rejects tampering', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
    const address = base58Encode(Buffer.from(raw));
    expect(base58Decode(address).equals(Buffer.from(raw))).toBe(true);
    const message = buildMessage({ ...base, family: 'solana', address });
    const sig = crypto.sign(null, Buffer.from(message), privateKey);
    expect(verifySolana(address, message, sig.toString('base64'))).toBe(true);
    expect(verifySolana(address, message, base58Encode(sig))).toBe(true);
    expect(verifySolana(address, message.replace('abc123', 'zzz999'), sig.toString('base64'))).toBe(false);
  });
});

describe('key vault', () => {
  beforeAll(() => { process.env.TIDE_KMS_KEY = crypto.randomBytes(32).toString('base64'); });
  it('seals and opens, and a tampered ciphertext fails', () => {
    const s = seal('nansen-key-123456789');
    expect(s.ciphertext).not.toContain('nansen');
    expect(open(s)).toBe('nansen-key-123456789');
    const bad = { ...s, ciphertext: Buffer.from('x' + Buffer.from(s.ciphertext, 'base64').toString('latin1')).toString('base64') };
    expect(() => open(bad)).toThrow();
  });
});

describe('resolveMode', () => {
  const none = { demo: false, instancePrivate: false, userAddress: null, ownerAddress: null, userHasKey: false };
  it('defaults to public', () => expect(resolveMode(none)).toBe('public'));
  it('demo is always public, even on a private instance', () => expect(resolveMode({ ...none, demo: true, instancePrivate: true })).toBe('public'));
  it('a private instance is the owner’s', () => expect(resolveMode({ ...none, instancePrivate: true })).toBe('owner'));
  it('the configured owner address signs in as owner', () => expect(resolveMode({ ...none, userAddress: '0xAbC', ownerAddress: '0xabc' })).toBe('owner'));
  it('a signed-in user with their own key is a member', () => expect(resolveMode({ ...none, userAddress: '0x1', userHasKey: true })).toBe('member'));
  it('signed in without a key is still public', () => expect(resolveMode({ ...none, userAddress: '0x1' })).toBe('public'));
});
