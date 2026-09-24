// M8b: check a Solana swap Nansen prepared before it reaches the wallet, the
// Solana counterpart of pinning Base's chainId (SpotTrade) and D1c's deposit
// route check. Loaded only when the user signs, so @solana/web3.js stays out
// of /trade's first load.
import { VersionedTransaction } from '@solana/web3.js';

export const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** Decodes the prepared swap and refuses one the connected wallet would not
 *  pay for as the first signer: a transaction built for another fee payer is
 *  never handed to the wallet. */
export function decodeSwapForWallet(base64: string, wallet: string): { tx: VersionedTransaction } | { error: string } {
  let tx: VersionedTransaction;
  try { tx = VersionedTransaction.deserialize(base64ToBytes(base64)); } catch { return { error: 'Nansen returned a Solana transaction Peregrine could not read; not sending it to your wallet.' }; }
  const { header, staticAccountKeys } = tx.message;
  if (header.numRequiredSignatures < 1 || !staticAccountKeys.length) return { error: 'The prepared transaction asks for no signer; not sending it to your wallet.' };
  const payer = staticAccountKeys[0].toBase58();
  if (payer !== wallet) return { error: `The prepared transaction is paid by ${payer.slice(0, 4)}…${payer.slice(-4)}, not your wallet; not sending it to your wallet.` };
  return { tx };
}
