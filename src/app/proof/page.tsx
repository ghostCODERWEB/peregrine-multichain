import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import type { Metadata } from 'next';
import { PageTitle } from '@/components/PageTitle';
import { StatStrip } from '@/components/StatStrip';
import { RocChart, CalibrationPlot } from '@/components/lab/LabCharts';
import { loadBacktest } from '@/server/token/forecast';
import { getDb } from '@/server/nansen/db';
import { num, pct } from '@/lib/viz/format';
import { Go } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Proof · Peregrine' };

type Ledger = { generatedAt: string; window: { from: string; to: string }; calls: number; cached: number; credits: number; endpoints: Array<{ endpoint: string; calls: number; cached: number; credits: number }>; days: Array<{ day: string; calls: number }> };

function ledger(): Ledger | null {
  try { return JSON.parse(fs.readFileSync(path.resolve('fixtures/proof-ledger.json'), 'utf8')) as Ledger; } catch { return null; }
}

/** What Peregrine actually did with Nansen, and whether its risk score works: the build's call ledger, this
 *  instance's live ledger, and the Token Score's out-of-sample backtest. Every number is read from a file or table. */
export default function ProofPage() {
  const L = ledger();
  const live = getDb().prepare('SELECT SUM(CASE WHEN cache_hit = 0 THEN 1 ELSE 0 END) AS calls, COUNT(DISTINCT endpoint) AS eps, MIN(called_at) AS since FROM credit_ledger').get() as { calls: number | null; eps: number; since: number | null };
  const bt = loadBacktest();
  const s = bt?.storm;
  const maxDay = Math.max(1, ...(L?.days.map((d) => d.calls) ?? [1]));
  const maxEp = Math.max(1, ...(L?.endpoints.map((e) => e.calls) ?? [1]));
  const groups = L ? Object.entries(L.endpoints.reduce<Record<string, number>>((a, e) => { const g = e.endpoint.split('/')[0]; a[g] = (a[g] ?? 0) + e.calls; return a; }, {})).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="space-y-5">
      <PageTitle title="Proof" pill="Nansen usage and model accuracy, measured" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <StatStrip className="xl:col-span-12" stats={[
          { label: 'Nansen API calls, buildathon', value: L ? L.calls.toLocaleString('en-US') : 'n/a', note: L ? `${num(L.calls / 1000, 1)}× the 1,000 required` : undefined, tone: 'in' },
          { label: 'Endpoints used', value: L ? String(L.endpoints.length) : 'n/a', note: `${groups.length} Nansen API families` },
          { label: 'Served from cache', value: L ? L.cached.toLocaleString('en-US') : 'n/a', note: 'repeat reads cost nothing' },
          { label: 'Token Score AUC, unseen data', value: s ? num(s.fitted.auc, 2) : 'n/a', note: s?.fitted.aucCi ? `95% interval ${num(s.fitted.aucCi?.[0], 2)} to ${num(s.fitted.aucCi?.[1], 2)}` : undefined, tone: 'in' },
          { label: 'This live instance', value: (live.calls ?? 0).toLocaleString('en-US'), note: `calls across ${live.eps} endpoints since launch` },
        ]} />

        <section className="material flex flex-col p-4 sm:p-5 xl:col-span-7" aria-labelledby="calls-by-day">
          <h2 id="calls-by-day" className="t-section">Nansen calls per day</h2>
          <p className="mb-3 text-[12px] text-ink-muted">Real API calls from this project&apos;s build ledger{L ? `, ${L.window.from.slice(0, 10)} to ${L.window.to.slice(0, 10)}` : ''}. Cache hits excluded.</p>
          <div className="flex min-h-[180px] flex-1 items-end gap-1.5" role="img" aria-label="Nansen API calls per day">
            {L?.days.map((d) => (
              <div key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.calls} calls`}>
                <span className="num text-[10px] text-ink-muted">{d.calls >= 1000 ? `${num(d.calls / 1000, 1)}K` : d.calls}</span>
                <span className="w-full rounded-t-[4px] bg-[var(--mint)]" style={{ height: `${(d.calls / maxDay) * 100}%`, minHeight: d.calls ? 3 : 0 }} />
                <span className="num text-[9.5px] text-ink-muted">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="material p-4 sm:p-5 xl:col-span-5" aria-labelledby="families">
          <h2 id="families" className="t-section">Nansen API families used</h2>
          <p className="mb-3 text-[12px] text-ink-muted">Real calls by API area</p>
          <ul className="space-y-1.5">
            {groups.map(([g, c]) => (
              <li key={g} className="grid grid-cols-[120px_minmax(0,1fr)_56px] items-center gap-2 text-[12.5px]">
                <span className="truncate font-semibold text-ink">{g}</span>
                <span className="h-2 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full bg-[var(--mint)]" style={{ width: `${(c / (groups[0]?.[1] || 1)) * 100}%` }} /></span>
                <span className="num text-right text-ink-2">{c.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ul>
        </section>

        {s && (
          <>
            <section className="material p-4 sm:p-5 xl:col-span-6" aria-labelledby="roc">
              <h2 id="roc" className="t-section">Does the risk score work?</h2>
              <p className="mb-3 text-[12px] text-ink-muted">
                Event: a token falls {s.definition.replace('max drawdown ', '')}. Trained on {s.train.n} token-weeks ({s.train.events} dumps), tested on {s.test.n} it never saw ({s.test.events} dumps, anchor {s.test.anchor}).
                A score that ranks tokens at random sits on the diagonal.
              </p>
              <RocChart fitted={s.fitted.roc} expert={s.expert.roc} fittedAuc={s.fitted.auc} expertAuc={s.expert.auc} />
            </section>
            <section className="material p-4 sm:p-5 xl:col-span-6" aria-labelledby="calib">
              <h2 id="calib" className="t-section">Are its probabilities honest?</h2>
              <p className="mb-3 text-[12px] text-ink-muted">Predicted dump probability against what happened, on the unseen test weeks</p>
              <CalibrationPlot bins={s.fitted.calibration} />
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                <div><dt className="text-ink-muted">Brier score</dt><dd className="num font-bold text-ink">{num(s.fitted.brier, 3)}</dd><dd className="text-[11px] text-ink-muted">base rate {num(s.baseRateBrier, 3)}</dd></div>
                <div><dt className="text-ink-muted">Expert prior AUC</dt><dd className="num font-bold text-ink">{num(s.expert.auc, 2)}</dd><dd className="text-[11px] text-ink-muted">before fitting</dd></div>
                <div><dt className="text-ink-muted">Hit rate at 50%</dt><dd className="num font-bold text-ink">{pct(s.fitted.hitRate, 0)}</dd><dd className="text-[11px] text-ink-muted">mostly correct &quot;no&quot; calls</dd></div>
              </dl>
              <p className="mt-3 text-[11.5px] text-ink-muted">Honest limits: {s.test.events} dump events is thin evidence, and the interval&apos;s lower bound is {num(s.fitted.aucCi?.[0], 2)}. The model is re-tested as new weeks arrive.</p>
            </section>
          </>
        )}

        <section className="material p-4 sm:p-5 xl:col-span-12" aria-labelledby="eps">
          <h2 id="eps" className="t-section">Every endpoint, by calls</h2>
          <div className="mt-2 overflow-x-auto" tabIndex={0} role="region" aria-label="Endpoints by calls">
            <table data-sortable className="w-full min-w-[560px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 font-normal">Endpoint</th><th className="font-normal">Share</th><th className="text-right font-normal">Calls</th><th className="text-right font-normal">Cache hits</th><th className="text-right font-normal">Credits</th></tr></thead>
              <tbody>
                {L?.endpoints.map((e) => (
                  <tr key={e.endpoint} className="border-t border-[var(--hair)]">
                    <td className="py-1.5 pr-3 font-mono text-[12px] text-ink">{e.endpoint}</td>
                    <td className="w-[30%] pr-3"><span className="block h-1.5 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full bg-[var(--mint)]" style={{ width: `${(e.calls / maxEp) * 100}%` }} /></span></td>
                    <td className="num text-right text-ink">{e.calls.toLocaleString('en-US')}</td>
                    <td className="num text-right text-ink-2">{e.cached.toLocaleString('en-US')}</td>
                    <td className="num text-right text-ink-2">{e.credits.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-ink-muted">Full method: <Link href="/lab" className="font-semibold text-[var(--mint)]">Backtest Lab <Go /></Link> · <Link href="/coverage" className="font-semibold text-[var(--mint)]">Data coverage <Go /></Link></p>
        </section>
      </div>
    </div>
  );
}
