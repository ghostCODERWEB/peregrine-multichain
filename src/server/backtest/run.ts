// The Forecast Lab's backtest (spec 5.5), sized for a credit budget.
//
//  1. Universe + features, point in time: token-screener/historical at four
//     anchor dates two weeks apart (so 7-day outcome windows never overlap),
//     one call per chain per anchor, all traders and — on Tier A chains —
//     smart money. Only fields the screener knew AT the anchor are used.
//  2. Labels: live tgm/token-ohlcv, 1d candles, batched 10 tokens per call,
//     covering every anchor and its following week in one request. The
//     same candles give each token's volatility as of the anchor (only
//     candles before it) and the cone's calibration.
//  3. L2 logistic regression, trained on the three older anchors and tested
//     on the newest (time split, no shuffling), for the storm event
//     (max drawdown >= 50% within 7d) and the breakout event (+30%).
//
// Every call goes through the normal client (cached forever: v1beta1 and
// the fixed-date OHLCV windows never change), and a guard stops the run
// before a call that would push spend past BACKTEST_CREDIT_CAP.
import { callNansen } from '@/server/nansen/client';
import { chainCapability } from '@/lib/registry';
import { isBaseAsset } from '@/lib/models/trade-side';
import { fitLogistic, predictLogistic } from '@/lib/models/logistic';
import { auc, aucInterval, brier, calibration, rocCurve, hitRate, type CalibrationBin, type RocPoint } from '@/lib/models/metrics';
import type { LogisticModel } from '@/lib/models/logistic';
import { logReturns, ewmaVolatility } from '@/lib/models/volatility-cone';
import type { TokenOHLCVBatchResponse } from '@/types/nansen/token-god-mode';

/** Chains with the most Nansen history, two tiers so per-tier metrics mean
 *  something. Read against the registry at run time, not trusted blindly. */
const CANDIDATE_CHAINS = ['base', 'bnb', 'ethereum', 'solana', 'sui', 'tron'];
const ANCHOR_DAYS_AGO = [57, 43, 29, 15];
const PER_CHAIN = 60;
const DRAWDOWN = 0.5;
const BREAKOUT = 0.3;
const HORIZON_DAYS = 7;

/** The historical screener labels BNB Chain "bsc"; every other endpoint says "bnb". */
const toApiChain = (c: string) => (c === 'bsc' ? 'bnb' : c);
const toScreenerChain = (c: string) => c; // the request accepts the enum ids

interface HistRow {
  token_address: string; token_symbol: string; chain: string;
  price_usd?: number | null; price_change?: number | null; market_cap_usd?: number | null; fdv?: number | null; fdv_mc_ratio?: number | null;
  volume?: number | null; buy_volume?: number | null; sell_volume?: number | null; netflow?: number | null;
  inflow_fdv_ratio?: number | null; outflow_fdv_ratio?: number | null; token_age_days?: number | null; liquidity?: number | null;
}

export const FEATURES = [
  'sell_skew', 'log_turnover', 'price_change_7d', 'log_mcap', 'log_age_days', 'log_fdv_mc', 'outflow_fdv', 'sm_netflow_mcap', 'vol_daily',
] as const;

/** Sign each feature carries in the Storm Score's expert logic: selling,
 *  small caps, supply overhang, smart-money exits and volatility raise
 *  dump risk. The baseline the fitted model has to beat. */
const EXPERT_SIGN: Record<(typeof FEATURES)[number], number> = {
  sell_skew: 1, log_turnover: 0.5, price_change_7d: 0, log_mcap: -1, log_age_days: -0.5, log_fdv_mc: 0.5, outflow_fdv: 0.5, sm_netflow_mcap: -1, vol_daily: 1,
};
/** Breakout prior (5.4): smart-money accumulation, net buying, momentum,
 *  small caps and volatility make a +30% week likelier. */
const EXPERT_SIGN_BREAKOUT: Record<(typeof FEATURES)[number], number> = {
  sell_skew: -1, log_turnover: 0.5, price_change_7d: 0.5, log_mcap: -1, log_age_days: -0.5, log_fdv_mc: 0, outflow_fdv: 0, sm_netflow_mcap: 1, vol_daily: 1,
};

interface Sample {
  chain: string; tier: string; token: string; symbol: string; anchor: string; anchorIdx: number;
  x: number[]; storm: 0 | 1; breakout: 0 | 1; maxDrawdown: number; maxRunup: number;
}

