import { describe, expect, it } from 'vitest';
import { farmerStyle, perpStyle, walletWeather, type WalletWeatherPosition } from './wallet-weather';

const positions: WalletWeatherPosition[] = [
  { chain: 'base', tokenAddress: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', symbol: 'AERO', valueUsd: 600 },
  { chain: 'base', tokenAddress: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', symbol: 'USDC', valueUsd: 200 },
  { chain: 'ethereum', tokenAddress: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC', symbol: 'WETH', valueUsd: 200 },
];

describe('wallet weather', () => {
  it('keeps concentration, stability and effective positions inspectable', () => {
    const p = walletWeather(positions, { exits: 2, tradedTokens: 1 }, []);
    expect(p.totalUsd).toBe(1_000);
    expect(p.largestPosition?.share).toBe(.6);
    expect(p.largestChain?.share).toBe(.8);
    expect(p.stableShare).toBe(.2);
    expect(p.effectivePositions).toBeCloseTo(2.2727, 3);
    expect(p.style.primary).toBe('holder');
  });

  it('weights Storm only over scored non-stables and exposes missing coverage', () => {
    const at = Date.now();
    const p = walletWeather(positions, { exits: 8, tradedTokens: 4 }, [
      { chain: 'base', tokenAddress: positions[0].tokenAddress.toLowerCase(), score: 80, at },
      // Stablecoin Storm observations do not belong in risk-asset exposure.
      { chain: 'base', tokenAddress: positions[1].tokenAddress, score: 1, at },
    ]);
    expect(p.storm.score).toBe(80);
    expect(p.storm.coveredUsd).toBe(600);
    expect(p.storm.coverage).toBe(.75);
    expect(p.headline).toMatch(/High dump-risk exposure/);
    expect(p.style.primary).toBe('mixed');
  });

  it('never turns missing Storm data into a safe zero', () => {
    const p = walletWeather(positions, { exits: 25, tradedTokens: 3 }, []);
    expect(p.storm.score).toBeNull();
    expect(p.storm.coverage).toBe(0);
    expect(p.riskState).toBe('partial');
    expect(p.style.primary).toBe('trader');
  });

  it('deduplicates EVM contracts case-insensitively and keeps the newest score', () => {
    const token = positions[0];
    const p = walletWeather([token, { ...token, tokenAddress: token.tokenAddress.toLowerCase(), valueUsd: 400 }], { exits: 0, tradedTokens: 0 }, [
      { chain: 'base', tokenAddress: token.tokenAddress, score: 20, at: 1 },
      { chain: 'base', tokenAddress: token.tokenAddress.toLowerCase(), score: 70, at: 2 },
    ]);
    expect(p.positionCount).toBe(1);
    expect(p.totalUsd).toBe(1_000);
    expect(p.storm.score).toBe(70);
  });

  it('makes a stable-heavy state explicit without requiring a Storm score', () => {
    const p = walletWeather([
      { chain: 'base', tokenAddress: 'stable', symbol: 'USDC', valueUsd: 700 },
      { chain: 'base', tokenAddress: 'risk', symbol: 'AERO', valueUsd: 300 },
    ], { exits: 0, tradedTokens: 0 }, []);
    expect(p.riskState).toBe('stable');
    expect(p.headline).toBe('Stable-heavy spot balance');
  });

  it('categorizes optional farming and perp evidence only after it is supplied', () => {
    expect(farmerStyle({ kind: 'farmer', protocols: 4, valueUsd: 10 }, 1_000)).toBe('high');
    expect(farmerStyle({ kind: 'farmer', protocols: 1, valueUsd: 10 }, 1_000)).toBe('moderate');
    expect(farmerStyle({ kind: 'farmer', protocols: 0, valueUsd: 0 }, 1_000)).toBe('light');
    expect(perpStyle({ kind: 'perp', openPositions: 1, fills30d: 2, closedTrades30d: 0 })).toBe('moderate');
    expect(perpStyle({ kind: 'perp', openPositions: 0, fills30d: 25, closedTrades30d: null })).toBe('high');
    expect(perpStyle({ kind: 'perp', openPositions: null, fills30d: 0, closedTrades30d: null })).toBeNull();
  });
});
