// The backtest runner on a synthetic, deterministic universe (mocked client):
// half the tokens dump within a week of their anchor, a few break out, so the
// pipeline has both labels to score. Checks the run completes, reports what
// it would cost, and never spends past its cap.
import { describe, it, expect, afterAll, vi } from 'vitest';
import fs from 'node:fs';

const dir = await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-bt-'));
  process.env.TIDE_DB_PATH = p.join(d, 'bt.db');
  return d;
});

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 1);
const addr = (chain: string, i: number) => `0x${chain.slice(0, 4).padEnd(4, '0')}${String(i).padStart(36, '0')}`;
vi.mock('@/server/nansen/client', () => ({
  callNansen: async (endpoint: string, body: Record<string, unknown>) => {
    if (endpoint === 'v1beta1/token-screener/historical') {
      const chain = String((body.chains as string[])[0]);
      const data = Array.from({ length: 24 }, (_, i) => ({
        token_address: addr(chain, i), token_symbol: `T${i}`, chain, price_usd: 1, price_change: (i % 5) / 10 - 0.2,
        market_cap_usd: 5e6 * (1 + i), fdv: 6e6 * (1 + i), fdv_mc_ratio: 1.2, volume: 1e6, buy_volume: 5e5, sell_volume: 5e5 + i * 1e4,
        netflow: (i % 2 ? 1 : -1) * 1e4 * i, inflow_fdv_ratio: 0.01, outflow_fdv_ratio: 0.01 + i / 1000, token_age_days: 30 + i, liquidity: 2e5 * (1 + (i % 4)),
      }));
      return { data: { data }, meta: { creditsCost: 5 } };
    }
    if (endpoint === 'tgm/token-ohlcv') {
      const tokens = (body.token_addresses as string[]).map((a) => {
        const i = Number(a.slice(-3));
        const fate = i % 4 === 0 ? 'dump' : i % 7 === 0 ? 'pump' : 'flat';
        const data = Array.from({ length: 75 }, (_, d) => {
          const t = NOW - (74 - d) * DAY;
          const late = d % 14 > 7; // every other week of the path moves
          const c = fate === 'dump' && late ? 0.4 : fate === 'pump' && late ? 1.5 : 1 + 0.02 * Math.sin(d);
          return { interval_start: new Date(t).toISOString(), high: c * 1.03, low: c * 0.97, close: c };
        });
        return { token_address: a, data };
      });
      return { data: { tokens }, meta: { creditsCost: 1 } };
    }
    throw new Error(`unexpected ${endpoint}`);
  },
}));

import { runBacktest, estimateCredits } from './run';

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('runBacktest (synthetic universe)', () => {
  it('completes with scored models, costs and requests listed', async () => {
    const logs: string[] = [];
    const r = await runBacktest({ cap: 100_000, now: NOW, log: (s) => logs.push(s) });
    expect(logs[0]).toMatch(/estimate: ~\d+ credits/);
    expect(r.requests.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).toMatch(/auc|AUC/);
  }, 60_000);

  it('refuses to spend past its cap', async () => {
    await expect(runBacktest({ cap: 12, now: NOW })).rejects.toThrow(/BACKTEST_CREDIT_CAP/);
  });

  it('estimates screener and candle calls', () => {
    expect(estimateCredits(['base'], ['base'])).toBe(4 * 2 * 5 + Math.ceil((60 * 1.6) / 10));
  });
});
