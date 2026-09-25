import type { ReactNode } from 'react';
import { Card } from '@/components/Card';
import { TimeAgo } from '@/components/TimeAgo';
import type { AdminView } from '@/server/admin';
import type { ModuleId } from '@/config/endpoint-ledger';

const MODULE_NAMES: Partial<Record<ModuleId, string>> = {
  weather: 'Overview', chain: 'Chain pages', token: 'Token pages', wallet: 'Wallet pages', lab: 'Backtest Lab', anchor: 'Ask Nansen',
  alerts: 'Alerts', ride: 'Follow the flow', coverage: 'Coverage', M1: 'M1 Search', M2: 'M2 Token terminal', M3: 'M3 Wallet', M4: 'M4 Smart money',
  M5: 'M5 Perps', M6: 'M6 Predictions', M7: 'M7 Agents', M8: 'M8 Trading', M9: 'M9 Backtest v2', M10: 'M10 Map v2',
};

const CLASS_NAMES: Record<string, string> = {
  free: 'free to show', attribution: 'show with attribution', restricted: 'restricted (smart money)', prohibited: 'never public', account: 'account actions',
};

const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 1 : 0)}%`;

function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string | false }) {
  if (empty) return <p className="text-sm text-ink-2">{empty}</p>;
  return (
    <div tabIndex={0} role="region" aria-label="Scrollable list" className="max-h-[380px] overflow-auto">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
            {head.map((h, i) => <th key={h} className={`py-1.5 pr-3 font-normal ${i > 0 ? 'text-right' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
const Td = ({ children, right, muted, title }: { children: ReactNode; right?: boolean; muted?: boolean; title?: string }) => (
  <td title={title} className={`py-1.5 pr-3 align-top ${right ? 'num text-right' : ''} ${muted ? 'text-ink-muted' : 'text-ink'}`}>{children}</td>
);

/** The endpoint ledger: how much of the Nansen API this code uses. Shown
 *  to everyone — it describes the code, not anyone's data. */
export function LedgerCard({ ledger }: { ledger: AdminView['ledger'] }) {
  return (
    <Card id="ledger" title={`${ledger.used} of ${ledger.total} Nansen API operations in use (${pct(ledger.usedPct)}); ${ledger.planned} planned, ${ledger.skipped} skipped with a reason`}
      sub="From the endpoint ledger (src/config/endpoint-ledger.ts), which a test keeps in step with Nansen's published API. Bars: operations in use per redistribution class.">
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="space-y-1.5">
          {ledger.classes.map((c) => (
            <li key={c.cls} className="grid grid-cols-[11rem_1fr_4rem] items-center gap-2 text-[12px]">
              <span className="text-ink-2">{CLASS_NAMES[c.cls] ?? c.cls}</span>
              <span className="h-2.5 rounded-full bg-accent"><span className="block h-2.5 rounded-full" style={{ width: `${(c.used / Math.max(1, c.total)) * 100}%`, background: 'var(--ink-2)' }} /></span>
              <span className="num text-right text-ink">{c.used}/{c.total}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap content-start gap-1.5">
          {ledger.modules.map((m) => (
            <span key={m.module} className="rounded border border-border px-1.5 py-0.5 text-[11.5px] text-ink-2">
              {MODULE_NAMES[m.module] ?? m.module} <span className="num text-ink">{m.used}</span>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** Operator sections: shown only in owner mode (they name member wallets
 *  and the instance's own operational state). */
export function AdminPanels({ a }: { a: AdminView }) {
  const failing = a.endpoints.filter((e) => e.errors > 0);
  const totalLive = a.endpoints.reduce((s, e) => s + e.live, 0);
  const totalErr = a.endpoints.reduce((s, e) => s + e.errors, 0);
  const members = a.users.filter((u) => u.userId != null).length;
  const paid = a.payments.filter((p) => p.status === 'settled');
  const unhealthy = a.jobs.filter((j) => j.failed24h > 0);
  const done24h = a.jobs.reduce((s, j) => s + j.done24h, 0);
  const nextRun = Math.min(...a.jobs.map((j) => j.nextRunAt ?? Infinity));
  const since = new Date(a.healthSince).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  const recent = Date.now() - a.healthSince < 7 * 86_400_000;

  return (
    <div className="space-y-4">
      <h2 className="pt-2 text-[13px] font-medium uppercase tracking-wider text-ink-muted">Operator view · shown to this instance&apos;s owner only</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="errors" title={totalErr ? `${totalErr} failed Nansen calls in 7 days (${pct(totalErr / Math.max(1, totalLive + totalErr))}), ${failing.length} endpoint${failing.length === 1 ? '' : 's'} affected` : `No failed Nansen calls recorded ${recent ? `since ${since}` : 'in 7 days'}`}
          sub={`Live calls and failures per endpoint, last 7 days. Failures are recorded by the client (the credit ledger only sees successes)${recent ? `, starting ${since}` : ''}.`}>
          <Table head={['Endpoint', 'Live', 'Failed', 'Rate', 'Last failure']} empty={!a.endpoints.length && 'No live calls in the last 7 days.'}>
            {a.endpoints.map((e) => (
              <tr key={e.endpoint} className="border-b border-border/50">
                <Td><span className="num">{e.endpoint}</span></Td>
                <Td right>{e.live}</Td>
                <Td right muted={!e.errors}>{e.errors}</Td>
                <Td right muted={!e.errors}>{e.errors ? pct(e.errorRate) : '—'}</Td>
                <Td right muted title={e.lastError ?? undefined}>{e.lastError ? `${e.lastStatus ?? 'network'}: ${e.lastError.slice(0, 40)}` : ''}</Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card id="drift" title={a.drift.length ? `${a.drift.length} ways live responses differ from Nansen's published schema` : `No schema drift recorded since ${since}`}
          sub="Each distinct mismatch between a live response and the contract generated from Nansen's OpenAPI, with how often it was seen. Checked after the response is served.">
          <Table head={['Endpoint', 'Field', 'Seen', 'Last']} empty={!a.drift.length && 'No drift recorded yet.'}>
            {a.drift.map((d) => (
              <tr key={`${d.endpoint} ${d.path} ${d.message}`} className="border-b border-border/50">
                <Td><span className="num">{d.endpoint}</span></Td>
                <Td muted title={d.message}><span className="num text-ink">{d.path}</span> {d.message.slice(0, 60)}</Td>
                <Td right>{d.count}</Td>
                <Td right muted><TimeAgo ts={d.lastSeen} /></Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card id="users" title={`${members} member${members === 1 ? '' : 's'} called Nansen on their own key in 30 days`}
          sub="Calls and credits per key, last 30 days. Members' calls are billed to their own Nansen key.">
          <Table head={['Key', 'Live', 'Cached', 'Credits', 'Last']} empty={!a.users.length && 'No calls in the last 30 days.'}>
            {a.users.map((u) => (
              <tr key={u.userId ?? 'instance'} className="border-b border-border/50">
                <Td>{u.who}</Td>
                <Td right>{u.live.toLocaleString('en-US')}</Td>
                <Td right muted>{u.cached.toLocaleString('en-US')}</Td>
                <Td right>{u.credits.toLocaleString('en-US')}</Td>
                <Td right muted><TimeAgo ts={u.lastAt} /></Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card id="per-day" title={`Last 14 days: ${a.days.reduce((s, d) => s + d.live, 0).toLocaleString('en-US')} live calls, ${a.days.reduce((s, d) => s + d.credits, 0).toLocaleString('en-US')} credits`}
          sub="Per day: live calls, credits, failures and distinct keys.">
          <Table head={['Day', 'Live', 'Credits', 'Failed', 'Keys']} empty={!a.days.length && 'No calls in the last 14 days.'}>
            {a.days.map((d) => (
              <tr key={d.day} className="border-b border-border/50">
                <Td><span className="num">{d.day}</span></Td>
                <Td right>{d.live.toLocaleString('en-US')}</Td>
                <Td right>{d.credits.toLocaleString('en-US')}</Td>
                <Td right muted={!d.errors}>{d.errors}</Td>
                <Td right muted>{d.users}</Td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card id="jobs" title={!a.jobs.length ? 'No jobs yet: start the worker with pnpm worker'
            : unhealthy.length ? `${unhealthy.map((j) => j.kind).join(', ')} failed in the last 24 hours`
            : done24h ? `${done24h} job${done24h === 1 ? '' : 's'} done in 24 hours, none failed`
            : `No job has finished yet; next run ${Number.isFinite(nextRun) ? new Date(nextRun).toISOString().slice(11, 16) + ' UTC' : 'not scheduled'}`}
          sub="The job queue the worker runs: per kind, what is queued, running, done and failed in 24 hours, and the next run.">
          <Table head={['Kind', 'Queued', 'Running', 'Done 24h', 'Failed 24h', 'Last done', 'Next']} empty={!a.jobs.length && 'The queue is empty.'}>
            {a.jobs.map((j) => (
              <tr key={j.kind} className="border-b border-border/50">
                <Td title={j.lastError ?? undefined}>{j.kind}</Td>
                <Td right>{j.queued}</Td>
                <Td right>{j.running}</Td>
                <Td right>{j.done24h}</Td>
                <Td right muted={!j.failed24h}>{j.failed24h}</Td>
                <Td right muted><TimeAgo ts={j.lastDoneAt} /></Td>
                <Td right muted>{j.nextRunAt ? new Date(j.nextRunAt).toISOString().slice(11, 16) + ' UTC' : '—'}</Td>
              </tr>
            ))}
          </Table>
          {a.recentJobs.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-muted">
              Recent: {a.recentJobs.slice(0, 6).map((j) => `#${j.id} ${j.kind} ${j.status}${j.attempts > 1 ? ` (try ${j.attempts})` : ''}`).join(' · ')}
            </p>
          )}
        </Card>

        <Card id="payments" title={paid.length ? `${paid.reduce((s, p) => s + p.n, 0)} calls paid per call (x402) in 30 days, $${paid.reduce((s, p) => s + p.usd, 0).toFixed(2)} to Nansen` : 'No x402 pay-per-call payments settled in 30 days'}
          sub="Keyless visitors paying Nansen per call from their own wallets. Every attempt is logged: settled, rejected by Nansen, or failed after settling.">
          <Table head={['Endpoint', 'Status', 'Calls', 'USD']} empty={!a.payments.length && 'No payment attempts yet.'}>
            {a.payments.map((p) => (
              <tr key={`${p.endpoint} ${p.status}`} className="border-b border-border/50">
                <Td><span className="num">{p.endpoint}</span></Td>
                <Td muted={p.status !== 'settled'}>{p.status}</Td>
                <Td right>{p.n}</Td>
                <Td right>{p.status === 'settled' ? `$${p.usd.toFixed(2)}` : '—'}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </div>
  );
}
