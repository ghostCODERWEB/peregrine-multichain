import { describe, it, expect } from 'vitest';
import { Keypair, MessageV0, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { decodeSwapForWallet, bytesToBase64, base64ToBytes } from './solana-tx';

const wallet = Keypair.generate().publicKey;
const other = Keypair.generate().publicKey;
const unsigned = (payer: PublicKey, signers = 1) => bytesToBase64(new VersionedTransaction(new MessageV0({
  header: { numRequiredSignatures: signers, numReadonlySignedAccounts: 0, numReadonlyUnsignedAccounts: 0 },
  staticAccountKeys: [payer], recentBlockhash: '11111111111111111111111111111111', compiledInstructions: [], addressTableLookups: [],
})).serialize());

describe('Solana swap check before the wallet (M8b)', () => {
  it('accepts a swap the connected wallet pays for, and round-trips base64 byte for byte', () => {
    const b64 = unsigned(wallet);
    const r = decodeSwapForWallet(b64, wallet.toBase58());
    expect('tx' in r).toBe(true);
    if ('tx' in r) expect(bytesToBase64(r.tx.serialize())).toBe(b64);
    expect(bytesToBase64(base64ToBytes(b64))).toBe(b64);
  });
  it('refuses a swap paid by another account, with no signer, or unreadable', () => {
    expect(decodeSwapForWallet(unsigned(other), wallet.toBase58())).toMatchObject({ error: expect.stringContaining('not your wallet') });
    expect(decodeSwapForWallet(unsigned(wallet, 0), wallet.toBase58())).toMatchObject({ error: expect.stringContaining('no signer') });
    expect(decodeSwapForWallet(bytesToBase64(new Uint8Array([1, 2, 3])), wallet.toBase58())).toHaveProperty('error');
  });
  it('compares public keys exactly: base58 is case-sensitive', () => {
    const lower = wallet.toBase58().toLowerCase();
    if (lower !== wallet.toBase58()) expect(decodeSwapForWallet(unsigned(wallet), lower)).toHaveProperty('error');
  });
});
