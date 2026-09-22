import { describe, it, expect } from 'vitest';
import { RateLimiter } from './limiter';

describe('RateLimiter', () => {
  it('lets calls under both the per-second and per-minute caps through immediately', async () => {
    const limiter = new RateLimiter('free'); // 15/s, 300/min
    const started = Date.now();
    for (let i = 0; i < 10; i++) await limiter.acquire();
    expect(Date.now() - started).toBeLessThan(200);
  });

  it('throttles once the per-second bucket is exhausted, without needing a full second per call', async () => {
    const limiter = new RateLimiter('free'); // 15/s
    const started = Date.now();
    for (let i = 0; i < 20; i++) await limiter.acquire();
    const elapsed = Date.now() - started;
    // 20 calls against a 15/s bucket must wait for the bucket to refill by
    // at least 5 tokens, but the bucket refills continuously (not once a
    // second), so this should land well under 1000ms and well over 0ms.
    expect(elapsed).toBeGreaterThan(50);
    expect(elapsed).toBeLessThan(1000);
  }, 3000);

  it('gives a pro-plan limiter a higher throughput than a free-plan one for the same burst', async () => {
    const free = new RateLimiter('free');
    const pro = new RateLimiter('pro');

    const time = async (limiter: RateLimiter, n: number) => {
      const started = Date.now();
      for (let i = 0; i < n; i++) await limiter.acquire();
      return Date.now() - started;
    };

    const freeMs = await time(free, 30);
    const proMs = await time(pro, 30);
    expect(proMs).toBeLessThan(freeMs);
  }, 5000);
});
