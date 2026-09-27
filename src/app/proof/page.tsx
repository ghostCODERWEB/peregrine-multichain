import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { PageTitle } from '@/components/PageTitle';
import { RocChart } from '@/components/lab/LabCharts';
import { loadBacktest } from '@/server/token/forecast';
import { weatherMap, pressureForecast } from '@/server/weather/queries';
import { displayMode, viewOf } from '@/server/mode';
import { num, pct } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Proof · Peregrine' };

type Ledger = { window: { from: string; to: string }; calls: number; cached: number; endpoints: Array<{ endpoint: string; calls: number; cached: number; credits: number }>; days: Array<{ day: string; calls: number }> };
function ledger(): Ledger | null {
  try { return JSON.parse(fs.readFileSync(path.resolve('fixtures/proof-ledger.json'), 'utf8')) as Ledger; } catch { return null; }
}

/** Proof, on one screen: how much of Nansen Peregrine uses, and how well its models hold up on data they never saw. */
export default async function ProofPage() {
  const L = ledger();
  const bt = loadBacktest();
  const s = bt?.storm, b = bt?.breakout;
  const now = Date.now();
  const mode = viewOf(await displayMode());
  const mapes = weatherMap(now, mode).filter((c) => c.cpi != null).map((c) => pressureForecast(c.chain, 24, now, mode).mape).filter((m): m is number => m != null).sort((a, c) => a - c);
  const families = L ? Object.entries(L.endpoints.reduce<Record<string, number>>((a, e) => { const g = e.endpoint.split('/')[0]; a[g] = (a[g] ?? 0) + e.calls; return a; }, {})).sort((x, y) => y[1] - x[1]) : [];
  const maxFam = families[0]?.[1] ?? 1;
  const maxDay = Math.max(1, ...(L?.days.map((d) => d.calls) ?? [1]));

  const models = [
    s && { name: 'Dump risk (Token Score)', what: '≥50% drawdown within 7 days', metric: `AUC ${num(s.fitted.auc, 2)}`, vs: `prior ${num(s.expert.auc, 2)}`, sample: `${s.test.n} tests · ${s.test.events} events`, ok: s.passes },
    b && { name: 'Breakout', what: '≥30% run-up within 7 days', metric: `AUC ${num(b.fitted.auc, 2)}`, vs: `prior ${num(b.expert.auc, 2)}`, sample: `${b.test.n} tests · ${b.test.events} events`, ok: b.passes },
    bt?.cone?.[0] && { name: 'Volatility cone', what: 'price inside the 80% band, 1 day', metric: pct(bt.cone[0].coverage, 0), vs: 'target 80%', sample: `${bt.cone[0].n} token-days`, ok: Math.abs(bt.cone[0].coverage - 0.8) < 0.1 },
    mapes.length > 0 && { name: 'Flow projections', what: 'next Flow Index reading, per chain', metric: `${num(mapes[Math.floor(mapes.length / 2)], 1)}% error`, vs: 'median, one step', sample: `${mapes.length} chains`, ok: true },
  ].filter(Boolean) as Array<{ name: string; what: string; metric: string; vs: string; sample: string; ok: boolean }>;

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      <PageTitle title="Proof" pill="What Peregrine reads from Nansen, and how well it predicts" />

      <section className="material grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_1.1fr]" aria-label="Nansen usage">
        <div>
          <p className="text-[12px] font-semibold text-ink-muted">Nansen API calls during the buildathon</p>
          <p className="num mt-1 text-[34px] font-extrabold leading-none tracking-[-0.03em] text-ink">{L ? L.calls.toLocaleString('en-US') : 'n/a'}</p>
          <p className="mt-1 text-[12.5px] text-ink-2">{L ? `${num(L.calls / 1000, 1)}× the 1,000 required · ${L.endpoints.length} endpoints · ${L.cached.toLocaleString('en-US')} more served from cache` : ''}</p>
          <div className="mt-4 flex h-[64px] items-end gap-1" role="img" aria-label="Calls per day">
            {L?.days.map((d) => <span key={d.day} title={`${d.day}: ${d.calls} calls`} className="flex-1 rounded-t-[3px] bg-[var(--mint)]" style={{ height: `${Math.max(4, (d.calls / maxDay) * 100)}%`, opacity: 0.45 + 0.55 * (d.calls / maxDay) }} />)}
          </div>
          <p className="num mt-1 flex justify-between text-[10.5px] text-ink-muted"><span>{L?.window.from.slice(5, 10)}</span><span>calls per day</span><span>{L?.window.to.slice(5, 10)}</span></p>
        </div>
        <ul className="grid grid-cols-2 gap-x-5 gap-y-1.5 self-center">
          {families.slice(0, 10).map(([g, c]) => (
            <li key={g} className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2 text-[12px]">
              <span className="min-w-0"><span className="block truncate font-semibold text-ink">{g}</span><span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full bg-[var(--mint)]" style={{ width: `${(c / maxFam) * 100}%` }} /></span></span>
              <span className="num text-right text-ink-2">{c.toLocaleString('en-US')}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="material grid gap-5 p-4 sm:p-5 lg:grid-cols-[1.4fr_1fr]" aria-labelledby="models">
        <div className="min-w-0">
          <h2 id="models" className="t-section">Do the models work?</h2>
          <p className="mb-3 text-[12px] text-ink-muted">{bt ? `Trained on earlier weeks, tested on ${bt.anchors.at(-1)}, which they never saw · ${bt.samples} token-weeks, ${bt.tokens} tokens, Nansen point-in-time data` : 'Runs with the backtest.'}</p>
          <ul className="divide-y divide-[var(--hair)]">
            {models.map((m) => (
              <li key={m.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                <span className="min-w-0"><span className="block text-[13.5px] font-semibold text-ink">{m.name}</span><span className="block truncate text-[11.5px] text-ink-muted">{m.what} · {m.sample}</span></span>
                <span className="text-right"><span className="num block text-[15px] font-bold" style={{ color: m.ok ? 'var(--mint)' : 'var(--amber)' }}>{m.metric}</span><span className="num block text-[11px] text-ink-muted">{m.vs}</span></span>
              </li>
            ))}
          </ul>
          {s && <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">Dump test: {s.test.events} events · AUC 95% CI {num(s.fitted.aucCi?.[0], 2)}–{num(s.fitted.aucCi?.[1], 2)} · re-tested weekly.</p>}
        </div>
        {s && (
          <div className="mx-auto w-full max-w-[340px]">
            <p className="mb-1 text-center text-[11.5px] font-semibold text-ink-muted">Dump risk: fitted (solid) vs prior (dashed)</p>
            <RocChart fitted={s.fitted.roc} expert={s.expert.roc} fittedAuc={s.fitted.auc} expertAuc={s.expert.auc} />
          </div>
        )}
      </section>

      <details className="material p-4 text-[12.5px] sm:p-5">
        <summary className="cursor-pointer font-semibold text-ink-2 hover:text-ink">All {L?.endpoints.length ?? 0} Nansen endpoints, by calls</summary>
        <table className="mt-3 w-full text-left">
          <tbody>
            {L?.endpoints.map((e) => (
              <tr key={e.endpoint} className="border-t border-[var(--hair)]"><td className="py-1 pr-3 font-mono text-[11.5px] text-ink">{e.endpoint}</td><td className="num py-1 text-right text-ink-2">{e.calls.toLocaleString('en-US')}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
