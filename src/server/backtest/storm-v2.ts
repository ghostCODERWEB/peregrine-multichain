// Storm v2 (M9): the Storm Score rebuilt point in time from Nansen's
// historical endpoints, with the same formulas the live page uses, so its
// weights could be fitted on data the score could really have seen.
//
//   C  concentration   v1beta1/tgm/historical-top-holders (as_of_date)      25 cr
//   W  wind shear      v1beta1/tgm/historical-token-flow-summary (1 day)      5 cr
//   P  sell pressure   v1beta1/tgm/historical-who-bought-sold (7 days)       5 cr
//   R  Nansen risk     v1beta1/tgm/historical-token-quant-scores (as_of)   25 cr
//   L  exit liquidity  v1beta1/token-screener/historical (per chain+date)   5 cr, shared
//   label              v1beta1/tgm/historical-token-ohlcv, 1d, next 7 days    5 cr
//   I  insider         not rebuilt: first funders of past holders would add 25+ calls per token-date
//
// A run is capped: a call that would pass the cap is not made.
import { callNansen } from '@/server/nansen/client';
import { nonHolderKind } from '@/lib/models/holder-filter';
import { concentrationScore, windShearScore, exitLiquidityScore, sellPressureScore, compositeStormScore, type StormSubScores } from '@/lib/models/storm-score';
import { requiredObservations } from '@/lib/models/metrics';
import { isStablecoin, isMajorOrWrapped } from '@/lib/models/trade-side';

type Row = Record<string, unknown>;
const n = (v: unknown) => { const x = Number(v); return v == null || v === '' || !Number.isFinite(x) ? null : x; };
const rows = (d: unknown): Row[] => (d && typeof d === 'object' && Array.isArray((d as { data?: unknown }).data) ? (d as { data: Row[] }).data : []);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const PER_OBSERVATION_CREDITS = 25 + 5 + 5 + 25 + 5;

class Budget {
  spent = 0; nominal = 0; calls = 0; failed: string[] = [];
  constructor(public cap: number) {}
  async call<T>(endpoint: string, body: unknown, credits: number): Promise<T | null> {
    if (this.nominal + credits > this.cap) throw new Error(`cap ${this.cap} reached (next call ${credits} credits)`);
    this.nominal += credits;
    try {
      const r = await callNansen<T>(endpoint, body, { record: false });
      this.spent += r.meta.creditsCost; this.calls++;
      return r.data;
    } catch (e) {
      this.failed.push(`${endpoint}: ${(e as Error).message.slice(0, 120)}`);
      return null;
    }
  }
}

export interface V2Observation {
  chain: string; token: string; symbol: string; asOf: string;
  subScores: StormSubScores; storm: number; missing: string[];
  maxDrawdown7d: number | null; event50: 0 | 1 | null; event30: 0 | 1 | null;
}

export interface V2Report {
  generatedAt: string;
  kind: 'pilot' | 'full';
  cap: number; creditsSpent: number; creditsNominal: number; calls: number;
  perObservationCredits: number;
  observations: V2Observation[];
  coverage: Record<'concentration' | 'windShear' | 'sellPressure' | 'nansenRisk' | 'exitLiquidity' | 'label', number>;
  power: Array<{ event: string; baseRate: number; needed: { n: number; events: number } | null; credits: number | null }>;
  decision: string;
  failed: string[];
}