export interface ModelReport {
  event: string;
  definition: string;
  train: { n: number; events: number; anchors: string[] };
  test: { n: number; events: number; anchor: string };
  fitted: { auc: number | null; aucCi: [number, number] | null; brier: number | null; hitRate: number | null; calibration: CalibrationBin[]; roc: RocPoint[]; weights: Array<{ feature: string; weight: number }>; intercept: number };
  /** The fitted model itself, applied live on the token page. */
  model: LogisticModel;
  expert: { auc: number | null; brier: number | null; roc: RocPoint[] };
  baseRateBrier: number | null;
  perTier: Array<{ tier: string; n: number; events: number; auc: number | null; brier: number | null }>;
  passes: boolean;
}

export interface BacktestResult {
  generatedAt: string;
  /** Credits the full backtest costs against an empty cache. */
  creditsSpent: number;
  /** Credits this particular run spent (0 when fully cached). */
  creditsThisRun: number;
  calls: number;
  cap: number;
  chains: string[];
  anchors: string[];
  samples: number;
  tokens: number;
  storm: ModelReport;
  breakout: ModelReport;
  cone: Array<{ days: number; coverage: number; n: number }>;
  notes: string[];
  requests: Array<{ endpoint: string; body: unknown; credits: number }>;
}

class Budget {
  spent = 0;
  /** What the run costs uncached (listed credits per call) — the honest
   *  price of the backtest, even when this run was served from cache. */
  nominal = 0;
  calls = 0;
  requests: BacktestResult['requests'] = [];
  constructor(public cap: number) {}
  async call<T>(endpoint: string, body: unknown, credits: number): Promise<T> {
    if (this.spent + credits > this.cap) throw new Error(`BACKTEST_CREDIT_CAP ${this.cap} would be exceeded (spent ${this.spent}, next call ${credits}).`);
    const r = await callNansen<T>(endpoint, body, { record: false });
    this.spent += r.meta.creditsCost;
    this.nominal += credits;
    this.calls += 1;
    if (this.requests.length < 40) this.requests.push({ endpoint, body, credits });
    return r.data;
  }
}

const day = (now: number, d: number) => new Date(now - d * 86_400_000).toISOString().slice(0, 10);
const safeLog = (v: number | null | undefined) => (v != null && v > 0 ? Math.log10(v) : null);

export function estimateCredits(chains: string[], smChains: string[]): number {
  const screener = ANCHOR_DAYS_AGO.length * (chains.length + smChains.length) * 5;
  const ohlcv = Math.ceil((chains.length * PER_CHAIN * 1.6) / 10); // unique tokens across anchors, 10 per call
  return screener + ohlcv;
}

