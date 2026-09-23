import { describe, it, expect } from 'vitest';
import { outflowThreshold, toChannel } from './alerts';

describe('outflowThreshold', () => {
  it('is more sensitive (lower) the stormier the token', () => {
    expect(outflowThreshold(90, 100_000_000)).toBeLessThan(outflowThreshold(10, 100_000_000));
    expect(outflowThreshold(90, 100_000_000)).toBe(Math.round(100_000_000 * 0.002 * 0.6));
  });
  it('clamps to $5K–$5M, including a token with no market cap', () => {
    expect(outflowThreshold(50, null)).toBe(5_000);
    expect(outflowThreshold(0, 1e13)).toBe(5_000_000);
  });
});

describe('toChannel', () => {
  it('accepts numeric Telegram chat ids, including group ids', () => {
    expect(toChannel({ type: 'telegram', chatId: '-1001234567' })).toEqual({ type: 'telegram', data: { chatId: '-1001234567' } });
  });
  it('rejects anything that is not a chat id or a Discord webhook', () => {
    expect(() => toChannel({ type: 'telegram', chatId: '@someone' })).toThrow();
    expect(() => toChannel({ type: 'discord', webhookUrl: 'not-a-webhook-url' })).toThrow();
    expect(() => toChannel({ type: 'discord', webhookUrl: 'http://discord.com/api/webhooks/1/x' })).toThrow();
  });
});
