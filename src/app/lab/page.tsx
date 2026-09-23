import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { CalibrationPlot, RocChart, WeightBars } from '@/components/lab/LabCharts';
import { loadBacktest } from '@/server/token/forecast';
import { weatherMap, pressureForecast } from '@/server/weather/queries';
import { chainName, num, pct } from '@/lib/viz/format';
import type { ModelReport } from '@/server/backtest/run';
import type { Provenance } from '@/lib/provenance';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Forecast Lab — TIDE' };

const FEATURE_LABEL: Record<string, string> = {
  sell_skew: 'Sell skew, 7d', log_turnover: 'Volume / mcap', price_change_7d: 'Price change, 7d', log_mcap: 'Market cap (log)',
  log_age_days: 'Token age (log)', log_fdv_mc: 'FDV / mcap (log)', outflow_fdv: 'Outflow / FDV', sm_netflow_mcap: 'Smart-money net / mcap', vol_daily: 'Daily volatility',
};

function verdict(r: ModelReport): string {
  const a = r.fitted.auc, ci = r.fitted.aucCi;
  if (a == null) return 'Not enough events in the test window to score this model.';
  const vsExpert = r.expert.auc != null ? (a > r.expert.auc ? `beats the expert prior (${num(r.expert.auc, 2)})` : `does not beat the expert prior (${num(r.expert.auc, 2)})`) : '';
  const bar = a > 0.7
    ? ci && ci[0] < 0.7 ? `clears the 0.70 bar on the point estimate, but its 95% interval reaches down to ${num(ci[0], 2)} — ${r.test.events} events is thin evidence` : 'clears the 0.70 bar'
    : 'does not clear the 0.70 bar';
  return `Out of sample, AUC ${num(a, 2)} ${bar}, and ${vsExpert}.`;
}

