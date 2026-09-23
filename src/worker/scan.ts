// `pnpm scan` runs one scan and exits; `pnpm scan --loop` keeps scanning
// every SCAN_INTERVAL_MIN minutes. docker compose uses the loop.
//
// Default interval is 30 minutes, not the 15 the design first called for:
// a full run costs roughly 15-40 credits depending on which windows are due,
// and at 15 minutes that alone would spend ~2-4k credits a day. Set
// SCAN_INTERVAL_MIN=15 on a plan with the headroom for it.
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { runScan } from '@/server/weather/scanner';

const intervalMin = Number(process.env.SCAN_INTERVAL_MIN ?? 30);
const loop = process.argv.includes('--loop');

async function once() {
  const s = await runScan();
  const stamp = new Date().toISOString();
  console.log(
    `[scan ${stamp}] windows=${s.windows.join(',') || 'none due'} chains=${s.chainsScored} trades+=${s.tradesAdded} credits=${s.credits} ${s.ms}ms`,
  );
  for (const e of s.errors) console.warn(`  ! ${e}`);
}

async function main() {
  if (process.env.DEMO_MODE === '1') {
    console.log('DEMO_MODE=1: the scanner only runs against the live API. Replayed fixtures already include scan history.');
    return;
  }
  await once();
  if (!loop) return;
  for (;;) {
    await new Promise((r) => setTimeout(r, intervalMin * 60_000));
    try { await once(); } catch (e) { console.error('[scan] failed:', (e as Error).message); }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
