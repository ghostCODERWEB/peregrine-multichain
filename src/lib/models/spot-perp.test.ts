import { describe, it, expect } from 'vitest';
import { spotPerp } from './spot-perp';

describe('spot ↔ perp divergence', () => {
  it('joins by symbol (wrapped majors fold in), needs a lean on both sides, and ranks divergences first', () => {
    const d = spotPerp(
      [{ symbol: 'WETH', netflowUsd: 50_000, volumeUsd: 1e6 }, { symbol: 'SOL', netflowUsd: -40_000, volumeUsd: 1e6 }, { symbol: 'ARB', netflowUsd: 30_000, volumeUsd: 1e6 }, { symbol: 'TINY', netflowUsd: 9e3, volumeUsd: 1e4 }],
      [{ symbol: 'ETH', ppi: 30, openInterest: 1, smSkew: null }, { symbol: 'SOL', ppi: 70, openInterest: 1, smSkew: 0.2 }, { symbol: 'ARB', ppi: 80, openInterest: 1, smSkew: null }, { symbol: 'TINY', ppi: 90, openInterest: 1, smSkew: null }, { symbol: 'DOGE', ppi: 90, openInterest: 1, smSkew: null }],
    );
    expect(d.map((x) => [x.symbol, x.kind])).toEqual([['ETH', 'spot-buying-perps-short'], ['SOL', 'spot-selling-perps-long'], ['ARB', 'aligned-long']]);
    expect(d[0].spotShare).toBeCloseTo(0.05);
  });
  it('ignores weak leans', () => {
    expect(spotPerp([{ symbol: 'BTC', netflowUsd: 1e3, volumeUsd: 1e6 }], [{ symbol: 'BTC', ppi: 90, openInterest: 1, smSkew: null }])).toEqual([]);
  });
});