async function observe(b: Budget, chain: string, token: string, symbol: string, asOf: string, screen: Row | undefined): Promise<V2Observation> {
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  const [h, f, w, q, o] = [
    await b.call<unknown>('v1beta1/tgm/historical-top-holders', { chain, token_address: token, as_of_date: asOf, label_type: 'all_holders', pagination: { page: 1, per_page: 100 } }, 25),
    await b.call<unknown>('v1beta1/tgm/historical-token-flow-summary', { chain, token_address: token, date_range: { from: iso(asOfMs - 86_400_000), to: asOf } }, 5),
    await b.call<unknown>('v1beta1/tgm/historical-who-bought-sold', { chain, token_address: token, date_range: { from: iso(asOfMs - 7 * 86_400_000), to: asOf }, pagination: { page: 1, per_page: 40 } }, 5),
    await b.call<unknown>('v1beta1/tgm/historical-token-quant-scores', { chain, token_address: token, as_of_date: asOf }, 25),
    await b.call<unknown>('v1beta1/tgm/historical-token-ohlcv', { chain, token_address: token, date_from: asOf, as_of_date: iso(asOfMs + 8 * 86_400_000), timeframe: '1d' }, 5),
  ];
  const mcap = n(screen?.market_cap_usd) ?? n(rows(q).find((r) => n(r.market_cap_usd) != null)?.market_cap_usd);

  // C: real holders only, the same exclusions as the live page.
  const holders = rows(h).filter((r) => !nonHolderKind((r.address_label as string | null) ?? null));
  const shares = holders.map((r) => n(r.ownership_percentage) ?? 0).filter((x) => x > 0).map((x) => (x > 1 ? x / 100 : x));
  const C = shares.length >= 5 ? concentrationScore({ shares }).score : null;

  // W: fresh-wallet buying against smart trader + top-PnL selling, 1 day.
  const fs = rows(f)[0];
  const fresh = n(fs?.fresh_wallets_net_flow_usd), smt = n(fs?.smart_trader_net_flow_usd), tp = n(fs?.top_pnl_net_flow_usd);
  const W = fs && mcap && (fresh != null || smt != null || tp != null) ? windShearScore({ freshWalletNetUsd: fresh ?? 0, smartMoneyNetUsd: (smt ?? 0) + (tp ?? 0), marketCapUsd: mcap }) : null;

  // P: sell skew among the largest traders over 7 days (insider share not rebuilt).
  const trades = rows(w);
  const buy = trades.reduce((s, r) => s + (n(r.bought_volume_usd) ?? 0), 0), sell = trades.reduce((s, r) => s + (n(r.sold_volume_usd) ?? 0), 0);
  const P = trades.length ? sellPressureScore({ top20BuyUsd: buy, top20SellUsd: sell, insiderSellUsd: 0 }).score : null;

  // R: mean percentile of Nansen's risk indicators (minus liquidity risk, which sits in L).
  const risk = rows(q).filter((r) => String(r.model_type ?? '').toLowerCase().includes('risk') && r.indicator_type !== 'liquidity-risk' && n(r.signal_percentile) != null);
  const R = risk.length ? risk.reduce((s, r) => s + n(r.signal_percentile)!, 0) / risk.length : null;
  const liqPct = n(rows(q).find((r) => r.indicator_type === 'liquidity-risk')?.signal_percentile);

  // L: liquidity against market cap at the date.
  const liq = n(screen?.liquidity);
  const L = liq != null && mcap ? exitLiquidityScore({ liquidityUsd: liq, marketCapUsd: mcap, nansenLiquidityRiskPercentile: liqPct ?? undefined, maxClusterShare: 0 }).score : null;

  const subScores: StormSubScores = { concentration: C, insider: null, windShear: W, exitLiquidity: L, sellPressure: P, nansenRisk: R };
  const present = Object.values(subScores).some((v) => v != null);
  const composite = present ? compositeStormScore(subScores) : null;

  // Label: worst close-to-low over the next 7 daily candles, from the as-of close.
  const candles = (o && typeof o === 'object' && Array.isArray((o as { data?: unknown }).data) ? (o as { data: Row[] }).data : [])
    .map((c) => ({ t: String(c.interval_start ?? ''), close: n(c.close), low: n(c.low) })).filter((c) => c.t && c.close != null).sort((a, z) => a.t.localeCompare(z.t));
  const start = candles.find((c) => c.t.slice(0, 10) === asOf)?.close ?? candles[0]?.close ?? null;
  const next = candles.filter((c) => c.t.slice(0, 10) > asOf).slice(0, 7);
  const minLow = next.length ? Math.min(...next.map((c) => c.low ?? c.close!)) : null;
  const dd = start && minLow != null ? 1 - minLow / start : null;
  return {
    chain, token, symbol, asOf, subScores, storm: composite?.score ?? NaN, missing: composite?.missing ?? [],
    maxDrawdown7d: dd, event50: dd == null ? null : dd >= 0.5 ? 1 : 0, event30: dd == null ? null : dd >= 0.3 ? 1 : 0,
  };
}

