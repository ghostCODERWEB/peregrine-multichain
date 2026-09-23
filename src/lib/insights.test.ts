import { describe, it, expect } from 'vitest';
import { mapHeadline, frontsHeadline } from './insights';

const c = (chain: string, cpi: number | null, source: string | null = 'smart-money') => ({ chain, cpi, source });

describe('mapHeadline', () => {
  it('names the strongest inflow and outflow chains when both cross their bands', () => {
    expect(mapHeadline([c('base', 83), c('solana', 7), c('arbitrum', 50)], []))
      .toBe('Smart money is piling into Base; Solana is draining');
  });

  it('reports calm rather than inventing a pressure system when nothing crosses a band', () => {
    expect(mapHeadline([c('base', 60), c('solana', 40)], [])).toMatch(/^Calm/);
  });

  it('ignores market-flow chains — the headline is a smart-money claim', () => {
    expect(mapHeadline([c('near', 2, 'market-flow'), c('base', 83)], [])).toBe('Smart money is piling into Base');
  });

  it('says it is waiting when no chain has a smart-money reading yet', () => {
    expect(mapHeadline([c('base', null)], [])).toMatch(/^Waiting/);
  });
});

describe('frontsHeadline', () => {
  it('names the largest front with its size and wallet count', () => {
    expect(frontsHeadline([{ from: 'base', to: 'robinhood', netUsd: 5362, walletCount: 2 }]))
      .toBe('Capital is rotating from Base into Robinhood — $5.4K net across 2 wallets');
  });

  it('says plainly when there are no fronts', () => {
    expect(frontsHeadline([])).toMatch(/^No rotation fronts/);
  });
});
