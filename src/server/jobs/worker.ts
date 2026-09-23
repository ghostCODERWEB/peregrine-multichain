// The worker loop, separate from the process entry point so tests can
// drive it one tick at a time.
import os from 'node:os';
import { getDb } from '@/server/nansen/db';
import { claim, complete, enqueue, fail, recoverStale, type Job } from './queue';
import { HANDLERS, SCAN_EVERY_MS, DEFAULT_ATTEMPTS, type Handler } from './handlers';

export const WORKER_ID = `${os.hostname()}:${process.pid}`;

/** When the next scan is due: SCAN_EVERY_MS after the last one started
 *  (from scan_runs, so restarting the worker does not scan early). */
export function nextScanAt(now: number, everyMs = SCAN_EVERY_MS): number {
  const last = (getDb().prepare('SELECT MAX(started_at) AS t FROM scan_runs').get() as { t: number | null }).t;
  return last == null ? now : Math.max(now, last + everyMs);
}

/** Recurring jobs: make sure the next occurrence is queued. Idempotent. */
export function scheduleRecurring(now = Date.now(), everyMs = SCAN_EVERY_MS): void {
  enqueue('scan', {}, { dedupeKey: 'scan', runAt: nextScanAt(now, everyMs), maxAttempts: DEFAULT_ATTEMPTS.scan }, now);
}

export interface TickResult { job: Job | null; status: 'idle' | 'done' | 'retry' | 'failed' }

/** Claim and run at most one due job. */
export async function tick(opts: { now?: () => number; handlers?: Record<string, Handler>; log?: (s: string) => void; everyMs?: number } = {}): Promise<TickResult> {
  const now = opts.now ?? Date.now;
  const handlers = opts.handlers ?? HANDLERS;
  const log = opts.log ?? ((s: string) => console.log(s));
  const job = claim(WORKER_ID, now(), Object.keys(handlers));
  if (!job) return { job: null, status: 'idle' };
  const prefix = `[${new Date(now()).toISOString()} job ${job.id} ${job.kind}#${job.attempts}]`;
  const say = (s: string) => log(`${prefix} ${s}`);
  let status: TickResult['status'];
  try {
    const result = await handlers[job.kind].run(job, say);
    complete(job.id, result, now());
    status = 'done';
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    status = fail(job.id, msg, now()) === 'queued' ? 'retry' : 'failed';
    say(`${status === 'retry' ? 'failed, will retry' : 'failed for good'}: ${msg.slice(0, 300)}`);
  }
  // A recurring job schedules its successor once it has finished for good.
  if (job.kind === 'scan' && status !== 'retry') scheduleRecurring(now(), opts.everyMs);
  return { job, status };
}

/** Run until `stop()` returns true, polling every `idleMs` when idle. */
export async function runWorker(opts: { idleMs?: number; stop: () => boolean; log?: (s: string) => void }): Promise<void> {
  const log = opts.log ?? ((s: string) => console.log(s));
  const requeued = recoverStale();
  if (requeued) log(`[worker] requeued ${requeued} job(s) a previous worker left running`);
  scheduleRecurring();
  let lastStaleCheck = Date.now();
  while (!opts.stop()) {
    const r = await tick({ log });
    if (Date.now() - lastStaleCheck > 600_000) { recoverStale(); lastStaleCheck = Date.now(); }
    if (r.status === 'idle') await new Promise((res) => setTimeout(res, opts.idleMs ?? 5_000));
  }
}
