// The scanner's storm sweep: every STORM_SWEEP_HOURS (default 12), score
// the tokens smart money is dumping hardest across Tier A chains, so the
// home ticker ranks real computed Storm Scores even before anyone opens a
// token page. Budget-shaped: header, wind and holders only (~17 credits a
// token); the insider forensics (~50 profiler calls a token) run only on a
// token page, and the sweep's scores say so through their confidence.
import { getDb } from '@/server/nansen/db';
import { isRiskListable } from '@/lib/models/trade-side';
import { headerWave, windWave, holdersWave, isUnavailable } from './waves';
import { computeStorm, saveStorm } from './storm';

export interface SweepCandidate {
  chain: string;
  tokenAddress: string;
  symbol: string | null;
  /** 24h smart-money net flow, USD (negative = outflow). */
  netFlowUsd: number;
  marketCapUsd: number | null;
}

const HOURS = Number(process.env.STORM_SWEEP_HOURS ?? 12);
const TOKENS = Number(process.env.STORM_SWEEP_TOKENS ?? 6);
const MIN_MCAP = 1_000_000;

export function sweepDue(now: number): boolean {
  const row = getDb().prepare("SELECT MAX(computed_at) AS t FROM storm_scores WHERE source = 'sweep'").get() as { t: number | null };
  return TOKENS > 0 && (row.t == null || now - row.t >= HOURS * 3_600_000);
}

export async function stormSweep(candidates: SweepCandidate[], errors: string[]): Promise<number> {
  const seen = new Set<string>();
  const picks = candidates
    .filter((c) => c.netFlowUsd < 0 && isRiskListable(c.symbol) && (c.marketCapUsd ?? 0) >= MIN_MCAP)
    .sort((a, b) => a.netFlowUsd - b.netFlowUsd)
    .filter((c) => { const k = `${c.chain}:${c.tokenAddress.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, TOKENS);

  let scored = 0;
  for (const c of picks) {
    try {
      const [h, w, ho] = await Promise.all([headerWave(c.chain, c.tokenAddress), windWave(c.chain, c.tokenAddress), holdersWave(c.chain, c.tokenAddress)]);
      const s = computeStorm(h, w, ho, { unavailable: 'Not run in the scanner sweep (about 50 profiler calls per token); open the token page for insider clusters.' }, true);
      if (isUnavailable(s)) continue;
      saveStorm(c.chain, c.tokenAddress, isUnavailable(h) ? c.symbol : h.symbol ?? c.symbol, s, isUnavailable(h) ? c.marketCapUsd : h.marketCapUsd, null, 'sweep');
      scored++;
    } catch (e) {
      errors.push(`storm sweep ${c.chain}:${c.symbol}: ${(e as Error).message.slice(0, 120)}`);
    }
  }
  return scored;
}
