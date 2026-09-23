// `pnpm backtest`: runs the Forecast Lab's backtest against the live API
// and writes fixtures/backtest-results.json, which the lab page reads (and
// which ships in the repo, so DEMO_MODE shows real results with no key).
// Prints its credit estimate first and stops before BACKTEST_CREDIT_CAP.
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import fs from 'node:fs';
import path from 'node:path';
import { runBacktest } from '@/server/backtest/run';

async function main() {
  if (process.env.DEMO_MODE === '1') {
    console.log('DEMO_MODE=1: the backtest needs the live API. The committed fixtures/backtest-results.json is what the lab shows.');
    return;
  }
  const cap = Number(process.env.BACKTEST_CREDIT_CAP ?? 600);
  const result = await runBacktest({ cap, log: (s) => console.log(s) });
  const out = path.resolve('fixtures/backtest-results.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  const f = (v: number | null) => (v == null ? '—' : v.toFixed(3));
  console.log(`\nwrote ${out}`);
  console.log(`credits ${result.creditsSpent} (this run ${result.creditsThisRun}) / cap ${cap} · ${result.calls} calls · ${result.samples} samples · ${result.tokens} tokens`);
  for (const r of [result.storm, result.breakout]) {
    console.log(`${r.event}: test n=${r.test.n} events=${r.test.events} · AUC fitted ${f(r.fitted.auc)} [${r.fitted.aucCi ? r.fitted.aucCi.map((v) => v.toFixed(2)).join('–') : '—'}] vs expert ${f(r.expert.auc)} · Brier ${f(r.fitted.brier)} (base rate ${f(r.baseRateBrier)}) · passes ${r.passes}`);
  }
  console.log('cone coverage:', result.cone.map((c) => `${c.days}d ${(c.coverage * 100).toFixed(0)}% (n=${c.n})`).join(' · '));
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
