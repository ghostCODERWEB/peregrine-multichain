// Dump Risk v2 pilot runner on a mocked client: a small screener universe,
// point-in-time endpoints with sparse data. Checks the report's accounting
// and that the credit cap stops the run.
import { describe, it, expect, afterAll, vi } from 'vitest';
import fs from 'node:fs';

const dir = await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-v2-'));
  process.env.TIDE_DB_PATH = p.join(d, 'v2.db');
  return d;
});

const NOW = Date.UTC(2026, 8, 1);
const seen: string[] = [];
vi.mock('@/server/nansen/client', () => ({
  callNansen: async (endpoint: string) => {
    seen.push(endpoint);
    if (endpoint.endsWith('token-screener/historical')) {
      return { data: { data: Array.from({ length: 3 }, (_, i) => ({ token_address: `0x${String(i + 1).padStart(40, '0')}`, token_symbol: `T${i}`, market_cap_usd: 1e7, liquidity: 1e6, volume: 1e6, token_age_days: 90, price_usd: 2 + i })) }, meta: { creditsCost: 5 } };
    }
    if (endpoint.endsWith('historical-token-ohlcv')) {
      return { data: { data: Array.from({ length: 12 }, (_, d) => ({ interval_start: new Date(NOW - (40 - d) * 86_400_000).toISOString(), open: 1, high: 1.05, low: d > 6 ? 0.4 : 0.95, close: d > 6 ? 0.45 : 1 })) }, meta: { creditsCost: 1 } };
    }
    return { data: { data: [] }, meta: { creditsCost: 1 } };
  },
}));

import { runStormV2 } from './storm-v2';

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('runStormV2', () => {
  it('builds a pilot report with its costs and coverage', async () => {
    const r = await runStormV2({ cap: 10_000, now: NOW, anchorsDaysAgo: [40], perAnchor: 3, kind: 'pilot' });
    expect(r.kind).toBe('pilot');
    expect(r.calls).toBeGreaterThan(3);
    expect(r.creditsNominal).toBeGreaterThanOrEqual(r.creditsSpent);
    expect(Object.keys(r.coverage)).toContain('label');
    expect(seen).toContain('v1beta1/tgm/historical-token-quant-scores');
  });
  it('stops at its cap and still reports what it spent', async () => {
    const r = await runStormV2({ cap: 6, now: NOW, anchorsDaysAgo: [40], perAnchor: 3 });
    expect(r.creditsNominal).toBeLessThanOrEqual(6);
    expect(r.observations.length).toBe(0);
  });
});
