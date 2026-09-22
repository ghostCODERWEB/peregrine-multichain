// Token-bucket rate limiter sized by plan.
//
// Nansen's limits are dual-window: free is 15 req/s AND 300 req/min, pro is
// 75 req/s AND 1,500 req/min. A caller that only respected the per-second
// bucket could still burst 300+ requests inside a minute on free and get
// 429'd, so both buckets are checked and both must have room before a call
// is allowed through.
//
// One process-wide limiter, since the scanner worker and any request
// handler share the same daily key and the same real rate limit at Nansen's
// edge regardless of which part of this app is asking.

export type NansenPlan = 'free' | 'pro';

interface PlanLimits {
  perSecond: number;
  perMinute: number;
}

const PLAN_LIMITS: Record<NansenPlan, PlanLimits> = {
  free: { perSecond: 15, perMinute: 300 },
  pro: { perSecond: 75, perMinute: 1_500 },
};

class Bucket {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(private readonly capacity: number, private readonly windowMs: number) {
    this.tokens = capacity;
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed <= 0) return;
    const refillRate = this.capacity / this.windowMs;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * refillRate);
    this.lastRefill = now;
  }

  /** Seconds to wait before this bucket would have at least one token. */
  msUntilToken(): number {
    this.refill();
    if (this.tokens >= 1) return 0;
    const refillRate = this.capacity / this.windowMs;
    return Math.ceil((1 - this.tokens) / refillRate);
  }

  tryTake(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export class RateLimiter {
  private readonly perSecond: Bucket;
  private readonly perMinute: Bucket;

  constructor(plan: NansenPlan) {
    const limits = PLAN_LIMITS[plan];
    this.perSecond = new Bucket(limits.perSecond, 1_000);
    this.perMinute = new Bucket(limits.perMinute, 60_000);
  }

  /** Blocks until both buckets have a token, then takes one from each. */
  async acquire(): Promise<void> {
    for (;;) {
      const waitMs = Math.max(this.perSecond.msUntilToken(), this.perMinute.msUntilToken());
      if (waitMs === 0) {
        // Both were ready as of the check above, but refill happens lazily
        // inside tryTake, so re-check atomically rather than trusting the
        // msUntilToken snapshot across the two calls.
        if (this.perSecond.tryTake() && this.perMinute.tryTake()) return;
        continue;
      }
      await sleep(waitMs);
    }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let singleton: RateLimiter | null = null;
let singletonPlan: NansenPlan | null = null;

/** One limiter per process, re-created only if the configured plan changes. */
export function getLimiter(plan: NansenPlan): RateLimiter {
  if (!singleton || singletonPlan !== plan) {
    singleton = new RateLimiter(plan);
    singletonPlan = plan;
  }
  return singleton;
}