function ModelSection({ id, r, title }: { id: string; r: ModelReport; title: string }) {
  const prov: Provenance = {
    title: `${title} — backtest`,
    formula: 'L2 logistic regression (λ = 5) on standardized, ±5-clipped features\ntrain: older anchors · test: newest anchor (time split)\nAUC by Mann-Whitney; 95% CI Hanley-McNeil; Brier = mean (p − y)²',
    inputs: [
      { label: 'Event', value: r.definition },
      { label: 'Train', value: `${r.train.n} tokens, ${r.train.events} events (${r.train.anchors.join(', ')})` },
      { label: 'Test', value: `${r.test.n} tokens, ${r.test.events} events (${r.test.anchor})` },
      { label: 'Intercept', value: num(r.fitted.intercept, 3) },
    ],
    calls: [],
  };
  const tiles: Array<[string, string, string]> = [
    ['AUC (test)', num(r.fitted.auc, 2), r.fitted.aucCi ? `95% CI ${num(r.fitted.aucCi[0], 2)}–${num(r.fitted.aucCi[1], 2)}` : ''],
    ['Brier', num(r.fitted.brier, 3), `always-base-rate ${num(r.baseRateBrier, 3)}`],
    ['Hit rate @ 50%', pct(r.fitted.hitRate, 0), `always "no" scores ${pct(1 - r.test.events / Math.max(1, r.test.n), 0)}`],
    ['Test sample', String(r.test.n), `${r.test.events} events`],
  ];
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="text-lg font-semibold text-ink">{title}: {verdict(r)}</h2>
        <p className="text-sm text-ink-2">Event: {r.definition}. {r.passes ? 'Its probabilities are what the token page shows as 7-day odds.' : 'Shown on token pages with this record attached.'}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([k, v, sub]) => (
          <div key={k} className="rounded-lg border border-border bg-surface px-3 py-2">
            <div className="text-[11px] text-ink-muted">{k}</div>
            <div className="num text-xl font-semibold text-ink">{v}</div>
            <div className="num text-[11px] text-ink-muted">{sub}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card id={`${id}-roc`} title="Ranking: ROC against the expert prior" sub="How often a real event outranks a non-event. Diagonal = coin flip." action={<InfoPopover p={prov} />}>
          <RocChart fitted={r.fitted.roc} expert={r.expert.roc} fittedAuc={r.fitted.auc} expertAuc={r.expert.auc} />
        </Card>
        <Card id={`${id}-cal`} title="Calibration: does 10% mean 10%?" sub="Test tokens in deciles of predicted probability; dot area = tokens. On the diagonal = calibrated.">
          <CalibrationPlot bins={r.fitted.calibration} />
        </Card>
        <Card id={`${id}-w`} title="What the model learned" sub="Standardized coefficients: right raises the odds, left lowers them.">
          <WeightBars weights={r.fitted.weights} labels={FEATURE_LABEL} />
          <table className="mt-3 w-full text-[12px]">
            <thead><tr className="border-b border-border text-left text-[11px] text-ink-muted"><th className="py-1 font-normal">Tier</th><th className="py-1 text-right font-normal">n</th><th className="py-1 text-right font-normal">events</th><th className="py-1 text-right font-normal">AUC</th><th className="py-1 text-right font-normal">Brier</th></tr></thead>
            <tbody>
              {r.perTier.map((t) => (
                <tr key={t.tier} className="border-b border-border/50"><td className="py-1 text-ink-2">Tier {t.tier}</td><td className="num py-1 text-right">{t.n}</td><td className="num py-1 text-right">{t.events}</td><td className="num py-1 text-right">{num(t.auc, 2)}</td><td className="num py-1 text-right">{num(t.brier, 3)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </section>
  );
}

export default function LabPage() {
  const bt = loadBacktest();
  const now = Date.now();
  const cpi = weatherMap(now).filter((c) => c.cpi != null).map((c) => pressureForecast(c.chain, 24, now));
  const scored = cpi.filter((f) => f.mape != null).sort((a, b) => (a.mape ?? 0) - (b.mape ?? 0));
  const pending = cpi.filter((f) => f.mape == null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">
          {bt ? `Forecast Lab: every forecast in TIDE, scored on data it never saw` : 'Forecast Lab'}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          {bt
            ? <>Backtest of {bt.samples} token-weeks ({bt.tokens} tokens on {bt.chains.map(chainName).join(', ')}) at {bt.anchors.length} anchors from {bt.anchors[0]} to {bt.anchors.at(-1)}, built only from Nansen point-in-time data. It costs {bt.creditsSpent} credits in {bt.calls} calls against an empty cache (cap {bt.cap}); every historical response is then cached forever. Probabilistic statements only — not financial advice.</>
            : <>No backtest has been run yet. Run <code className="num">pnpm backtest</code> with a Nansen key; it prints its credit estimate first and stops at BACKTEST_CREDIT_CAP.</>}
        </p>
      </div>

      {bt && <ModelSection id="storm-model" r={bt.storm} title="Storm (≥50% drawdown in 7 days)" />}
      {bt && <ModelSection id="breakout-model" r={bt.breakout} title="Breakout (≥30% run-up in 7 days)" />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="cone" title={bt ? `Volatility cone: ${pct(bt.cone[0]?.coverage, 0)} of 1-day moves landed inside the 80% band` : 'Volatility cone'}
          sub="Every token-week in the backtest: was the price 1, 3 and 7 days later inside the cone drawn at the time? 80% is calibrated; higher means the cone is a little wide.">
          {bt ? (
            <ul className="space-y-2">
              {bt.cone.map((c) => (
                <li key={c.days} className="grid grid-cols-[3rem_1fr_6rem] items-center gap-2 text-[12.5px]">
                  <span className="text-ink-2">{c.days}d</span>
                  <span className="relative h-3 rounded-full bg-accent">
                    <span className="block h-3 rounded-full" style={{ width: `${c.coverage * 100}%`, background: 'var(--ink-2)' }} />
                    <span className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: '80%' }} title="80% target" />
                  </span>
                  <span className="num text-right text-ink">{pct(c.coverage, 0)} <span className="text-ink-muted">n={c.n}</span></span>
                </li>
              ))}
              <li className="text-[11px] text-ink-muted">Black tick = the 80% target.</li>
            </ul>
          ) : <Unavailable text="Runs with the backtest." />}
        </Card>

        <Card id="cpi" title={scored.length ? `Pressure forecasts: median error ${num(scored[Math.floor(scored.length / 2)].mape, 1)}% one step ahead` : 'Pressure forecasts: waiting for history'}
          sub="Holt forecasts of each chain's CPI, scored one step ahead on TIDE's own snapshots (in-sample MAPE). Chains unlock at 12 snapshots.">
          {scored.length ? (
            <div className="max-h-[280px] overflow-y-auto">
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 bg-surface"><tr className="border-b border-border text-left text-[11px] text-ink-muted"><th className="py-1 font-normal">Chain</th><th className="py-1 text-right font-normal">MAPE</th><th className="py-1 text-right font-normal">snapshots</th></tr></thead>
                <tbody>
                  {scored.map((f) => (
                    <tr key={f.chain} className="border-b border-border/50">
                      <td className="py-1"><Link href={`/chain/${f.chain}`} className="text-ink hover:underline">{chainName(f.chain)}</Link></td>
                      <td className="num py-1 text-right text-ink">{num(f.mape, 1)}%</td>
                      <td className="num py-1 text-right text-ink-muted">{f.sampleSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Unavailable text={`No chain has 12 snapshots yet (${pending.length} chains accumulating). The scanner adds one per chain every 30 minutes.`} />}
        </Card>
      </div>

      {bt && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-[15px] font-semibold text-ink">Method and limits</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-ink-2">
            {bt.notes.map((n) => <li key={n}>{n}</li>)}
            <li>The Storm Score on token pages keeps its expert-prior weights: its holder-concentration and insider inputs have no point-in-time endpoint, so they cannot be fitted here. The fitted model instead powers the separate 7-day odds, with this record next to them.</li>
            <li>Generated {bt.generatedAt.slice(0, 16).replace('T', ' ')} UTC by <code className="num">pnpm backtest</code>; results ship in the repo (fixtures/backtest-results.json) so DEMO_MODE shows them without a key.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
