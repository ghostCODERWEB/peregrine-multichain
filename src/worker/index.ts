// `pnpm worker`: the one background process. Polls the jobs table and runs
// the scanner every SCAN_INTERVAL_MIN minutes (default 30; see
// src/worker/scan.ts for the credit math), storm sweeps when due, and any
// queued backtest. SIGINT/SIGTERM finish the current job, then exit; a job
// cut off by a hard kill is requeued by the next worker.
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { runWorker, WORKER_ID } from '@/server/jobs/worker';

let stopping = false;
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    if (stopping) process.exit(1); // second signal: stop now
    stopping = true;
    console.log(`[worker] ${sig}: finishing the current job, then exiting`);
  });
}

async function main() {
  if (process.env.DEMO_MODE === '1') {
    console.log('DEMO_MODE=1: the worker only runs against the live API. Replayed fixtures already include scan history.');
    return;
  }
  console.log(`[worker ${WORKER_ID}] started; scans every ${process.env.SCAN_INTERVAL_MIN ?? 30} min`);
  await runWorker({ stop: () => stopping });
  console.log('[worker] stopped');
}

main().catch((e) => { console.error(e); process.exit(1); });
