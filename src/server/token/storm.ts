// Storm Score (5.3) from the token page's waves. Recomputed twice per page
// load — provisionally once header, wind and holders are in, finally after
// forensics — so the dial shows up early with lower confidence and firms
// up. Only the final score is stored for the home ticker.
import { getDb } from '@/server/nansen/db';
import {
  compositeStormScore, insiderScore, windShearScore, exitLiquidityScore, sellPressureScore,
  EXPERT_PRIOR_WEIGHTS, type StormScoreResult, type StormInput,
} from '@/lib/models/storm-score';
import type { Provenance } from '@/lib/provenance';
import { isUnavailable, type Wave, type TokenHeader, type WindWave, type HoldersWave, type ForensicsWave } from './waves';
import type { SocialWave, DcaWave } from './terminal';
import { usd, num, pct } from '@/lib/viz/format';
import { isBudgetMessage } from '@/server/site';

export interface StormWave {
  result: StormScoreResult;
  final: boolean;
  /** Why each dropped input was dropped. */
  why: Partial<Record<StormInput, string>>;
  provenance: Record<StormInput | 'composite', Provenance | null>;
}

const W = EXPERT_PRIOR_WEIGHTS;

export function computeStorm(
  header: Wave<TokenHeader>,
  wind: Wave<WindWave>,
  holders: Wave<HoldersWave>,
  forensics: Wave<ForensicsWave> | undefined,
  final: boolean,
): Wave<StormWave> {
  const why: StormWave['why'] = {};
  const prov: StormWave['provenance'] = { concentration: null, insider: null, windShear: null, exitLiquidity: null, sellPressure: null, nansenRisk: null, composite: null };
  const h = isUnavailable(header) ? null : header;
  const mcap = h?.marketCapUsd ?? null;

  // C
  let C: number | null = null;
  if (isUnavailable(holders)) why.concentration = holders.unavailable;
  else if (!holders.concentration) why.concentration = 'No non-custodial holders among the top 100.';
  else { C = holders.concentration.score; prov.concentration = holders.provenance.holders; }

  // I
  let I: number | null = null;
  let maxClusterShare = 0;
  let clusterWallets = new Set<string>();
  if (!forensics) why.insider = 'Forensics wave still loading.';
  else if (isUnavailable(forensics)) why.insider = forensics.unavailable;
  else {
    const multi = forensics.clusters.filter((c) => c.wallets.length >= 2);
    const r = insiderScore({ clusters: multi, clusteredHolderCount: forensics.clusteredHolderCount });
    I = r.score;
    maxClusterShare = r.maxClusterShare;
    clusterWallets = new Set(multi.flatMap((c) => c.wallets.map((w) => w.toLowerCase())));
    prov.insider = forensics.provenance;
  }

  // W
  let Wsc: number | null = null;
  if (isUnavailable(wind)) why.windShear = wind.unavailable;
  else if (!mcap) why.windShear = 'Needs market cap, which Nansen did not return.';
  else {
    const d = wind.rings['1d'];
    const fresh = d.fresh_wallets.netUsd;
    const sm = (d.smart_trader.netUsd ?? 0) + (d.top_pnl.netUsd ?? 0);
    if (fresh == null && d.smart_trader.netUsd == null && d.top_pnl.netUsd == null) why.windShear = 'No fresh-wallet or smart-trader flow in the 1d window.';
    else {
      Wsc = windShearScore({ freshWalletNetUsd: fresh ?? 0, smartMoneyNetUsd: sm, marketCapUsd: mcap });
      prov.windShear = {
        title: 'Cohort shear (W) — informed selling into fresh buying, 1d',
        formula: 'W = 100·sigmoid(8·(fresh_in − sm_out) / mcap)\nfresh_in = max(0, fresh-wallet net)   sm_out = max(0, −(smart trader + top PnL net))',
        inputs: [
          { label: 'Fresh-wallet net, 1d', value: usd(fresh, { signed: true }) },
          { label: 'Smart trader + top PnL net, 1d', value: usd(sm, { signed: true }) },
          { label: 'Market cap', value: usd(mcap) },
          { label: 'W', value: num(Wsc) },
        ],
        calls: wind.provenance.calls.filter((c) => (c.body as { timeframe?: string })?.timeframe === '1d'),
        notes: ['k = 8 is an expert prior (the spec fixes the shape, not the constant).'],
      };
    }
  }

  // L
  let L: number | null = null;
  const liq = h?.liquidityUsd ?? null;
  if (!h) why.exitLiquidity = isUnavailable(header) ? header.unavailable : 'Header missing.';
  else if (liq == null || !mcap) why.exitLiquidity = 'Needs both liquidity and market cap; Nansen did not return them.';
  else {
    const liqRisk = h.risk.find((r) => r.type === 'liquidity-risk')?.percentile ?? undefined;
    const r = exitLiquidityScore({ liquidityUsd: liq, marketCapUsd: mcap, nansenLiquidityRiskPercentile: liqRisk, maxClusterShare });
    L = r.score;
    prov.exitLiquidity = {
      title: 'Exit liquidity (L)',
      formula: 'L = weighted mean of\n  0.4 · 100·clamp(1 − (liquidity/mcap)/0.3)\n  0.3 · 100·clamp(max_cluster_share·mcap / liquidity)\n  0.3 · Nansen liquidity-risk percentile  (dropped + renormalized if absent)',
      inputs: [
        { label: 'Liquidity / mcap', value: pct(r.liquidityToMcap, 2) },
        { label: 'Largest cluster ÷ liquidity', value: Number.isFinite(r.clusterToLiquidityRatio) ? `${num(r.clusterToLiquidityRatio, 2)}×` : '∞' },
        { label: 'Nansen liquidity-risk pctile', value: liqRisk == null ? 'not scored' : num(liqRisk, 0) },
        { label: 'L', value: num(L) },
      ],
      calls: h.provenance.calls,
      notes: forensics && !isUnavailable(forensics) ? [] : ['Cluster term uses 0 until the insider graph loads.'],
    };
  }

  // P
  let P: number | null = null;
  if (isUnavailable(holders)) why.sellPressure = holders.unavailable;
  else if (holders.tradersUnavailable) why.sellPressure = holders.tradersUnavailable;
  else {
    const buy = holders.buyers.reduce((s, x) => s + x.boughtUsd, 0);
    const sell = holders.sellers.reduce((s, x) => s + x.soldUsd, 0);
    const insiderSell = holders.sellers.filter((x) => clusterWallets.has(x.address.toLowerCase())).reduce((s, x) => s + x.soldUsd, 0);
    const r = sellPressureScore({ top20BuyUsd: buy, top20SellUsd: sell, insiderSellUsd: insiderSell });
    P = r.score;
    prov.sellPressure = {
      title: 'Sell pressure (P), 7 days',
      formula: 'P = 100·(0.5·sell_skew + 0.5·insider_share_of_sells)\nsell_skew = Σ top-20 sold ÷ (Σ top-20 bought + Σ top-20 sold)',
      inputs: [
        { label: 'Sell skew', value: pct(r.sellSkew, 0) },
        { label: 'Sells from clustered insiders', value: `${usd(insiderSell)} (${pct(r.insiderShareOfSells, 0)})` },
        { label: 'P', value: num(P) },
      ],
      calls: holders.provenance.traders?.calls ?? [],
    };
  }

  // Nansen's own risk indicators, minus liquidity-risk (already inside L).
  let R: number | null = null;
  const riskInds = h?.risk.filter((r) => r.type !== 'liquidity-risk' && r.percentile != null) ?? [];
  if (!h) why.nansenRisk = 'Header missing.';
  else if (!riskInds.length) why.nansenRisk = h.indicatorsUnavailable ?? 'Nansen has not scored this token’s risk indicators.';
  else {
    R = riskInds.reduce((s, r) => s + r.percentile!, 0) / riskInds.length;
    prov.nansenRisk = {
      title: 'Nansen risk indicators',
      formula: 'mean signal percentile of Nansen risk indicators\n(liquidity-risk excluded here: it already feeds L)',
      inputs: riskInds.map((r) => ({ label: `${r.type} (${r.score ?? '—'})`, value: num(r.percentile, 0) })),
      calls: h.provenance.calls.filter((c) => c.endpoint === 'tgm/indicators'),
    };
  }

  const subScores = { concentration: C, insider: I, windShear: Wsc, exitLiquidity: L, sellPressure: P, nansenRisk: R };
  if (Object.values(subScores).every((v) => v == null)) {
    // A spent public-site budget is not Nansen having no data: say which.
    const budget = Object.values(why).find((r) => isBudgetMessage(r));
    return { unavailable: budget ?? 'Nansen returned none of the inputs the Dump Risk needs for this token.' };
  }
  const result = compositeStormScore(subScores);
  const fmt = (k: StormInput, label: string) => ({ label: `${label} (β ${W[k]})`, value: subScores[k] == null ? 'missing' : num(subScores[k]) });
  prov.composite = {
    title: 'Dump Risk — 7 days',
    formula: 'Dump Risk = 100·sigmoid(Σ β_j·(s_j − 50)/25)\nmissing inputs dropped, remaining β scaled back to the full total\nbands: <25 Low · <50 Moderate · <75 High · Critical',
    inputs: [
      fmt('concentration', 'C concentration'), fmt('insider', 'I insider clusters'), fmt('windShear', 'W cohort shear'),
      fmt('exitLiquidity', 'L exit liquidity'), fmt('sellPressure', 'P sell pressure'), fmt('nansenRisk', 'Nansen risk'),
      { label: 'Confidence', value: pct(result.confidence, 0) },
      { label: 'Dump Risk', value: num(result.score) },
    ],
    calls: [],
    notes: ['Weights are expert priors. The Backtest Lab replaces them with fitted weights only if the backtest AUC clears 0.70.'],
  };
  return { result, final, why, provenance: prov };
}

