import { describe, it, expect } from 'vitest';
import { parseAction } from './actions';

describe('terminal commands', () => {
  const coins = ['BTC', 'ETH'];
  it('turns imperative requests into explicit filters', () => {
    expect(parseAction('Show only Smart Money longs above $1m with 10x+', coins)).toEqual({ patch: { cohort: 'smart_money', side: 'long', minLeverage: 10, minUsd: 1_000_000 }, applied: ['Smart Money', 'Longs', '10x+', '$1M+'] });
    expect(parseAction('Highlight liquidation exposure within 5% of price', coins)?.patch).toEqual({ range: 0.05, tab: 'proximity' });
    expect(parseAction('Show what changed in 4h', coins)?.patch).toEqual({ tab: 'changes', win: '4h' });
    expect(parseAction('Compare whales and smart money', coins)?.patch).toMatchObject({ cohort: 'smart_money', tab: 'cohorts' });
  });
  it('navigates to coins and wallets', () => {
    expect(parseAction('Switch to ETH', coins)?.navigate).toBe('/perps/ETH');
    expect(parseAction(`Open wallet 0x${'a'.repeat(40)}`, coins)?.navigate).toBe(`/wallet/0x${'a'.repeat(40)}`);
  });
  it('leaves questions to the agent', () => {
    expect(parseAction('Why did Smart Money reduce longs?', coins)).toBeNull();
    expect(parseAction('Show me', coins)).toBeNull();
  });
});
