import { describe, it, expect } from 'vitest';
import { LEDGER, EXTRA_ENDPOINTS, ALL_LEDGER, coverageStats } from './endpoint-ledger';
import { ENDPOINTS } from '@/types/nansen/api.gen';

describe('endpoint ledger', () => {
  it('accounts for every operation the docs publish a schema for', () => {
    const inLedger = new Set(LEDGER.map((l) => l.key));
    const missing = Object.keys(ENDPOINTS).filter((k) => !inLedger.has(k));
    expect(missing).toEqual([]);
  });

  it('has no stale entries for operations the docs no longer list', () => {
    const documented = new Set(Object.keys(ENDPOINTS));
    expect(LEDGER.map((l) => l.key).filter((k) => !documented.has(k))).toEqual([]);
  });

  it('gives every entry a status: used, planned, or skipped with a reason', () => {
    const bad = ALL_LEDGER.filter((l) => !l.usedBy?.length && !l.planned && !l.skipped?.trim());
    expect(bad.map((l) => l.key)).toEqual([]);
  });

  it('has unique keys', () => {
    const keys = ALL_LEDGER.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never marks a prohibited endpoint as public-safe', () => {
    for (const l of ALL_LEDGER.filter((x) => /labels|smart-money\/(holdings|dex-trades|dcas|perp-trades|pnl-leaderboard|historical-holdings)|pnl-leaderboard|perp-leaderboard/.test(x.key))) {
      expect(['prohibited', 'restricted']).toContain(l.class);
    }
  });

  // Flip on (SUPERAPP_DONE=1) once every module has shipped: nothing may
  // remain merely planned, and at least 90% must be used.
  it.runIf(process.env.SUPERAPP_DONE === '1')('meets the superapp coverage goal', () => {
    const s = coverageStats();
    expect(s.planned).toBe(0);
    expect(s.usedPct).toBeGreaterThanOrEqual(0.9);
  });

  it('knows the extra, schema-less operations', () => {
    expect(EXTRA_ENDPOINTS.some((x) => x.key === 'GET /api/v1/account')).toBe(true);
  });
});