export async function runBacktest(opts: { cap: number; now?: number; log?: (s: string) => void }): Promise<BacktestResult> {
  const now = opts.now ?? Date.now();
  const log = opts.log ?? (() => {});
  const budget = new Budget(opts.cap);
  const chains = CANDIDATE_CHAINS.filter((c) => chainCapability(c)?.screener);
  const smChains = chains.filter((c) => chainCapability(c)?.smartMoney);
  const anchors = ANCHOR_DAYS_AGO.map((d) => day(now, d));
  log(`estimate: ~${estimateCredits(chains, smChains)} credits (cap ${opts.cap})`);

  // 1. Universe and point-in-time features.
  type Obs = { row: HistRow; sm: number | null; anchorIdx: number; chain: string };
  const obs: Obs[] = [];
  for (const [ai, anchor] of anchors.entries()) {
    for (const chain of chains) {
      const body = (trader: string) => ({
        to_date: anchor, timeframe_days: 7, chains: [toScreenerChain(chain)], trader_type: trader,
        filters: { market_cap_usd: { min: 1_000_000, max: 5_000_000_000 }, volume_usd: { min: 50_000 } },
        pagination: { page: 1, per_page: PER_CHAIN }, order_by: [{ field: 'volume', direction: 'DESC' }],
      });
      const all = await budget.call<{ data: HistRow[] }>('v1beta1/token-screener/historical', body('all'), 5);
      let sm = new Map<string, number>();
      if (smChains.includes(chain)) {
        const s = await budget.call<{ data: HistRow[] }>('v1beta1/token-screener/historical', body('sm'), 5);
        sm = new Map(s.data.map((r) => [r.token_address.toLowerCase(), r.netflow ?? 0]));
      }
      for (const row of all.data) {
        if (isBaseAsset(row.token_symbol)) continue;
        obs.push({ row, sm: smChains.includes(chain) ? sm.get(row.token_address.toLowerCase()) ?? 0 : null, anchorIdx: ai, chain });
      }
      log(`  ${anchor} ${chain}: ${all.data.length} rows · spent ${budget.spent}`);
    }
  }

  // 2. Labels (and point-in-time volatility) from daily candles.
  const byChain = new Map<string, Set<string>>();
  for (const o of obs) {
    const set = byChain.get(o.chain) ?? new Set<string>();
    set.add(o.row.token_address);
    byChain.set(o.chain, set);
  }
  const candles = new Map<string, Array<{ t: number; h: number; l: number; c: number }>>();
  const from = day(now, ANCHOR_DAYS_AGO[0] + 16);
  for (const [chain, set] of byChain) {
    const tokens = [...set];
    for (let i = 0; i < tokens.length; i += 10) {
      const batch = tokens.slice(i, i + 10);
      const body = { chain: toApiChain(chain), token_addresses: batch, timeframe: '1d', date: { from, to: day(now, 0) } };
      try {
        const r = await budget.call<TokenOHLCVBatchResponse>('tgm/token-ohlcv', body, 1);
        for (const t of r.tokens) {
          candles.set(`${chain}:${t.token_address.toLowerCase()}`, t.data
            .filter((k) => k.high != null && k.low != null && k.close != null && k.close > 0)
            .map((k) => ({ t: Date.parse(k.interval_start), h: k.high!, l: k.low!, c: k.close! }))
            .sort((a, b) => a.t - b.t));
        }
      } catch (e) {
        if ((e as Error).message.includes('BACKTEST_CREDIT_CAP')) throw e;
        log(`  ohlcv ${chain} batch ${i / 10}: ${(e as Error).message.slice(0, 100)}`);
      }
    }
    log(`  candles ${chain}: ${tokens.length} tokens · spent ${budget.spent}`);
  }

  // 3. Assemble samples.
  const samples: Sample[] = [];
  const coneHits = new Map<number, { hit: number; n: number }>([[1, { hit: 0, n: 0 }], [3, { hit: 0, n: 0 }], [7, { hit: 0, n: 0 }]]);
  for (const o of obs) {
    const k = candles.get(`${o.chain}:${o.row.token_address.toLowerCase()}`);
    if (!k) continue;
    const anchorT = Date.parse(`${anchors[o.anchorIdx]}T00:00:00Z`);
    const i0 = k.findIndex((c) => c.t === anchorT);
    if (i0 < 13 || i0 + HORIZON_DAYS >= k.length) continue; // need history before and a full week after
    const entry = k[i0].c;
    const fwd = k.slice(i0 + 1, i0 + 1 + HORIZON_DAYS);
    const maxDrawdown = 1 - Math.min(...fwd.map((c) => c.l)) / entry;
    const maxRunup = Math.max(...fwd.map((c) => c.h)) / entry - 1;
    const vol = ewmaVolatility(logReturns(k.slice(0, i0 + 1).map((c) => c.c)));

    for (const [d, acc] of coneHits) {
      const later = k[i0 + d]?.c;
      if (!later) continue;
      acc.n++;
      if (Math.abs(Math.log(later / entry)) <= 1.28 * vol * Math.sqrt(d)) acc.hit++;
    }

    const r = o.row;
    const mcap = r.market_cap_usd ?? null;
    const volume = r.volume ?? 0;
    if (!mcap || !volume) continue;
    const x = [
      ((r.sell_volume ?? 0) - (r.buy_volume ?? 0)) / volume,
      safeLog(volume / mcap) ?? 0,
      r.price_change ?? 0,
      Math.log10(mcap),
      safeLog((r.token_age_days ?? 0) + 1) ?? 0,
      safeLog(r.fdv_mc_ratio) ?? 0,
      Math.min(r.outflow_fdv_ratio ?? 0, 5),
      o.sm == null ? 0 : o.sm / mcap,
      vol,
    ];
    if (x.some((v) => !Number.isFinite(v))) continue;
    samples.push({
      chain: toApiChain(o.chain), tier: chainCapability(toApiChain(o.chain))?.tier ?? '?', token: r.token_address, symbol: r.token_symbol,
      anchor: anchors[o.anchorIdx], anchorIdx: o.anchorIdx, x,
      storm: maxDrawdown >= DRAWDOWN ? 1 : 0, breakout: maxRunup >= BREAKOUT ? 1 : 0, maxDrawdown, maxRunup,
    });
  }
  if (samples.length < 50) throw new Error(`Only ${samples.length} usable samples; not enough to fit anything honestly.`);

  const testIdx = anchors.length - 1;
  const report = (event: 'storm' | 'breakout', definition: string): ModelReport => {
    const train = samples.filter((s) => s.anchorIdx < testIdx);
    const test = samples.filter((s) => s.anchorIdx === testIdx);
    const ytr: number[] = train.map((s) => s[event]), yte: number[] = test.map((s) => s[event]);
    const m = fitLogistic(train.map((s) => s.x), ytr, [...FEATURES], 5);
    const p = test.map((s) => predictLogistic(m, s.x));
    // Expert baseline: standardized features times fixed signs, squashed.
    const sign = FEATURES.map((f) => (event === 'storm' ? EXPERT_SIGN[f] : EXPERT_SIGN_BREAKOUT[f]));
    const ex = test.map((s) => 1 / (1 + Math.exp(-s.x.reduce((acc, v, j) => acc + sign[j] * ((v - m.mean[j]) / m.std[j]), 0) / 2)));
    const rate = ytr.reduce((a, b) => a + b, 0) / Math.max(1, ytr.length);
    const tiers = [...new Set(test.map((s) => s.tier))].sort();
    const fittedAuc = auc(p, yte);
    return {
      event, definition,
      train: { n: train.length, events: ytr.reduce((a, b) => a + b, 0), anchors: anchors.slice(0, testIdx) },
      test: { n: test.length, events: yte.reduce((a, b) => a + b, 0), anchor: anchors[testIdx] },
      fitted: {
        auc: fittedAuc, aucCi: aucInterval(fittedAuc, yte.filter((v) => v === 1).length, yte.filter((v) => v === 0).length),
        brier: brier(p, yte), hitRate: hitRate(p, yte, 0.5), calibration: calibration(p, yte, 10), roc: rocCurve(p, yte),
        weights: FEATURES.map((f, j) => ({ feature: f, weight: m.weights[j] })), intercept: m.intercept,
      },
      model: m,
      expert: { auc: auc(ex, yte), brier: brier(ex, yte), roc: rocCurve(ex, yte) },
      baseRateBrier: brier(test.map(() => rate), yte),
      perTier: tiers.map((t) => {
        const ix = test.map((s, i) => (s.tier === t ? i : -1)).filter((i) => i >= 0);
        return { tier: t, n: ix.length, events: ix.reduce((a, i) => a + yte[i], 0), auc: auc(ix.map((i) => p[i]), ix.map((i) => yte[i])), brier: brier(ix.map((i) => p[i]), ix.map((i) => yte[i])) };
      }),
      passes: fittedAuc != null && fittedAuc > 0.7,
    };
  };

  const empty = chains.filter((c) => !obs.some((o) => o.chain === c));
  const storm = report('storm', `max drawdown ≥ ${DRAWDOWN * 100}% within ${HORIZON_DAYS} days of the anchor close`);
  const breakout = report('breakout', `max run-up ≥ +${BREAKOUT * 100}% within ${HORIZON_DAYS} days of the anchor close`);
  return {
    generatedAt: new Date(now).toISOString(),
    creditsSpent: budget.nominal, creditsThisRun: budget.spent, calls: budget.calls, cap: opts.cap,
    chains: chains.filter((c) => !empty.includes(c)).map(toApiChain), anchors, samples: samples.length, tokens: new Set(samples.map((s) => `${s.chain}:${s.token}`)).size,
    storm, breakout,
    cone: [...coneHits.entries()].map(([days, a]) => ({ days, coverage: a.n ? a.hit / a.n : 0, n: a.n })),
    notes: [
      'Features are the ones Nansen serves point in time (historical screener + prior candles). The live Storm Score also uses holders and insider clusters, which have no point-in-time endpoint; so this tests the Storm logic on its flow, liquidity and volatility signals, not every input.',
      'Time split: trained on the three older anchors, tested on the newest. Samples within an anchor share market conditions, so the test set is one market regime.',
      'Stablecoins and native/wrapped gas tokens are excluded.',
      ...(empty.length ? [`Nansen's historical screener returned no rows for ${empty.join(', ')}, so those chains (and Tier B) are untested here.`] : []),
    ],
    requests: budget.requests,
  };
}
