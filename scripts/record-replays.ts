// Explicit, three-credit acceptance/fixture recording. Never a worker task.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });
import { contextScope } from '@/server/context';
import { prepareReplay } from '@/server/desk/replay';

async function main() {
  const cap = Number(process.argv[2]);
  if (!Number.isFinite(cap) || cap < 3 || cap > 500) throw new Error('Pass an explicit credit cap from 3 to 500. Estimated cost: 3 credits (one per window).');
  if (!process.env.NANSEN_API_KEY) throw new Error('A configured instance key is required; no credentials are printed.');
  process.env.DEMO_MODE = '0';
  const ctx = { mode: 'public' as const, user: null, apiKey: null, keyLast4: null, keyPlan: null };
  let spent = 0;
  for (const horizon of ['1h', '24h', '7d'] as const) {
    if (spent + 1 > cap) throw new Error('Credit cap reached.');
    const p = await contextScope.run(ctx, () => prepareReplay('verification:replay', ctx, 'base', '0x940181a94a35a4569e4529a3cdfb74e38fd98631', horizon));
    spent += p.receipt.credits;
    console.log(JSON.stringify({ horizon, cutoff: new Date(p.cut).toISOString(), historicalCandles: p.history.length, storedReadings: p.readings.length, credits: p.receipt.credits, totalCredits: spent }));
  }
}
main().catch((e) => { console.error((e as Error).message); process.exitCode = 1; });
