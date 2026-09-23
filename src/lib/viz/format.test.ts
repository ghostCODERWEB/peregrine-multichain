import { describe, it, expect } from 'vitest';
import { walletName } from './format';

describe('walletName', () => {
  const a = '0x93ab12cd34ef56ab78cd90ef12ab34cd56ef7890';
  it('uses the address for a bare Nansen address tag', () => {
    expect(walletName('[0x93ab12]', a)).toBe('0x93ab…7890');
    expect(walletName(null, a)).toBe('0x93ab…7890');
  });
  it('keeps named entities as they are', () => {
    expect(walletName('Binance 14', a)).toBe('Binance 14');
  });
  it('shortens a behavioral label’s tag to the address tail', () => {
    expect(walletName('High Balance [0x93ab12]', a)).toBe('High Balance ·7890');
  });
});

describe('amount', () => {
  it('drops the sign and compacts', async () => {
    const { amount } = await import('./format');
    expect(amount(-0.025)).toBe('0.0250');
    expect(amount(-2_730_000)).toBe('2.73M');
    expect(amount(187)).toBe('187');
  });
});
