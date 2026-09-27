import { describe, expect, it } from 'vitest';
import { friendlyError } from './friendly-error';

describe('friendlyError', () => {
  it('names the unsupported chain', () => {
    expect(friendlyError(`Nansen v1beta1/tgm/historical-dex-trades responded 422: {"error":"Invalid value","message":"Invalid value 'robinhood' for body -> chain."}`)).toMatch(/^Not available on Robinhood/);
  });
  it('maps rate limits and outages', () => {
    expect(friendlyError('Nansen x responded 429: {}')).toMatch(/rate-limiting/);
    expect(friendlyError('Nansen call failed: fetch failed')).toMatch(/temporarily unavailable/);
  });
  it('explains demo-mode gaps without naming fixtures', () => {
    expect(friendlyError('No recorded fixture for tgm/perp-positions (request a9b1935a). Run with a real NANSEN_API_KEY once')).toMatch(/demo recording/);
  });
  it('leaves ordinary sentences alone', () => {
    expect(friendlyError('No holders yet.')).toBe('No holders yet.');
  });
});
