// `pnpm jobs` — look at and feed the job queue the worker runs.
//   pnpm jobs                       queue health per kind + recent jobs
//   pnpm jobs enqueue <kind> [json] queue a job now (idempotent per kind)
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import { enqueue, jobHealth, recentJobs } from '@/server/jobs/queue';
import { HANDLERS, DEFAULT_ATTEMPTS } from '@/server/jobs/handlers';

const t = (ms: number | null) => (ms == null ? '—' : new Date(ms).toISOString().replace('T', ' ').slice(0, 19));

const [cmd, kind, json] = process.argv.slice(2);
if (cmd === 'enqueue') {
  if (!kind || !HANDLERS[kind]) {
    console.error(`kind must be one of: ${Object.keys(HANDLERS).join(', ')}`);
    process.exit(1);
  }
  const payload: unknown = json ? JSON.parse(json) : {};
  const r = enqueue(kind, payload, { dedupeKey: kind, maxAttempts: DEFAULT_ATTEMPTS[kind] ?? 3 });
  console.log(r.created ? `queued ${kind} as job ${r.id}` : `${kind} is already queued or running (job ${r.id})`);
} else {
  console.table(jobHealth().map((h) => ({ ...h, lastDoneAt: t(h.lastDoneAt), nextRunAt: t(h.nextRunAt), lastError: h.lastError?.slice(0, 60) ?? '' })));
  console.table(recentJobs(15).map((j) => ({ id: j.id, kind: j.kind, status: j.status, attempts: `${j.attempts}/${j.maxAttempts}`, runAt: t(j.runAt), finished: t(j.finishedAt), error: j.lastError?.slice(0, 50) ?? '' })));
}
