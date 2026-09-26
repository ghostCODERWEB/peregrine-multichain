// Rug Checker: the token's Nansen data read as a short safety checklist.
// Every check is one measured number against stated thresholds; the verdict
// is the token's Dump Risk band (a 7-day probability-style score), raised to
// at least Moderate when a check fails and at least High when two or more do. Readings, not a guarantee and not
// financial advice.
import { ALL_CHAIN_IDS, endpointSupports } from '@/lib/registry';
import type { TokenHeader, HoldersWave, ForensicsWave, Wave } from '@/server/token/waves';
import type { StormWave } from '@/server/token/storm';

/** Networks where Nansen serves both token information and holders. */
export const RUG_CHAINS: readonly string[] = ALL_CHAIN_IDS.filter((c) => endpointSupports('tgmTokenInformation', c) && endpointSupports('tgmHolders', c));

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown';
export type Verdict = 'low' | 'moderate' | 'high' | 'critical' | 'unknown' | 'stablecoin';
/** No field named `label`: public-view redaction strips those (Nansen labels). */
export interface RugCheck { id: 'liquidity' | 'concentration' | 'insiders' | 'age' | 'selling' | 'nansen'; title: string; status: CheckStatus; value: string; detail: string }
export interface RugReport { verdict: Verdict; score: number | null; confidence: number | null; checks: RugCheck[]; fails: number; final: boolean }

