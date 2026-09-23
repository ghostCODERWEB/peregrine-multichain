import { describe, it, expect, afterAll, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A throwaway database: getDb() reads TIDE_DB_PATH when it first opens.
const dir = await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-jobs-'));
  process.env.TIDE_DB_PATH = p.join(d, 'jobs.db');
  return d;
});

import { getDb } from '@/server/nansen/db';
import { enqueue, claim, complete, fail, recoverStale, backoffMs, getJob, jobHealth, STALE_MS } from './queue';
import { tick, scheduleRecurring, nextScanAt } from './worker';
import type { Handler } from './handlers';

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => { getDb().exec('DELETE FROM jobs; DELETE FROM scan_runs;'); });

const T0 = 1_800_000_000_000;
const quiet = () => {};

describe('job queue', () => {
  it('uses a throwaway database, not the real one', () => {
    expect(getDb().name).toBe(path.join(dir, 'jobs.db'));
    expect(os.tmpdir().length).toBeGreaterThan(0);
  });

  it('enqueues idempotently per dedupe key while a job is active', () => {
    const a = enqueue('scan', {}, { dedupeKey: 'scan' }, T0);
    const b = enqueue('scan', { other: 1 }, { dedupeKey: 'scan' }, T0);
    expect(a.created).toBe(true);
    expect(b).toEqual({ id: a.id, created: false });
    const j = claim('w', T0)!;
    complete(j.id, { ok: true }, T0 + 1);
    const c = enqueue('scan', {}, { dedupeKey: 'scan' }, T0 + 2);
    expect(c.created).toBe(true); // the finished job no longer blocks the key
    expect(enqueue('backtest', {}, {}, T0).created).toBe(true); // no key: always a new job
    expect(enqueue('backtest', {}, {}, T0).created).toBe(true);
  });

  it('claims only due jobs, oldest first, and only kinds it can run', () => {
    const later = enqueue('scan', {}, { runAt: T0 + 60_000 }, T0);
    const first = enqueue('storm-sweep', {}, { runAt: T0 - 10 }, T0);
    const second = enqueue('backtest', {}, { runAt: T0 - 5 }, T0);
    expect(claim('w', T0, ['scan'])).toBeNull(); // scan not due yet
    expect(claim('w', T0)!.id).toBe(first.id);
    const s = claim('w', T0)!;
    expect(s.id).toBe(second.id);
    expect(s.status).toBe('running');
    expect(s.attempts).toBe(1);
    expect(claim('w', T0)).toBeNull();
    expect(claim('w', T0 + 60_000)!.id).toBe(later.id);
  });

  it('retries with exponential backoff, then fails for good', () => {
    expect(backoffMs(1, 0)).toBe(30_000);
    expect(backoffMs(2, 0)).toBe(60_000);
    expect(backoffMs(3, 0)).toBe(120_000);
    expect(backoffMs(20, 0)).toBe(3_600_000);
    expect(backoffMs(1, 1)).toBe(36_000); // at most +20% jitter

    const { id } = enqueue('storm-sweep', {}, { maxAttempts: 2 }, T0);
    claim('w', T0);
    expect(fail(id, 'boom', T0, 0)).toBe('queued');
    expect(getJob(id)).toMatchObject({ status: 'queued', runAt: T0 + 30_000, lastError: 'boom' });
    expect(claim('w', T0 + 29_999)).toBeNull();
    claim('w', T0 + 30_000);
    expect(fail(id, 'boom again', T0 + 30_001, 0)).toBe('failed');
    expect(getJob(id)?.status).toBe('failed');
  });

  it('requeues jobs a dead worker left running', () => {
    const { id } = enqueue('scan', {}, {}, T0);
    claim('w', T0);
    expect(recoverStale(T0 + STALE_MS - 1)).toBe(0);
    expect(recoverStale(T0 + STALE_MS + 1)).toBe(1);
    expect(getJob(id)?.status).toBe('queued');
  });
});

describe('worker tick', () => {
  const ok: Handler = { run: async () => ({ fine: true }) };
  const boom: Handler = { run: async () => { throw new Error('nansen 503'); } };

  it('runs a due job and records the result', async () => {
    const { id } = enqueue('storm-sweep', {}, {}, T0);
    const r = await tick({ now: () => T0, handlers: { 'storm-sweep': ok }, log: quiet });
    expect(r.status).toBe('done');
    expect(getJob(id)?.status).toBe('done');
    expect((await tick({ now: () => T0, handlers: { 'storm-sweep': ok }, log: quiet })).status).toBe('idle');
  });

  it('leaves kinds it has no handler for in the queue', async () => {
    const { id } = enqueue('something-new', {}, {}, T0);
    expect((await tick({ now: () => T0, handlers: { scan: ok }, log: quiet })).status).toBe('idle');
    expect(getJob(id)?.status).toBe('queued');
  });

  it('turns a thrown error into a retry, then a failure', async () => {
    const { id } = enqueue('storm-sweep', {}, { maxAttempts: 2 }, T0);
    expect((await tick({ now: () => T0, handlers: { 'storm-sweep': boom }, log: quiet })).status).toBe('retry');
    expect((await tick({ now: () => T0 + 3_600_000, handlers: { 'storm-sweep': boom }, log: quiet })).status).toBe('failed');
    expect(getJob(id)?.lastError).toBe('nansen 503');
  });

  it('schedules the next scan from the last scan run, once per key', async () => {
    const every = 30 * 60_000;
    expect(nextScanAt(T0, every)).toBe(T0); // never scanned: due now
    getDb().prepare('INSERT INTO scan_runs (started_at) VALUES (?)').run(T0 - 10 * 60_000);
    expect(nextScanAt(T0, every)).toBe(T0 + 20 * 60_000); // restart does not scan early
    scheduleRecurring(T0, every);
    scheduleRecurring(T0, every);
    expect((getDb().prepare("SELECT COUNT(*) AS n FROM jobs WHERE kind = 'scan'").get() as { n: number }).n).toBe(1);

    // After a scan finishes, its successor is queued.
    getDb().prepare('INSERT INTO scan_runs (started_at) VALUES (?)').run(T0 + 20 * 60_000);
    const r = await tick({ now: () => T0 + 20 * 60_000, handlers: { scan: ok }, log: quiet, everyMs: every });
    expect(r.status).toBe('done');
    const next = getDb().prepare("SELECT run_at FROM jobs WHERE kind = 'scan' AND status = 'queued'").get() as { run_at: number };
    expect(next.run_at).toBe(T0 + 50 * 60_000);
  });

  it('reports health per kind', async () => {
    enqueue('storm-sweep', {}, {}, T0);
    await tick({ now: () => T0, handlers: { 'storm-sweep': ok }, log: quiet });
    enqueue('backtest', {}, { maxAttempts: 1 }, T0);
    await tick({ now: () => T0, handlers: { backtest: boom }, log: quiet });
    const h = Object.fromEntries(jobHealth(T0 + 1).map((x) => [x.kind, x]));
    expect(h['storm-sweep']).toMatchObject({ done24h: 1, failed24h: 0, lastDoneAt: T0 });
    expect(h.backtest).toMatchObject({ done24h: 0, failed24h: 1, lastError: 'nansen 503' });
  });
});