/** The pilot: a few token-dates, to prove the reconstruction and price the real fit. */
export async function runStormV2(opts: { chain?: string; anchorsDaysAgo?: number[]; perAnchor?: number; cap: number; now?: number; kind?: 'pilot' | 'full'; log?: (s: string) => void }): Promise<V2Report> {
  const chain = opts.chain ?? 'base';
  const now = opts.now ?? Date.now();
  const b = new Budget(opts.cap);
  const observations: V2Observation[] = [];
  const log = opts.log ?? (() => {});
  try {
    for (const d of opts.anchorsDaysAgo ?? [29, 15]) {
      const asOf = iso(now - d * 86_400_000);
      const scr = await b.call<unknown>('v1beta1/token-screener/historical', {
        to_date: asOf, timeframe_days: 7, chains: [chain], trader_type: 'all',
        filters: { market_cap_usd: { min: 5_000_000, max: 5_000_000_000 }, volume_usd: { min: 100_000 } },
        pagination: { page: 1, per_page: 60 }, order_by: [{ field: 'volume', direction: 'DESC' }],
      }, 5);
      // Pegged prices catch stablecoins no symbol list knows yet.
      const pegged = (r: Row) => { const p = n(r.price_usd); return p != null && p > 0.97 && p < 1.03; };
      const universe = rows(scr).filter((r) => !isStablecoin(String(r.token_symbol ?? '')) && !isMajorOrWrapped(String(r.token_symbol ?? '')) && !pegged(r) && (n(r.market_cap_usd) ?? 0) >= 5_000_000 && (n(r.token_age_days) ?? 0) >= 7);
      for (const r of universe.slice(0, opts.perAnchor ?? 2)) {
        const token = String(r.token_address);
        log(`${asOf} ${r.token_symbol}`);
        observations.push(await observe(b, chain, token, String(r.token_symbol ?? token.slice(0, 6)), asOf, r));
      }
    }
  } catch (e) {
    b.failed.push(`stopped: ${(e as Error).message}`);
  }
  const count = (k: keyof StormSubScores) => observations.filter((o) => o.subScores[k] != null).length;
  const perObs = PER_OBSERVATION_CREDITS;
  const power = [
    { event: '50% drawdown within 7 days (the dump event)', baseRate: 0.042 },
    { event: '30% drawdown within 7 days', baseRate: 0.15 },
  ].map((p) => { const need = requiredObservations(0.7, 0.6, p.baseRate); return { ...p, needed: need, credits: need ? need.n * perObs : null }; });
  return {
    generatedAt: new Date(now).toISOString(), kind: opts.kind ?? 'pilot', cap: opts.cap,
    creditsSpent: b.spent, creditsNominal: b.nominal, calls: b.calls, perObservationCredits: perObs, observations,
    coverage: { concentration: count('concentration'), windShear: count('windShear'), sellPressure: count('sellPressure'), nansenRisk: count('nansenRisk'), exitLiquidity: count('exitLiquidity'), label: observations.filter((o) => o.maxDrawdown7d != null).length },
    power,
    decision: `Expert priors kept. Replacing them needs an out-of-sample AUC above 0.70 with a 95% lower bound above 0.60; at the dump event's ${(power[0].baseRate * 100).toFixed(1)}% base rate that takes about ${power[0].needed?.n.toLocaleString('en-US')} point-in-time observations (≈${power[0].credits?.toLocaleString('en-US')} credits at ${perObs} credits each), and ${power[1].needed?.n.toLocaleString('en-US')} (≈${power[1].credits?.toLocaleString('en-US')} credits) for a 30% drawdown. Both exceed the 5,000-credit budget for this module.`,
    failed: b.failed,
  };
}
