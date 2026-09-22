import { describe, it, expect } from 'vitest';
import { endpointSupports, classifyChain } from './capabilities';

describe('endpointSupports', () => {
  it('does not treat the "all" wildcard sentinel as universal support', () => {
    // Regression test for a real bug: smartMoneyNetflows' enum includes
    // "all" as a request-time wildcard, and a naive `.includes(chain) ||
    // .includes('all')` check silently marked every chain in the universe
    // as Smart Money-supported. sui is not in that enum and must read false.
    expect(endpointSupports('smartMoneyNetflows', 'sui')).toBe(false);
    expect(endpointSupports('smartMoneyNetflows', 'bitcoin')).toBe(false);
  });

  it('is true for a chain genuinely present in the endpoint\'s enum', () => {
    expect(endpointSupports('smartMoneyNetflows', 'ethereum')).toBe(true);
    expect(endpointSupports('smartMoneyNetflows', 'solana')).toBe(true);
  });

  it('is false for a chain not documented anywhere for that endpoint', () => {
    expect(endpointSupports('smartMoneyNetflows', 'algorand')).toBe(false);
  });
});

describe('classifyChain', () => {
  it('classifies ethereum as Tier A (Smart Money + TGM + Profiler all present)', () => {
    const c = classifyChain('ethereum');
    expect(c.tier).toBe('A');
    expect(c.smartMoney).toBe(true);
    expect(c.tokenGodMode).toBe(true);
    expect(c.profiler).toBe(true);
  });

  it('classifies sui as Tier B (TGM + Profiler, no Smart Money) — matches the spec\'s own snapshot', () => {
    const c = classifyChain('sui');
    expect(c.tier).toBe('B');
    expect(c.smartMoney).toBe(false);
  });

  it('classifies hyperliquid as the perp tier regardless of its other endpoint support', () => {
    const c = classifyChain('hyperliquid');
    expect(c.tier).toBe('perp');
    expect(c.perp).toBe(true);
  });

  it('classifies an undocumented chain as Tier C', () => {
    const c = classifyChain('algorand');
    expect(c.tier).toBe('C');
  });

  it('reproduces the spec\'s exact tier snapshot for the full 38-chain roster', () => {
    // This is the load-bearing check: the buildathon spec hand-classified
    // every chain in section 3, and the whole point of deriving tiers from
    // the documented enums instead is that it should land on the same
    // answer — a mismatch here means either the enum extraction or this
    // classification logic has a real bug, not that the spec is wrong.
    const expectedTierA = [
      'arbitrum', 'arc', 'avalanche', 'base', 'bnb', 'ethereum', 'hyperevm', 'iotaevm',
      'linea', 'mantle', 'monad', 'optimism', 'plasma', 'polygon', 'robinhood', 'sei', 'solana', 'sonic',
    ];
    const expectedTierB = ['bitcoin', 'injective', 'mantra', 'near', 'starknet', 'sui', 'ton', 'tron'];
    const expectedTierC = [
      'algorand', 'aptos', 'bitlayer', 'chiliz', 'citrea', 'gravity', 'katana', 'metis', 'stacks', 'stellar', 'viction',
    ];

    for (const chain of expectedTierA) expect(classifyChain(chain).tier, chain).toBe('A');
    for (const chain of expectedTierB) expect(classifyChain(chain).tier, chain).toBe('B');
    for (const chain of expectedTierC) expect(classifyChain(chain).tier, chain).toBe('C');
    expect(classifyChain('hyperliquid').tier).toBe('perp');
  });
});
