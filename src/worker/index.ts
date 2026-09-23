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
let firstSignalAt = 0;
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    // A wrapper (pnpm, npm exec, tsx) relays the same stop signal to this
    // process within milliseconds; only a deliberate second signal, well
    // after the first, means "stop now".
    if (stopping) {
      if (Date.now() - firstSignalAt > 2_000) process.exit(1);
      return;
    }
    stopping = true;
    firstSignalAt = Date.now();
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