export function saveStorm(chain: string, token: string, symbol: string | null, s: StormWave, marketCapUsd: number | null, priceUsd: number | null, source: 'page' | 'sweep') {
  getDb().prepare(`
    INSERT INTO storm_scores (chain, token_address, symbol, score, band, confidence, sub_scores, missing, market_cap_usd, price_usd, source, computed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(chain, token.toLowerCase(), symbol, s.result.score, s.result.band, s.result.confidence,
    JSON.stringify(s.result.subScores), JSON.stringify(s.result.missing), marketCapUsd, priceUsd, source, Date.now());
}

// ---------------------------------------------------------------- v2 candidates

/**
 * Storm Score v2 candidates (M2): social heat and DCA overhang. Computed
 * and shown on every token page, but NOT in the score yet: a sub-score
 * enters the composite only with a weight fitted by the backtest (M9),
 * so the Storm Score's published track record stays the model it
 * describes.
 */
export interface StormCandidate { key: 'socialHeat' | 'dcaOverhang'; name: string; score: number | null; why: string | null; provenance: Provenance | null }

export function stormCandidates(social: Wave<SocialWave>, dca: Wave<DcaWave>): StormCandidate[] {
  return [
    isUnavailable(social)
      ? { key: 'socialHeat', name: 'Social heat', score: null, why: social.unavailable, provenance: null }
      : { key: 'socialHeat', name: 'Social heat', score: social.heat.score, why: null, provenance: social.provenance },
    isUnavailable(dca)
      ? { key: 'dcaOverhang', name: 'DCA overhang', score: null, why: dca.unavailable, provenance: null }
      : dca.overhang
        ? { key: 'dcaOverhang', name: 'DCA overhang', score: dca.overhang.score, why: null, provenance: dca.provenance }
        : { key: 'dcaOverhang', name: 'DCA overhang', score: null, why: 'Needs the token’s 24h volume, which Nansen did not return.', provenance: dca.provenance },
  ];
}
