// Sign-in with a wallet: the user signs a plain-text statement (EIP-4361
// shape for Ethereum, the same text for Solana) containing a one-time
// nonce and this site's domain. Signing costs nothing and moves no funds.
import crypto from 'node:crypto';
import { verifyMessage, isAddress, getAddress } from 'viem';

export type Family = 'evm' | 'solana';

export function buildMessage(p: { family: Family; domain: string; uri: string; address: string; nonce: string; issuedAt: string }): string {
  const account = p.family === 'evm' ? 'Ethereum' : 'Solana';
  return [
    `${p.domain} wants you to sign in with your ${account} account:`,
    p.address,
    '',
    'Sign in to TIDE. This proves you control this address; it costs nothing and moves no funds.',
    '',
    `URI: ${p.uri}`,
    'Version: 1',
    ...(p.family === 'evm' ? ['Chain ID: 1'] : []),
    `Nonce: ${p.nonce}`,
    `Issued At: ${p.issuedAt}`,
  ].join('\n');
}

export function parseMessage(message: string): { domain: string; address: string; nonce: string; issuedAt: string } | null {
  const lines = message.split('\n');
  const domain = /^(\S+) wants you to sign in with your (Ethereum|Solana) account:$/.exec(lines[0] ?? '')?.[1];
  const address = lines[1]?.trim();
  const nonce = /^Nonce: (\S+)$/m.exec(message)?.[1];
  const issuedAt = /^Issued At: (\S+)$/m.exec(message)?.[1];
  return domain && address && nonce && issuedAt ? { domain, address, nonce, issuedAt } : null;
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58Decode(s: string): Buffer {
  const ZERO = BigInt(0), B = BigInt(58), BYTE = BigInt(256);
  let n = ZERO;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error('invalid base58');
    n = n * B + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > ZERO) { bytes.unshift(Number(n % BYTE)); n /= BYTE; }
  for (const ch of s) { if (ch !== '1') break; bytes.unshift(0); }
  return Buffer.from(bytes);
}

export async function verifyEvm(address: string, message: string, signature: string): Promise<boolean> {
  if (!isAddress(address) || !/^0x[0-9a-fA-F]+$/.test(signature)) return false;
  try {
    return await verifyMessage({ address: getAddress(address), message, signature: signature as `0x${string}` });
  } catch { return false; }
}

/** Ed25519 over the raw message bytes; signature base64 or base58. */
export function verifySolana(address: string, message: string, signature: string): boolean {
  try {
    const pub = base58Decode(address);
    if (pub.length !== 32) return false;
    const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub]);
    const key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    const sig = /^[1-9A-HJ-NP-Za-km-z]+$/.test(signature) && signature.length > 80 ? base58Decode(signature) : Buffer.from(signature, 'base64');
    return crypto.verify(null, Buffer.from(message, 'utf8'), key, sig);
  } catch { return false; }
}
