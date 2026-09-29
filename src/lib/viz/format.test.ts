import { describe, it, expect } from 'vitest';
import { spanOf, walletName } from './format';

describe('walletName', () => {
  const a = '0x93ab12cd34ef56ab78cd90ef12ab34cd56ef7890';
  it('uses the address for a bare Nansen address tag', () => {
    expect(walletName('[0x93ab12]', a)).toBe('0x93ab…7890');
    // Solana-style tags and zero-width spaces (as Nansen sends them).
    const sol = 'FUmuuKhXaT7w2mbM2Xm5kNnDYFwH3ZExfjrztFmbbZVb';
    expect(walletName('[FUmuuKhX]', sol)).toBe('FUmuuK…bZVb');
    expect(walletName('High Balance [3LzmBquL]', sol)).toBe('High Balance ·bZVb');
    expect(walletName('\u200b\u200b🏦 OKX: Hot Wallet [8wM44Ryv]', sol)).toBe('OKX: Hot Wallet ·bZVb');
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

describe('spanOf', () => {
  const H = 3_600_000, D = 24 * H;
  it('names the full window once the history covers it', () => {
    expect(spanOf([0, 7 * D], 7)).toBe('7 days');
    expect(spanOf([0, 6.6 * D], 7)).toBe('7 days');
  });
  it('says what a young history really covers', () => {
    expect(spanOf([0, 18 * H], 7)).toBe('18 hours');
    expect(spanOf([0, 1 * H], 7)).toBe('1 hour');
    expect(spanOf([0, 3 * D], 7)).toBe('3 days');
    expect(spanOf([5], 7)).toBe('1 hour');
  });
});
