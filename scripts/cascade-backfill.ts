// `pnpm tsx scripts/cascade-backfill.ts`: 30 days of Smart Money trades for the most-touched tokens (Nansen tgm/dex-trades).
import { config } from 'dotenv'; config({ path: '.env.local' });
process.env.FIXTURE_RECORD = '0';
(async () => {
  const { backfillCascades } = await import('@/server/cascade/backfill');
  const t = Date.now();
  console.log(await backfillCascades(), `${Math.round((Date.now() - t) / 1000)}s`);
})();
