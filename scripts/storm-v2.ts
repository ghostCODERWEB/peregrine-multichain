// `pnpm storm-v2 [cap]`: rebuild Storm Scores point in time and price the
// real fit. Defaults to a small pilot. A full run needs the user's go-ahead
// (it is far above the per-step credit limit) and a matching cap.
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import fs from 'node:fs';
import path from 'node:path';
import { runStormV2 } from '@/server/backtest/storm-v2';

async function main() {
  const cap = Number(process.argv[2] ?? 300);
  const report = await runStormV2({ cap, anchorsDaysAgo: [29, 15], perAnchor: 2, kind: 'pilot', log: (s) => console.log('·', s) });
  const out = path.resolve('fixtures/storm-v2.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ spent: report.creditsSpent, nominal: report.creditsNominal, calls: report.calls, observations: report.observations.length, coverage: report.coverage, failed: report.failed }, null, 1));
  for (const o of report.observations) console.log(o.asOf, o.symbol, 'storm', Number.isFinite(o.storm) ? o.storm.toFixed(0) : '—', JSON.stringify(Object.fromEntries(Object.entries(o.subScores).map(([k, v]) => [k, v == null ? null : Math.round(v as number)]))), 'dd7', o.maxDrawdown7d == null ? '—' : (o.maxDrawdown7d * 100).toFixed(1) + '%');
  console.log(report.decision);
}
main().catch((e) => { console.error(e); process.exit(1); });
