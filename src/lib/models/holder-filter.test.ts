import { describe, it, expect } from 'vitest';
import { nonHolderKind } from './holder-filter';

describe('nonHolderKind', () => {
  it('keeps ordinary holders, including behavioral labels and bare addresses', () => {
    for (const l of ['Token Millionaire', 'High Balance', 'High Activity', 'Smart Trader', '[0x4356d2]', null, '']) {
      expect(nonHolderKind(l)).toBeNull();
    }
  });

  it('keeps team, treasury and multisig wallets — they can sell', () => {
    for (const l of ['Project Treasury', 'Team Multisig', 'Gnosis Safe']) expect(nonHolderKind(l)).toBeNull();
  });

  it('drops AMM pools, including pair-style labels seen live on Base', () => {
    expect(nonHolderKind('vAMM-USDC/NOCK')).toBe('pool');
    expect(nonHolderKind('Uniswap V3: WETH-USDC 0.05%')).toBe('pool');
  });

  it('drops exchanges, bridges, contracts and burn addresses', () => {
    expect(nonHolderKind('Coinbase: Hot Wallet')).toBe('exchange');
    expect(nonHolderKind('Binance 14')).toBe('exchange');
    expect(nonHolderKind('Base: Bridge')).toBe('bridge');
    expect(nonHolderKind('Token Vesting Contract')).toBe('contract');
    expect(nonHolderKind('Burn Address')).toBe('burn');
  });
});
