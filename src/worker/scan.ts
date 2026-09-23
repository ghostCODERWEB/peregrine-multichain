// `pnpm scan` runs one scan (and a storm sweep if one is due) and exits.
// Continuous scanning is the worker's job: `pnpm worker` runs a scan every
// SCAN_INTERVAL_MIN minutes.
//
// Default interval is 30 minutes, not the 15 the design first called for:
// a full run costs roughly 15-40 credits depending on which windows are due,
// and at 15 minutes that alone would spend ~2-4k credits a day. Set
// SCAN_INTERVAL_MIN=15 on a plan with the headroom for it.
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { runScan } from '@/server/weather/scanner';

async function main() {
  if (process.env.DEMO_MODE === '1') {
    console.log('DEMO_MODE=1: the scanner only runs against the live API. Replayed fixtures already include scan history.');
    return;
  }
  if (process.argv.includes('--loop')) {
    console.error('`scan --loop` is replaced by `pnpm worker`, which runs the scan on a schedule through the job queue.');
    process.exit(1);
  }
  const s = await runScan();
  console.log(
    `[scan ${new Date().toISOString()}] windows=${s.windows.join(',') || 'none due'} chains=${s.chainsScored} trades+=${s.tradesAdded} storms=${s.stormsScored} credits=${s.credits} ${s.ms}ms`,
  );
  for (const e of s.errors) console.warn(`  ! ${e}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
