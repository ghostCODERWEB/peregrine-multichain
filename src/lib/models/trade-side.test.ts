import { describe, it, expect } from 'vitest';
import { isBaseAsset, isStablecoin, classifySwap } from './trade-side';

describe('isBaseAsset', () => {
  it('recognizes stablecoins and native/wrapped-native tokens, case-insensitively', () => {
    for (const s of ['USDC', 'usdt', 'WETH', 'sol', 'WBNB', 'USDC.e']) expect(isBaseAsset(s), s).toBe(true);
  });

  it('does not treat a risk token as a base asset', () => {
    for (const s of ['PEPE', 'AAVE', 'WBTC', 'LINK', 'JUP']) expect(isBaseAsset(s), s).toBe(false);
  });

  it('does not pattern-match: a token merely containing "USD" is not cash', () => {
    expect(isBaseAsset('USDFARM')).toBe(false);
  });

  it('is false for null, undefined and empty symbols', () => {
    expect(isBaseAsset(null)).toBe(false);
    expect(isBaseAsset(undefined)).toBe(false);
    expect(isBaseAsset('')).toBe(false);
  });
});

describe('isStablecoin', () => {
  it('catches the non-EVM stables Nansen\'s screener filter lets through', () => {
    for (const s of ['SBUSDT', 'USDSUI', 'BUCK', 'usdd']) expect(isStablecoin(s)).toBe(true);
  });
  it('does not treat natives or USD-named risk tokens as stables', () => {
    for (const s of ['WETH', 'SOL', 'USDX-MEME', 'SUSHI', null]) expect(isStablecoin(s)).toBe(false);
  });
});

describe('classifySwap', () => {
  it('classifies base -> risk as a buy of the risk token', () => {
    const r = classifySwap({
      token_sold_symbol: 'USDC', token_sold_address: '0xusdc',
      token_bought_symbol: 'PEPE', token_bought_address: '0xpepe',
    });
    expect(r).toEqual({ side: 'buy', tokenAddress: '0xpepe', tokenSymbol: 'PEPE' });
  });

  it('classifies risk -> base as a sell of the risk token', () => {
    const r = classifySwap({
      token_sold_symbol: 'AAVE', token_sold_address: '0xaave',
      token_bought_symbol: 'WETH', token_bought_address: '0xweth',
    });
    expect(r).toEqual({ side: 'sell', tokenAddress: '0xaave', tokenSymbol: 'AAVE' });
  });

  it('returns null for risk -> risk (rotation within one chain, not across chains)', () => {
    expect(classifySwap({
      token_sold_symbol: 'AAVE', token_sold_address: '0xa',
      token_bought_symbol: 'LINK', token_bought_address: '0xl',
    })).toBeNull();
  });

  it('returns null for base -> base (moving between cash equivalents)', () => {
    expect(classifySwap({
      token_sold_symbol: 'USDC', token_sold_address: '0xu',
      token_bought_symbol: 'WETH', token_bought_address: '0xw',
    })).toBeNull();
  });

  it('returns null rather than inventing an address when the risk side has none', () => {
    expect(classifySwap({ token_sold_symbol: 'USDC', token_bought_symbol: 'PEPE' })).toBeNull();
  });
});