const unavailable = <T,>(w: Wave<T> | undefined | null): w is { unavailable: string } => !w || (typeof w === 'object' && 'unavailable' in (w as object));
const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const usd = (x: number) => (x >= 1e9 ? `$${(x / 1e9).toFixed(2)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `$${(x / 1e3).toFixed(1)}K` : `$${x.toFixed(0)}`);
const why = (w: unknown, fallback: string) => (w && typeof w === 'object' && 'unavailable' in w ? String((w as { unavailable: string }).unavailable) : fallback);

export function rugReport(input: { header: Wave<TokenHeader> | null; holders: Wave<HoldersWave> | null; forensics?: Wave<ForensicsWave> | null; storm: Wave<StormWave> | null; now?: number }): RugReport {
  const { header, holders, forensics, storm, now = Date.now() } = input;
  const h = unavailable(header) ? null : header;
  const ho = unavailable(holders) ? null : holders;
  const fo = unavailable(forensics) ? null : forensics ?? null;
  const st = unavailable(storm) ? null : storm;
  const checks: RugCheck[] = [];

  // 1. Exit liquidity: can holders actually sell?
  if (h?.liquidityUsd != null && h.marketCapUsd) {
    const r = h.liquidityUsd / h.marketCapUsd, l = h.liquidityUsd;
    const status: CheckStatus = r < 0.02 || l < 25_000 ? 'fail' : r < 0.05 || l < 100_000 ? 'warn' : 'pass';
    checks.push({ id: 'liquidity', title: 'Exit liquidity', status, value: `${usd(l)} · ${pct(r, 1)} of mcap`, detail: 'DEX liquidity against market cap. Under 2% (or $25K) means a large holder can’t sell without crashing the price; under 5% is thin.' });
  } else checks.push({ id: 'liquidity', title: 'Exit liquidity', status: 'unknown', value: 'n/a', detail: why(header, 'Nansen returned no liquidity or market cap for this token.') });

  // 2. Holder concentration among non-custodial holders.
  if (ho?.concentration) {
    const t = ho.concentration.top10Share;
    checks.push({ id: 'concentration', title: 'Top-10 holders', status: t >= 0.6 ? 'fail' : t >= 0.35 ? 'warn' : 'pass', value: `${pct(t)} of supply`, detail: 'Share held by the ten largest non-custodial wallets (exchanges and contracts excluded). Over 60% lets a few wallets decide the price.' });
  } else checks.push({ id: 'concentration', title: 'Top-10 holders', status: 'unknown', value: 'n/a', detail: why(holders, 'No non-custodial holders among the top 100.') });

  // 3. Insider clusters: holders funded by the same wallet, or by the deployer.
  if (fo) {
    const clustered = fo.clusters.reduce((s, c) => s + c.share, 0);
    const dev = fo.clusters.filter((c) => c.includesDeployer).reduce((s, c) => s + c.share, 0);
    const status: CheckStatus = dev >= 0.05 || clustered >= 0.3 ? 'fail' : dev > 0 || clustered >= 0.1 ? 'warn' : 'pass';
    checks.push({ id: 'insiders', title: 'Insider clusters', status, value: fo.clusters.length ? `${pct(clustered)} of supply in ${fo.clusters.length} cluster${fo.clusters.length === 1 ? '' : 's'}${dev > 0 ? ` · ${pct(dev, 1)} linked to the deployer` : ''}` : 'No linked holders', detail: 'Top holders sharing a first funder (or linked by Nansen), and any cluster tied to the deployer: coordinated wallets can exit together.' });
  } else checks.push({ id: 'insiders', title: 'Insider clusters', status: 'unknown', value: forensics === undefined ? 'Checking…' : 'n/a', detail: forensics === undefined ? 'Tracing who funded the top holders.' : why(forensics, 'Insider clusters need the holder list.') });

  // 4. Age.
  const deployed = h?.deployedAt ? Date.parse(h.deployedAt) : NaN;
  if (Number.isFinite(deployed)) {
    const days = Math.max(0, Math.floor((now - deployed) / 86_400_000));
    checks.push({ id: 'age', title: 'Token age', status: days < 3 ? 'fail' : days < 30 ? 'warn' : 'pass', value: `${days.toLocaleString('en-US')} day${days === 1 ? '' : 's'}`, detail: 'Most rugs happen in a token’s first days. Under 3 days is very new; under 30 is young.' });
  } else checks.push({ id: 'age', title: 'Token age', status: 'unknown', value: 'n/a', detail: 'Nansen returned no deployment date.' });

  // 5. Who is selling: top traders' sell skew, insider sells weighted.
  const sp = st?.result.subScores.sellPressure;
  if (sp != null) checks.push({ id: 'selling', title: 'Sell pressure', status: sp >= 70 ? 'fail' : sp >= 50 ? 'warn' : 'pass', value: `${Math.round(sp)} / 100`, detail: 'The top 20 sellers against the top 20 buyers over 7 days, with sells from clustered insiders counted extra.' });
  else checks.push({ id: 'selling', title: 'Sell pressure', status: 'unknown', value: 'n/a', detail: st?.why.sellPressure ?? why(storm, 'Nansen returned no top traders for this token.') });

  // 6. Nansen's own risk indicators.
  const risk = h?.risk.filter((r) => r.percentile != null) ?? [];
  if (risk.length) {
    const m = risk.reduce((s, r) => s + r.percentile!, 0) / risk.length;
    checks.push({ id: 'nansen', title: 'Nansen risk indicators', status: m >= 80 ? 'fail' : m >= 60 ? 'warn' : 'pass', value: `${Math.round(m)}th percentile`, detail: `Mean signal percentile of ${risk.length} Nansen risk indicator${risk.length === 1 ? '' : 's'} (${risk.map((r) => r.type.replace(/-/g, ' ')).join(', ')}).` });
  } else checks.push({ id: 'nansen', title: 'Nansen risk indicators', status: 'unknown', value: 'n/a', detail: h?.indicatorsUnavailable ?? 'Nansen has not scored this token’s risk indicators.' });

  const fails = checks.filter((c) => c.status === 'fail').length;
  if (h?.isStablecoin) return { verdict: 'stablecoin', score: null, confidence: null, checks, fails, final: !!st?.final };
  const band = st?.result.band;
  let verdict: Verdict = band === 'clear' ? 'low' : band === 'cloudy' ? 'moderate' : band === 'watch' ? 'high' : band === 'warning' ? 'critical' : 'unknown';
  // A failed check is never hidden behind a calm model score: one fail
  // means at least Moderate, two or more at least High.
  if (fails >= 2 && (verdict === 'low' || verdict === 'moderate' || verdict === 'unknown')) verdict = 'high';
  else if (fails === 1 && (verdict === 'low' || verdict === 'unknown')) verdict = 'moderate';
  return { verdict, score: st ? Math.round(st.result.score) : null, confidence: st?.result.confidence ?? null, checks, fails, final: !!st?.final };
}
