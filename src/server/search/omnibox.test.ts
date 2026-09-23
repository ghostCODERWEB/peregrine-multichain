import { describe, it, expect } from 'vitest';
import { detectAddress } from '@/lib/address-family';
import { matchChains, matchSectors, tokenResults, entityResults, addressResults, type SearchResult } from './omnibox';
import type { GeneralSearchResponse } from '@/types/nansen/api.gen';

// Real search/general responses (recorded live, 2026-09-23) and Nansen's
// real sector list, so the routing is checked against what Nansen returns.
const SEARCH: Record<string, GeneralSearchResponse> = {
  pepe: { total_results: 5, entities: [], tokens: [
    { name: 'kPEPE', symbol: 'kPEPE', chain: 'hyperliquid', address: 'kPEPE', market_cap: 1837930993.94, rank: 50 },
    { name: 'Pepe', symbol: 'PEPE', chain: 'ethereum', address: '0x6982508145454ce325ddbe47a25d4ec3d2311933', market_cap: 1837930993.94, rank: 351 },
    { name: 'Pepe', symbol: 'PEPE', chain: 'bnb', address: '0x25d887ce7a35172c62febfd67a1856f20faebb00', market_cap: 1833829821.35864, rank: 352 },
  ] },
  aerodrome: { total_results: 5, entities: [], tokens: [
    { name: 'AERO', symbol: 'AERO', chain: 'hyperliquid', address: 'AERO', rank: 94 },
    { name: 'Aerodrome', symbol: 'AERO', chain: 'base', address: '0x940181a94a35a4569e4529a3cdfb74e38fd98631', market_cap: 673374137.51, rank: 405 },
  ] },
  binance: { total_results: 5, tokens: [
    { name: 'BNB', symbol: 'BNB', chain: 'hyperliquid', address: 'BNB', rank: 83 },
    { name: 'Binance Coin', symbol: 'BNB', chain: 'ethereum', address: '0xb8c77482e45f1f44de1745f52c74426c631bdd52', rank: 393 },
  ], entities: [{ name: 'Binance', tags: ['Finance', 'CeFi', 'CEX', 'Exchange'], rank: 41 }] },
  jump: { total_results: 5, tokens: [{ name: 'JumpToken', symbol: 'JMPT', chain: 'bnb', address: '0x88d7e9b65dc24cf54f5edef929225fc3e1580c25', rank: 2880 }],
    entities: [{ name: 'Jump Capital', tags: ['Finance', 'Fund', 'Market Maker'], rank: 10001 }] },
  nock: { total_results: 1, entities: [], tokens: [{ name: 'Nock', symbol: 'NOCK', chain: 'base', address: '0x9b5e262cf9bb04869ab40b19af91d2dc85761722', rank: 822 }] },
  usdcSol: { total_results: 1, entities: [], tokens: [{ name: 'USD Coin', symbol: 'USDC', chain: 'solana', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', rank: 615 }] },
  empty: { total_results: 0, tokens: [], entities: [] },
};
const SECTORS = ['AI Agents', 'AI Meme', 'Artificial Intelligence', 'DePIN', 'LSTs', 'Memecoin', 'Memecoins', 'RWAs', 'Restaking', 'Tokenized Stocks', 'x402'];

/** What the omnibox shows for a query, given Nansen's response to it. */
function resolve(q: string, found: GeneralSearchResponse): SearchResult[] {
  return detectAddress(q).length
    ? [...tokenResults(found), ...addressResults(q)]
    : [...matchChains(q), ...tokenResults(found), ...entityResults(found), ...matchSectors(q, SECTORS)];
}

// 20+ mixed queries: [query, Nansen response, expected first result].
const CASES: Array<[string, GeneralSearchResponse, Partial<SearchResult>]> = [
  ['pepe', SEARCH.pepe, { kind: 'token', href: '/token/ethereum/0x6982508145454ce325ddbe47a25d4ec3d2311933' }],
  ['aerodrome', SEARCH.aerodrome, { kind: 'token', href: '/token/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631' }],
  ['0x9b5e262cf9bb04869ab40b19af91d2dc85761722', SEARCH.nock, { kind: 'token', href: '/token/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722' }],
  ['EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', SEARCH.usdcSol, { kind: 'token', href: '/token/solana/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' }],
  ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', SEARCH.empty, { kind: 'wallet', href: '/wallet/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' }],
  ['base', SEARCH.empty, { kind: 'chain', href: '/chain/base' }],
  ['Solana', SEARCH.empty, { kind: 'chain', href: '/chain/solana' }],
  ['arb', SEARCH.empty, { kind: 'chain', href: '/chain/arbitrum' }],
  ['hyperliquid', SEARCH.empty, { kind: 'chain', href: '/chain/hyperliquid' }],
  ['binance', SEARCH.binance, { kind: 'token', href: '/token/ethereum/0xb8c77482e45f1f44de1745f52c74426c631bdd52' }],
  ['jump', SEARCH.jump, { kind: 'token' }],
  ['depin', SEARCH.empty, { kind: 'sector', href: '/sectors#DePIN' }],
  ['x402', SEARCH.empty, { kind: 'sector', href: '/sectors#x402' }],
  ['bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', SEARCH.empty, { kind: 'wallet', subtitle: expect.stringContaining('Bitcoin') as unknown as string }],
  ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', SEARCH.empty, { kind: 'wallet', subtitle: expect.stringContaining('Bitcoin') as unknown as string }],
  ['EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2', SEARCH.empty, { kind: 'wallet', subtitle: expect.stringContaining('TON') as unknown as string }],
  ['TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7', SEARCH.empty, { kind: 'wallet', subtitle: expect.stringContaining('Tron') as unknown as string }],
  ['0x5b2e0f1e6b1a2f1d6c7a0a3d4b1e0f2c3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d', SEARCH.empty, { kind: 'wallet', subtitle: expect.stringContaining('Sui') as unknown as string }],
  ['aurora.near', SEARCH.empty, { kind: 'wallet', subtitle: expect.stringContaining('NEAR') as unknown as string }],
  ['inj1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh7', SEARCH.empty, { kind: 'wallet', subtitle: expect.stringContaining('Injective') as unknown as string }],
  ['GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ', SEARCH.empty, { kind: 'note', href: null }],
  ['0x2::sui::SUI', SEARCH.empty, {}], // a coin type: tokens only (none here), never a wallet
];

describe('omnibox: 20+ mixed queries resolve to the right page', () => {
  for (const [q, found, want] of CASES) {
    it(q, () => {
      const results = resolve(q, found);
      if (!Object.keys(want).length) {
        expect(results.filter((r) => r.kind === 'wallet')).toEqual([]);
        return;
      }
      expect(results[0]).toMatchObject(want);
    });
  }
});

describe('omnibox rules', () => {
  it('never links Hyperliquid perps as token pages', () => {
    expect(tokenResults(SEARCH.pepe).map((r) => r.href)).not.toContain('/token/hyperliquid/kPEPE');
  });

  it('lists entities with their tags and routes to the entity page', () => {
    expect(entityResults(SEARCH.binance)[0]).toMatchObject({ title: 'Binance', href: '/entity/Binance', subtitle: expect.stringContaining('CEX') });
  });

  it('a contract address also offers the wallet page', () => {
    const r = resolve('0x9b5e262cf9bb04869ab40b19af91d2dc85761722', SEARCH.nock);
    expect(r.map((x) => x.kind)).toEqual(['token', 'wallet']);
  });
});

describe('address families', () => {
  it('lists every family an ambiguous shape fits, and none for plain text', () => {
    expect(detectAddress('0x' + 'a'.repeat(64)).map((f) => f.family)).toEqual(['sui', 'aptos', 'starknet']);
    expect(detectAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa').map((f) => f.family)).toEqual(['bitcoin', 'solana']);
    expect(detectAddress('pepe')).toEqual([]);
    expect(detectAddress('0xnothex0000000000000000000000000000000000')).toEqual([]);
  });
});
