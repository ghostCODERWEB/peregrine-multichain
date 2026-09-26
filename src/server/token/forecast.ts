// Spec 5.4: the token's 7-day storm probability (P(max drawdown >= 50%))
// and breakout probability (P(run-up >= +30%)), from the logistic models
// the Forecast Lab fitted. The inputs are rebuilt exactly as in training —
// the live token-screener over 7 days (all traders, and smart money where
// Nansen labels it) plus daily volatility from the token's own candles —
// and every probability ships with its out-of-sample track record.
import fs from 'node:fs';
import path from 'node:path';
import { traced, errText, type Wave } from '@/server/nansen/traced';
import { chainCapability, endpointUnavailable } from '@/lib/registry';
import { predictLogistic } from '@/lib/models/logistic';
import { logReturns, ewmaVolatility } from '@/lib/models/volatility-cone';
import type { BacktestResult, ModelReport } from '@/server/backtest/run';
import type { Candle } from './waves';
import type { Provenance } from '@/lib/provenance';
import { num, pct, usd } from '@/lib/viz/format';

export interface Odds {
  p: number;
  baseRate: number;
  auc: number | null;
  aucCi: [number, number] | null;
  testN: number;
  testEvents: number;
  testAnchor: string;
  passes: boolean;
  definition: string;
}

export interface ForecastWave {
  storm: Odds;
  breakout: Odds;
  /** The chain wasn't in the training set: the model is being extrapolated. */
  extrapolated: boolean;
  trainedOn: string[];
  provenance: Provenance;
}

let cached: { at: number; r: BacktestResult | null } | null = null;
export function loadBacktest(): BacktestResult | null {
  if (cached && Date.now() - cached.at < 60_000) return cached.r;
  let r: BacktestResult | null = null;
  try {
    r = JSON.parse(fs.readFileSync(path.resolve('fixtures/backtest-results.json'), 'utf8')) as BacktestResult;
  } catch { r = null; }
  cached = { at: Date.now(), r };
  return r;
}

interface ScreenerRow {
  token_address: string; price_change?: number | null; market_cap_usd?: number | null; fdv_mc_ratio?: number | null;
  volume?: number | null; buy_volume?: number | null; sell_volume?: number | null; netflow?: number | null;
  outflow_fdv_ratio?: number | null; token_age_days?: number | null;
}

/** Daily closes from 4h candles: the last close of each UTC day. */
function dailyCloses(candles: Candle[]): number[] {
  const byDay = new Map<string, number>();
  for (const c of candles) byDay.set(new Date(c.t).toISOString().slice(0, 10), c.c);
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
}

const log10 = (v: number | null | undefined) => (v != null && v > 0 ? Math.log10(v) : 0);

export async function forecastWave(chain: string, token: string, candles: Candle[] | null): Promise<Wave<ForecastWave>> {
  const bt = loadBacktest();
  if (!bt) return { unavailable: 'No backtest has been run yet (pnpm backtest), so there is no fitted model to project with.' };
  const gap = endpointUnavailable('tokenScreener', chain, 'Projection inputs (token screener)');
  if (gap) return { unavailable: gap };
  if (!candles || candles.length < 13 * 6) return { unavailable: 'The projection needs two weeks of candles for this token’s volatility, and Nansen has fewer.' };
  try {
    const body = (smart: boolean) => ({
      chains: [chain], timeframe: '7d', pagination: { page: 1, per_page: 5 },
      filters: { token_address: token, include_stablecoins: true, include_native_tokens: true, ...(smart ? { trader_type: 'sm' } : {}) },
    });
    const sm = !!chainCapability(chain)?.smartMoney;
    const [all, smr] = await Promise.all([
      traced<{ data: ScreenerRow[] }>('token-screener', body(false), 1),
      sm ? traced<{ data: ScreenerRow[] }>('token-screener', body(true), 1) : Promise.resolve(null),
    ]);
    const row = all.data.data.find((r) => r.token_address.toLowerCase() === token.toLowerCase()) ?? all.data.data[0];
    if (!row || !row.market_cap_usd || !row.volume) {
      return { unavailable: 'Nansen’s screener has no 7-day row with volume and market cap for this token, so the model’s inputs are missing.' };
    }
    const smRow = smr?.data.data.find((r) => r.token_address.toLowerCase() === token.toLowerCase());
    const smNet = smRow?.netflow ?? 0;
    const vol = ewmaVolatility(logReturns(dailyCloses(candles)));
    // Same order as FEATURES in the backtest.
    const x = [
      ((row.sell_volume ?? 0) - (row.buy_volume ?? 0)) / row.volume,
      log10(row.volume / row.market_cap_usd),
      row.price_change ?? 0,
      Math.log10(row.market_cap_usd),
      log10((row.token_age_days ?? 0) + 1),
      log10(row.fdv_mc_ratio),
      Math.min(row.outflow_fdv_ratio ?? 0, 5),
      sm ? smNet / row.market_cap_usd : 0,
      vol,
    ];
    const odds = (m: ModelReport): Odds => ({
      p: predictLogistic(m.model, x),
      baseRate: m.train.events / Math.max(1, m.train.n),
      auc: m.fitted.auc, aucCi: m.fitted.aucCi, testN: m.test.n, testEvents: m.test.events, testAnchor: m.test.anchor,
      passes: m.passes, definition: m.definition,
    });
    const extrapolated = !bt.chains.includes(chain);
    const storm = odds(bt.storm), breakout = odds(bt.breakout);
    return {
      storm, breakout, extrapolated, trainedOn: bt.chains,
      provenance: {
        title: '7-day odds, calibrated logistic models',
        formula: 'P = sigmoid(b0 + Σ w_j · clip((x_j − μ_j)/σ_j, ±5))\nw, μ, σ fitted in the Backtest Lab (train: older anchors, test: newest)',
        inputs: [
          { label: 'Sell skew, 7d', value: pct(x[0], 0) },
          { label: 'Volume / mcap, 7d', value: `${num(10 ** x[1], 2)}×` },
          { label: 'Price change, 7d', value: pct(x[2], 0) },
          { label: 'Market cap', value: usd(row.market_cap_usd) },
          { label: 'Smart-money net, 7d', value: sm ? usd(smNet, { signed: true }) : 'no labels on chain' },
          { label: 'Daily volatility (EWMA)', value: pct(vol) },
          { label: 'P(dump) · P(breakout)', value: `${pct(storm.p, 1)} · ${pct(breakout.p, 1)}` },
        ],
        calls: [all.call, ...(smr ? [smr.call] : [])],
        notes: [
          `Out of sample (${bt.storm.test.anchor}): dump AUC ${num(bt.storm.fitted.auc, 2)} on ${bt.storm.test.events} events; breakout AUC ${num(bt.breakout.fitted.auc, 2)} on ${bt.breakout.test.events}.`,
          ...(extrapolated ? [`Trained on ${bt.chains.join(', ')}; applying it on this chain is an extrapolation.`] : []),
        ],
      },
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}
