import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import fs from 'node:fs';

const dir = await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-health-'));
  process.env.TIDE_DB_PATH = p.join(d, 'health.db');
  return d;
});

import { getDb, getKv } from './db';
import { checkDrift, recordError, endpointHealth, driftLog } from './health';
import { recordCall } from './ledger';

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => { getDb().exec('DELETE FROM api_errors; DELETE FROM schema_drift; DELETE FROM credit_ledger;'); });

const T0 = 1_800_000_000_000;

describe('schema drift', () => {
  it('passes a response that matches the generated contract', () => {
    expect(checkDrift('chains/chain-rank', 'POST', { data: [], pagination: { page: 1, per_page: 10, is_last_page: true } }, T0)).toEqual([]);
  });

  it('records each distinct mismatch once, collapsing array indices, and counts repeats', () => {
    const bad = { data: [{ chain: 5 }, { chain: 6 }], pagination: { page: 1, per_page: 10, is_last_page: true } };
    const issues = checkDrift('chains/chain-rank', 'POST', bad, T0);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => !/\d/.test(i.path.replace(/per_page/, '')))).toBe(true); // "data[].chain", never "data.0.chain"
    checkDrift('chains/chain-rank', 'POST', bad, T0 + 1000);
    const log = driftLog();
    expect(log.length).toBe(issues.length);
    expect(log[0]).toMatchObject({ endpoint: 'chains/chain-rank', count: 2, firstSeen: T0, lastSeen: T0 + 1000 });
  });

  it('skips endpoints the contract has no response schema for', () => {
    expect(checkDrift('not/an/endpoint', 'POST', { anything: true }, T0)).toEqual([]);
  });
});

describe('endpoint health', () => {
  it('computes error rates from ledger successes and recorded failures', () => {
    for (let i = 0; i < 9; i++) recordCall('token-screener', 1, false);
    recordCall('token-screener', 0, true); // cache hits are not live calls
    recordError('token-screener', 503, 'upstream timeout');
    recordError('smart-alert/0123456789abcdef0123456789', 404, 'gone');
    const h = Object.fromEntries(endpointHealth(0).map((e) => [e.endpoint, e]));
    expect(h['token-screener']).toMatchObject({ live: 9, errors: 1, errorRate: 0.1, lastStatus: 503, lastError: 'upstream timeout' });
    expect(h['smart-alert/{id}']).toMatchObject({ live: 0, errors: 1, errorRate: 1 }); // ids grouped
  });

  it('records when health logging began on this database', () => {
    expect(Number(getKv('health_since')?.value)).toBeGreaterThan(0);
  });
});
