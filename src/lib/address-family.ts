// What kind of thing did someone paste into the search box? Pure pattern
// matching, no network: the omnibox uses it to know which pages an input
// can open before asking Nansen anything. Several families share shapes
// (a 0x + 64-hex string is a Sui or Aptos address, a Starknet address, or
// an EVM transaction hash), so this returns every family that fits, most
// likely first, and never guesses one when the shape is ambiguous.

export type AddressFamily =
  | 'evm' | 'solana' | 'bitcoin' | 'sui' | 'aptos' | 'starknet' | 'ton' | 'tron' | 'near' | 'stellar' | 'injective' | 'mantra' | 'algorand';

export interface FamilyMatch {
  family: AddressFamily;
  /** Nansen chain ids this address can live on (profiler/token pages). */
  chains: string[];
  /** Nansen's profiler serves wallets of this family (else: say so). */
  profiled: boolean;
  /** A token id rather than a wallet (Sui coin types, `0x…::m::T`). */
  tokenOnly?: boolean;
}

export const EVM_CHAINS = [
  'ethereum', 'base', 'arbitrum', 'bnb', 'polygon', 'optimism', 'avalanche', 'linea', 'mantle', 'monad', 'sonic', 'sei',
  'hyperevm', 'plasma', 'arc', 'robinhood', 'iotaevm',
];

const B58 = '1-9A-HJ-NP-Za-km-z';
const RE = {
  evm: /^0x[0-9a-fA-F]{40}$/,
  hex64: /^0x[0-9a-fA-F]{64}$/,
  starknet: /^0x[0-9a-fA-F]{50,63}$/, // Starknet felts are often written without leading zeros
  suiCoin: /^0x[0-9a-fA-F]{1,64}::[A-Za-z_][A-Za-z0-9_]*::[A-Za-z_][A-Za-z0-9_]*$/,
  solana: new RegExp(`^[${B58}]{32,44}$`),
  btcLegacy: new RegExp(`^[13][${B58}]{25,34}$`),
  btcBech32: /^(bc1)[02-9ac-hj-np-z]{11,71}$/,
  tonFriendly: /^(EQ|UQ|kQ|0Q)[A-Za-z0-9_-]{46}$/,
  tonRaw: /^-?[01]:[0-9a-fA-F]{64}$/,
  tron: new RegExp(`^T[${B58}]{33}$`),
  near: /^(([a-z\d]+[-_])*[a-z\d]+\.)+(near|tg)$/,
  nearImplicit: /^[0-9a-f]{64}$/,
  stellar: /^G[A-Z2-7]{55}$/,
  injective: /^inj1[02-9ac-hj-np-z]{38}$/,
  mantra: /^mantra1[02-9ac-hj-np-z]{38}$/,
  algorand: /^[A-Z2-7]{58}$/,
};

/** Whether `address` can be a token id on `chain`. Strict where the format is unambiguous (EVM chains:
 *  0x + 40 hex; Solana: base58), permissive elsewhere (Sui coin types, Near accounts, TON, Tron…), so a
 *  typo'd URL answers 404 instead of a page that loads forever and spends credits trying. */
export function plausibleTokenAddress(chain: string, address: string): boolean {
  const a = address.trim();
  if (EVM_CHAINS.includes(chain)) return RE.evm.test(a);
  if (chain === 'solana') return RE.solana.test(a);
  return /^[A-Za-z0-9:._-]{3,160}$/.test(a);
}

/** Every family `input` could belong to, most likely first; empty when it
 *  is not an address at all (a name, a symbol, a sector). */
export function detectAddress(input: string): FamilyMatch[] {
  const q = input.trim();
  const out: FamilyMatch[] = [];
  if (RE.evm.test(q)) out.push({ family: 'evm', chains: EVM_CHAINS, profiled: true });
  if (RE.suiCoin.test(q)) out.push({ family: 'sui', chains: ['sui'], profiled: false, tokenOnly: true });
  if (RE.hex64.test(q)) {
    out.push({ family: 'sui', chains: ['sui'], profiled: true });
    out.push({ family: 'aptos', chains: [], profiled: false });
    out.push({ family: 'starknet', chains: ['starknet'], profiled: true });
  } else if (RE.starknet.test(q)) {
    out.push({ family: 'starknet', chains: ['starknet'], profiled: true });
  }
  if (RE.btcBech32.test(q)) out.push({ family: 'bitcoin', chains: ['bitcoin'], profiled: true });
  // Legacy Bitcoin (1…/3…, 26–35 chars) and Solana (32–44 chars) share
  // base58; a 1/3-prefixed string short enough for Bitcoin is listed as
  // Bitcoin first, and as Solana too when its length also fits.
  if (RE.btcLegacy.test(q)) out.push({ family: 'bitcoin', chains: ['bitcoin'], profiled: true });
  if (RE.tron.test(q)) out.push({ family: 'tron', chains: ['tron'], profiled: true });
  else if (RE.solana.test(q) && !/^0x/i.test(q)) out.push({ family: 'solana', chains: ['solana'], profiled: true });
  if (RE.tonFriendly.test(q) || RE.tonRaw.test(q)) out.push({ family: 'ton', chains: ['ton'], profiled: true });
  if (RE.near.test(q) || RE.nearImplicit.test(q)) out.push({ family: 'near', chains: ['near'], profiled: true });
  if (RE.stellar.test(q)) out.push({ family: 'stellar', chains: [], profiled: false });
  if (RE.injective.test(q)) out.push({ family: 'injective', chains: ['injective'], profiled: true });
  if (RE.mantra.test(q)) out.push({ family: 'mantra', chains: ['mantra'], profiled: true });
  if (RE.algorand.test(q) && !RE.stellar.test(q)) out.push({ family: 'algorand', chains: [], profiled: false });
  return out;
}

export const FAMILY_NAMES: Record<AddressFamily, string> = {
  evm: 'EVM', solana: 'Solana', bitcoin: 'Bitcoin', sui: 'Sui', aptos: 'Aptos', starknet: 'Starknet', ton: 'TON', tron: 'Tron',
  near: 'NEAR', stellar: 'Stellar', injective: 'Injective', mantra: 'Mantra', algorand: 'Algorand',
};

/**
 * The form to store and compare an address in: EVM hex is case-insensitive
 * (lowercased), everything else — base58 Solana and Tron, TON, Stellar — is
 * case-sensitive and kept exactly as Nansen returned it.
 */
/** Stored form of an address. Control characters are stripped first: Nansen has returned a
 *  Solana address with a trailing NUL byte, which broke its link and label. */
export const addressKey = (raw: string): string => {
  const a = raw.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  return /^0x[0-9a-fA-F]+$/.test(a) ? a.toLowerCase() : a;
};
