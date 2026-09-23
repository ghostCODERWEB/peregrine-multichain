// A small durable job queue in the shared SQLite file: the web process
// enqueues, the worker (`pnpm worker`) claims and runs. Enqueueing is
// idempotent per dedupe key (one queued-or-running job per key), failures
// retry with exponential backoff, and jobs left `running` by a crashed
// worker are put back after STALE_MS.
import { getDb } from '@/server/nansen/db';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface Job {
  id: number;
  kind: string;
  dedupeKey: string | null;
  payload: unknown;
  status: JobStatus;
  runAt: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
}

interface Row {
  id: number; kind: string; dedupe_key: string | null; payload: string; status: JobStatus;
  run_at: number; attempts: number; max_attempts: number; last_error: string | null;
}

const toJob = (r: Row): Job => ({
  id: r.id, kind: r.kind, dedupeKey: r.dedupe_key, payload: JSON.parse(r.payload) as unknown, status: r.status,
  runAt: r.run_at, attempts: r.attempts, maxAttempts: r.max_attempts, lastError: r.last_error,
});

/** A job running this long was abandoned by a worker that died. */
export const STALE_MS = 2 * 3_600_000;

/**
 * Queue a job. With a dedupe key, returns the existing active job's id
 * instead of adding a second one.
 */
export function enqueue(kind: string, payload: unknown = {}, opts: { runAt?: number; dedupeKey?: string; maxAttempts?: number } = {}, now = Date.now()): { id: number; created: boolean } {
  const db = getDb();
  const r = db.prepare(`
    INSERT OR IGNORE INTO jobs (kind, dedupe_key, payload, status, run_at, max_attempts, created_at)
    VALUES (?, ?, ?, 'queued', ?, ?, ?)
  `).run(kind, opts.dedupeKey ?? null, JSON.stringify(payload ?? {}), opts.runAt ?? now, opts.maxAttempts ?? 3, now);
  if (r.changes > 0) return { id: Number(r.lastInsertRowid), created: true };
  const existing = db.prepare("SELECT id FROM jobs WHERE dedupe_key = ? AND status IN ('queued', 'running')").get(opts.dedupeKey ?? null) as { id: number };
  return { id: existing.id, created: false };
}

/** Atomically take the oldest due job (optionally only of some kinds). */
export function claim(worker: string, now = Date.now(), kinds?: string[]): Job | null {
  const filter = kinds?.length ? `AND kind IN (${kinds.map(() => '?').join(',')})` : '';
  const r = getDb().prepare(`
    UPDATE jobs SET status = 'running', attempts = attempts + 1, locked_by = ?, locked_at = ?
    WHERE id = (SELECT id FROM jobs WHERE status = 'queued' AND run_at <= ? ${filter} ORDER BY run_at, id LIMIT 1)
      AND status = 'queued'
    RETURNING id, kind, dedupe_key, payload, status, run_at, attempts, max_attempts, last_error
  `).get(worker, now, now, ...(kinds ?? [])) as Row | undefined;
  return r ? toJob(r) : null;
}

export function complete(id: number, result: unknown, now = Date.now()): void {
  getDb().prepare("UPDATE jobs SET status = 'done', result = ?, finished_at = ?, locked_by = NULL WHERE id = ?")
    .run(JSON.stringify(result ?? null).slice(0, 4000), now, id);
}

/** 30 s, 1 min, 2 min … capped at an hour, with up to 20% jitter so a
 *  burst of failures does not retry in lockstep. */
export function backoffMs(attempt: number, rand = Math.random()): number {
  const base = Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (1 + 0.2 * rand));
}

/** Record a failure: back to the queue with backoff while attempts remain,
 *  otherwise failed for good. Returns the new status. */
export function fail(id: number, error: string, now = Date.now(), rand = Math.random()): JobStatus {
  const db = getDb();
  const j = db.prepare('SELECT attempts, max_attempts FROM jobs WHERE id = ?').get(id) as { attempts: number; max_attempts: number } | undefined;
  if (!j) return 'failed';
  const retry = j.attempts < j.max_attempts;
  db.prepare(`UPDATE jobs SET status = ?, run_at = ?, last_error = ?, finished_at = ?, locked_by = NULL WHERE id = ?`)
    .run(retry ? 'queued' : 'failed', retry ? now + backoffMs(j.attempts, rand) : now, error.slice(0, 1000), retry ? null : now, id);
  return retry ? 'queued' : 'failed';
}

/** Put back jobs whose worker died mid-run. */
export function recoverStale(now = Date.now()): number {
  return getDb().prepare(`
    UPDATE jobs SET status = 'queued', locked_by = NULL, last_error = 'worker stopped mid-run; requeued'
    WHERE status = 'running' AND locked_at < ?
  `).run(now - STALE_MS).changes;
}

export function getJob(id: number): Job | null {
  const r = getDb().prepare('SELECT id, kind, dedupe_key, payload, status, run_at, attempts, max_attempts, last_error FROM jobs WHERE id = ?').get(id) as Row | undefined;
  return r ? toJob(r) : null;
}

export interface JobHealth {
  kind: string;
  queued: number;
  running: number;
  failed24h: number;
  done24h: number;
  lastDoneAt: number | null;
  nextRunAt: number | null;
  lastError: string | null;
}

/** Per-kind queue health for the admin view. */
export function jobHealth(now = Date.now()): JobHealth[] {
  const since = now - 86_400_000;
  return getDb().prepare(`
    SELECT kind,
      SUM(status = 'queued') AS queued,
      SUM(status = 'running') AS running,
      SUM(status = 'failed' AND finished_at >= ?) AS failed24h,
      SUM(status = 'done' AND finished_at >= ?) AS done24h,
      MAX(CASE WHEN status = 'done' THEN finished_at END) AS lastDoneAt,
      MIN(CASE WHEN status = 'queued' THEN run_at END) AS nextRunAt,
      (SELECT last_error FROM jobs j2 WHERE j2.kind = jobs.kind AND j2.last_error IS NOT NULL ORDER BY COALESCE(j2.finished_at, j2.run_at) DESC LIMIT 1) AS lastError
    FROM jobs GROUP BY kind ORDER BY kind
  `).all(since, since) as JobHealth[];
}

export function recentJobs(limit = 30): Array<Job & { finishedAt: number | null; createdAt: number }> {
  return (getDb().prepare(`
    SELECT id, kind, dedupe_key, payload, status, run_at, attempts, max_attempts, last_error, finished_at, created_at
    FROM jobs ORDER BY id DESC LIMIT ?
  `).all(limit) as Array<Row & { finished_at: number | null; created_at: number }>)
    .map((r) => ({ ...toJob(r), finishedAt: r.finished_at, createdAt: r.created_at }));
}
