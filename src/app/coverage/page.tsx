import type { Metadata } from 'next';
import { Card } from '@/components/Card';
import { TimeAgo } from '@/components/TimeAgo';
import { coverageMatrix, usage, type CellStatus } from '@/server/coverage';
import { adminView, ledgerCoverage } from '@/server/admin';
import { displayMode } from '@/server/mode';
import { AdminPanels, LedgerCard } from '@/components/coverage/AdminPanels';
import { chainName, num } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Coverage — Peregrine' };

const CELL: Record<CellStatus, { cls: string; label: string }> = {
  documented: { cls: 'bg-ink-2', label: 'supported (Nansen docs)' },
  'probed-ok': { cls: 'bg-ink-2 outline outline-2 outline-offset-1 outline-ink', label: 'supported (checked live — not in the docs)' },
  'probed-fail': { cls: 'border border-dashed border-axis', label: 'tried live, not served' },
  none: { cls: 'border border-border', label: 'not available on this chain' },
};

export default async function CoveragePage() {
  const { rows, columns } = coverageMatrix();
  const u = usage();
  const owner = (await displayMode()) === 'owner';
  const admin = owner ? adminView() : null;
  const groups = columns.reduce<Array<{ group: string; span: number }>>((acc, c) => {
    const last = acc.at(-1);
    if (last?.group === c.group) last.span++; else acc.push({ group: c.group, span: 1 });
    return acc;
  }, []);
  const maxDay = Math.max(1, ...u.daily.map((d) => d.live + d.cached));
  const maxEp = Math.max(1, ...u.byEndpoint.map((e) => e.live));
  const full = rows.filter((r) => r.tier === 'A').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">
          {rows.length} chains, {columns.length} Nansen endpoints: {u.liveCalls.toLocaleString('en-US')} live API calls so far
        </h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-2">
          {full} of {rows.length} chains fully supported (Tier A); the rest show what Nansen serves and state what&apos;s missing.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          ['Live API calls', u.liveCalls.toLocaleString('en-US'), `+ ${u.cacheHits.toLocaleString('en-US')} served from cache`],
          ['Credits spent', u.credits.toLocaleString('en-US'), 'by this Peregrine instance'],
          ['Credits remaining', u.creditsRemaining == null ? '—' : u.creditsRemaining.toLocaleString('en-US'), u.creditsRemainingAt ? 'from the latest Nansen response header' : 'appears after the next Nansen call'],
          ['Scanner runs', u.scans.runs.toLocaleString('en-US'), `${num(u.scans.runs ? u.scans.credits / u.scans.runs : null, 0)} credits per run`],
          ['Counting since', u.since ? new Date(u.since).toISOString().slice(0, 10) : '—', 'first call in the ledger'],
        ].map(([k, v, sub]) => (
          <div key={k} className="glass rounded-xl px-3 py-2">
            <div className="text-[11px] text-ink-muted">{k}</div>
            <div className="num text-xl font-semibold text-ink">{v}</div>
            <div className="text-[11px] text-ink-muted">{sub}</div>
          </div>
        ))}
      </div>

      <LedgerCard ledger={admin?.ledger ?? ledgerCoverage()} />

      <Card id="matrix" title={`What Nansen serves, chain by chain — ${rows.filter((r) => r.supported >= columns.length - 3).length} chains cover almost every endpoint, ${rows.filter((r) => r.supported <= 2).length} only the basics`}
        sub="Rows: chains by tier. Columns: the endpoints Peregrine uses, grouped by API family. Hover a column for what Peregrine uses it for.">
        <div className="overflow-x-auto pt-6">
          <table className="table-fixed border-separate border-spacing-[3px] text-[11px]">
            <thead>
              <tr>
                <th />
                {groups.map((g) => <th key={g.group} colSpan={g.span} className="px-1 pb-1 text-left font-medium text-ink-2">{g.group}</th>)}
              </tr>
              <tr>
                <th className="pr-2 text-left font-normal text-ink-muted">chain</th>
                {columns.map((c) => (
                  <th key={c.path} className="relative h-24 w-5 min-w-5 max-w-5 p-0 font-normal" title={`${c.path} — ${c.usedFor} (${c.chains} chains)`}>
                    <span className="absolute bottom-1 left-2.5 origin-bottom-left -rotate-60 whitespace-nowrap text-ink-muted">{c.label}</span>
                  </th>
                ))}
                <th className="pl-2 text-right font-normal text-ink-muted">tier</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.chain}>
                  <td className="whitespace-nowrap pr-2 text-ink">{chainName(r.chain)}{r.inferred && <span className="text-ink-muted" title="tier set by a live probe"> *</span>}</td>
                  {r.cells.map((s, j) => (
                    <td key={j} title={`${chainName(r.chain)} · ${columns[j].path}: ${CELL[s].label}`}>
                      <div className={`h-4 w-5 rounded-[3px] ${CELL[s].cls}`} />
                    </td>
                  ))}
                  <td className="num pl-2 text-right text-ink-2">{r.tier === 'perp' ? 'P' : r.tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-muted">
          {(Object.keys(CELL) as CellStatus[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5"><span className={`inline-block h-3 w-4 rounded-[3px] ${CELL[k].cls}`} />{CELL[k].label}</span>
          ))}
          <span>* tier set by a live probe</span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="daily" title={`${u.daily.at(-1)?.live ?? 0} live calls today, ${u.daily.length} day${u.daily.length === 1 ? '' : 's'} of history`} sub="Nansen API calls per day: live (dark) and served from Peregrine's cache (light).">
          <ul className="space-y-1.5">
            {u.daily.map((d) => (
              <li key={d.day} className="grid grid-cols-[5.5rem_1fr_7rem] items-center gap-2 text-[12px]">
                <span className="num text-ink-2">{d.day}</span>
                <span className="flex h-3 overflow-hidden rounded-full bg-accent">
                  <span style={{ width: `${(d.live / maxDay) * 100}%`, background: 'var(--ink-2)' }} />
                  <span style={{ width: `${(d.cached / maxDay) * 100}%`, background: 'var(--axis)' }} />
                </span>
                <span className="num text-right text-ink">{d.live} · {d.credits} cr</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-ink-muted">Last scan <TimeAgo ts={u.scans.last} />.</p>
        </Card>
        <Card id="endpoints" title={`${u.byEndpoint.length} endpoints called — ${u.byEndpoint[0]?.endpoint ?? '—'} the most`} sub="Live calls per endpoint, with credits.">
          <ul className="max-h-[360px] space-y-1 overflow-y-auto">
            {u.byEndpoint.map((e) => (
              <li key={e.endpoint} className="grid grid-cols-[minmax(0,13rem)_1fr_6rem] items-center gap-2 text-[12px]">
                <span className="num truncate text-ink-2" title={e.endpoint}>{e.endpoint}</span>
                <span className="h-2.5 rounded-full bg-accent"><span className="block h-2.5 rounded-full" style={{ width: `${(e.live / maxEp) * 100}%`, background: 'var(--ink-2)' }} /></span>
                <span className="num text-right text-ink">{e.live} · {e.credits} cr</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {admin ? <AdminPanels a={admin} /> : (
        <p className="text-[12px] text-ink-muted">Error rates, schema drift, per-key usage, job health and payments are shown to this instance&apos;s owner only.</p>
      )}
    </div>
  );
}
