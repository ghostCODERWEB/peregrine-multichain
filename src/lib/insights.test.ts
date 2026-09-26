import { describe, it, expect } from 'vitest';
import { mapHeadline, frontsHeadline } from './insights';

const c = (chain: string, cpi: number | null, source: string | null = 'smart-money') => ({ chain, cpi, source });

describe('mapHeadline', () => {
  it('names the strongest inflow and outflow chains when both cross their bands', () => {
    expect(mapHeadline([c('base', 83), c('solana', 7), c('arbitrum', 50)], []))
      .toBe('Smart money accumulating Base; distributing Solana');
  });

  it('reports calm rather than inventing a pressure system when nothing crosses a band', () => {
    expect(mapHeadline([c('base', 60), c('solana', 40)], [])).toMatch(/^Neutral flows/);
  });

  it('ignores market-flow chains — the headline is a smart-money claim', () => {
    expect(mapHeadline([c('near', 2, 'market-flow'), c('base', 83)], [])).toBe('Smart money accumulating Base');
  });

  it('says it is waiting when no chain has a reading yet', () => {
    expect(mapHeadline([c('base', null)], [])).toMatch(/^Waiting/);
  });

  it('reads all-trader pressure when there is no smart-money reading (the public view)', () => {
    expect(mapHeadline([c('linea', 78, 'market-flow'), c('monad', 9, 'market-flow'), c('base', null)], []))
      .toBe('Inflows lead on Linea; outflows on Monad');
    expect(mapHeadline([c('linea', 50, 'market-flow')], [])).toBe('Neutral flows across chains, no all-trader reading above 65 or below 35');
  });
});

describe('frontsHeadline', () => {
  it('names the largest front with its size and wallet count', () => {
    expect(frontsHeadline([{ from: 'base', to: 'robinhood', netUsd: 5362, walletCount: 2 }]))
      .toBe('Capital rotating Base → Robinhood: $5.4K net, 2 wallets');
  });

  it('says plainly when there are no fronts', () => {
    expect(frontsHeadline([])).toMatch(/^No capital rotations/);
  });
});

describe('mapHeadline with calm pressure', () => {
  it('names a rotation front when no chain is under pressure', async () => {
    const { mapHeadline } = await import('./insights');
    const chains = [{ chain: 'base', cpi: 55, source: 'smart-money' }, { chain: 'ethereum', cpi: 45, source: 'smart-money' }];
    expect(mapHeadline(chains, [{ from: 'robinhood', to: 'base', netUsd: 9000, walletCount: 3 }])).toBe('Neutral flows; capital rotating Robinhood → Base');
    expect(mapHeadline(chains, [])).toMatch(/^Neutral flows across chains/);
  });
});
