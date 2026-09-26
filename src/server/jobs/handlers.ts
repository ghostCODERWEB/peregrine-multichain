// What each job kind does. Every handler is safe to run twice (the scanner
// skips windows already stored, the sweep re-scores, a backtest overwrites
// its results), which is what makes retries and crash recovery harmless.
import fs from 'node:fs';
import path from 'node:path';
import { runScan } from '@/server/weather/scanner';
import { snapshotScheduledCoins } from '@/server/perps/terminal';
import { stormSweep, type SweepCandidate } from '@/server/token/sweep';
import { runBacktest } from '@/server/backtest/run';
import { refreshMembership } from '@/server/sectors/membership';
import { enqueue, type Job } from './queue';

export interface Handler {
  run(job: Job, log: (s: string) => void): Promise<unknown>;
}

export const SCAN_EVERY_MS = Number(process.env.SCAN_INTERVAL_MIN ?? 30) * 60_000;

function isCandidate(v: unknown): v is SweepCandidate {
  const c = v as SweepCandidate;
  return !!c && typeof c.chain === 'string' && typeof c.tokenAddress === 'string' && typeof c.netFlowUsd === 'number';
}

export const HANDLERS: Record<string, Handler> = {
  /** One scanner pass. A due storm sweep becomes its own job. */
  scan: {
    async run(_job, log) {
      const s = await runScan({ sweep: 'defer' });
      log(`windows=${s.windows.join(',') || 'none due'} chains=${s.chainsScored} trades+=${s.tradesAdded} sectors=${s.sectorRows} credits=${s.credits} ${s.ms}ms`);
      for (const e of s.errors) log(`  ! ${e}`);
      await snapshotScheduledCoins(log);
      if (s.sweepCandidates) {
        const q = enqueue('storm-sweep', { candidates: s.sweepCandidates }, { dedupeKey: 'storm-sweep', maxAttempts: 2 });
        log(`storm sweep due: ${q.created ? `queued job ${q.id}` : `already queued (job ${q.id})`}`);
      }
      return { windows: s.windows, chainsScored: s.chainsScored, tradesAdded: s.tradesAdded, sectorRows: s.sectorRows, credits: s.credits, errors: s.errors, ms: s.ms };
    },
  },

  /** Storm Scores for the tokens smart money is leaving hardest. */
  'storm-sweep': {
    async run(job, log) {
      const raw = (job.payload as { candidates?: unknown }).candidates;
      const candidates = Array.isArray(raw) ? raw.filter(isCandidate) : [];
      const errors: string[] = [];
      const scored = await stormSweep(candidates, errors);
      log(`storm sweep: ${scored} scored from ${candidates.length} candidates`);
      for (const e of errors) log(`  ! ${e}`);
      if (scored === 0 && errors.length) throw new Error(errors.slice(0, 3).join(' | '));
      return { scored, errors };
    },
  },

  /** Token → sector membership for sector weather, once a day, under
   *  SECTOR_REFRESH_CREDIT_CAP (one screener call per sector). */
  'sector-membership': {
    async run(_job, log) {
      const cap = Number(process.env.SECTOR_REFRESH_CREDIT_CAP ?? 60);
      return refreshMembership({ cap, log });
    },
  },

  /** The Forecast Lab backtest, never above BACKTEST_CREDIT_CAP (a
   *  payload cap can only lower it). Queued by hand: `pnpm jobs enqueue backtest`. */
  backtest: {
    async run(job, log) {
      const envCap = Number(process.env.BACKTEST_CREDIT_CAP ?? 600);
      const asked = Number((job.payload as { cap?: unknown }).cap);
      const cap = Number.isFinite(asked) && asked > 0 ? Math.min(asked, envCap) : envCap;
      const result = await runBacktest({ cap, log });
      fs.writeFileSync(path.resolve('fixtures/backtest-results.json'), JSON.stringify(result, null, 1));
      return { cap, creditsThisRun: result.creditsThisRun, samples: result.samples, stormAuc: result.storm.fitted.auc, breakoutAuc: result.breakout.fitted.auc };
    },
  },
};

/** How many attempts a kind gets when enqueued without an explicit count:
 *  the backtest spends real credits, so it never retries on its own. */
export const DEFAULT_ATTEMPTS: Record<string, number> = { scan: 2, 'storm-sweep': 2, 'sector-membership': 2, backtest: 1 };
