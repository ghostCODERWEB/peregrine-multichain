import Link from 'next/link';
import type { Metadata } from 'next';
import { PageTitle } from '@/components/PageTitle';
import { TimeMachine } from '@/components/history/TimeMachine';
import { ChainLogo } from '@/components/Logo';
import { getDb } from '@/server/nansen/db';
import { displayMode } from '@/server/mode';
import { perpChanges } from '@/server/perps/terminal';
import { DIRECTION_TEXT } from '@/lib/perps/changes';
import { chainName, num, usd } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'History · Peregrine' };

const WINDOWS = { '24h': 86_400_000, '7d': 7 * 86_400_000 } as const;

/** Latest stored value per key. */
const toMap = (rows: Array<{ k: string; v: number }>) => new Map(rows.map((r) => [r.k, r.v]));

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const w = (await searchParams).w === '7d' ? '7d' : '24h';
  const ms = WINDOWS[w];
  const now = Date.now();
  const db = getDb();
  const owner = (await displayMode()) === 'owner';
  const snap = (t: number) => toMap(db.prepare(`SELECT c.chain AS k, c.cpi AS v FROM chain_cpi c JOIN (SELECT chain, MAX(snapshot_at) s FROM chain_cpi WHERE snapshot_at <= ? GROUP BY chain) m ON m.chain = c.chain AND m.s = c.snapshot_at`).all(t) as Array<{ k: string; v: number }>);
  const chainsNow = snap(now), chainsThen = snap(now - ms);
  const chains = [...chainsNow].filter(([k]) => chainsThen.has(k)).map(([k, v]) => ({ chain: k, then: chainsThen.get(k)!, now: v, d: v - chainsThen.get(k)! })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 12);
  const source = owner ? 'smart-money' : 'market-flow';
  const sec = (t: number) => toMap(db.prepare(`SELECT s.sector AS k, s.net_flow_usd AS v FROM sector_snapshots s JOIN (SELECT sector, MAX(snapshot_at) x FROM sector_snapshots WHERE window='24h' AND source=? AND snapshot_at <= ? GROUP BY sector) m ON m.sector = s.sector AND m.x = s.snapshot_at WHERE s.window='24h' AND s.source=?`).all(source, t, source) as Array<{ k: string; v: number }>);
  const sNow = sec(now), sThen = sec(now - ms);
  const sectors = [...sNow].filter(([k]) => sThen.has(k)).map(([k, v]) => ({ sector: k, then: sThen.get(k)!, now: v, d: v - sThen.get(k)! })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 12);
  const perps = owner ? (['BTC', 'ETH'] as const).map((sym) => ({ sym, c: perpChanges(sym, ms) })) : [];
  const first = (db.prepare('SELECT MIN(snapshot_at) t FROM chain_cpi').get() as { t: number | null }).t;

  const delta = (d: number, fmt: (x: number) => string) => <span className="num font-semibold" style={{ color: d >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{fmt(d)}</span>;
  const table = (title: string, head: string, rows: Array<{ key: string; name: React.ReactNode; then: string; now: string; change: React.ReactNode }>, empty: string) => (
    <section className="material min-w-0 p-4 sm:p-5">
      <h2 className="t-section mb-3">{title}</h2>
      {rows.length ? (
        <table className="w-full text-[13px]">
          <thead className="text-[11.5px] text-ink-muted"><tr><th className="py-1.5 text-left font-semibold">{head}</th><th className="text-right font-semibold">Then</th><th className="text-right font-semibold">Now</th><th className="text-right font-semibold">Change</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key} className="border-t border-[var(--hair)]"><td className="py-1.5">{r.name}</td><td className="num text-right text-ink-2">{r.then}</td><td className="num text-right text-ink">{r.now}</td><td className="text-right">{r.change}</td></tr>)}</tbody>
        </table>
      ) : <p className="text-[13px] text-ink-muted">{empty}</p>}
    </section>
  );

  return (
    <div className="space-y-5">
      <PageTitle title="History" pill={`Now vs ${w} ago · from stored snapshots`} action={
        <div className="segmented" style={{ '--segments': 2, '--selected': w === '7d' ? 1 : 0 } as React.CSSProperties}><span className="segmented-thumb" aria-hidden />
          <Link href="/history" aria-pressed={w === '24h'} className="relative z-[1] px-3 py-1 text-center text-[12px] font-bold">24h</Link>
          <Link href="/history?w=7d" aria-pressed={w === '7d'} className="relative z-[1] px-3 py-1 text-center text-[12px] font-bold">7d</Link>
        </div>} />
      {owner && (
        <div className="grid gap-4 md:grid-cols-2">
          {perps.map(({ sym, c }) => (
            <Link key={sym} href={`/perps/${sym}?tab=changes&win=${w}`} className="material block p-4 hover:border-[var(--hair-2)] sm:p-5">
              <p className="text-[12px] font-semibold text-ink-muted">{sym} Smart Money perp positioning, {w}</p>
              {'unavailable' in c ? <p className="mt-1 text-[13px] text-ink-2">{c.unavailable}</p> : (() => { const s = c.shift.smart_money ?? c.shift.all; return (
                <><p className="mt-1 text-[17px] font-bold text-ink">{DIRECTION_TEXT[s.direction]}</p>
                  <p className="num text-[12.5px] text-ink-2">Long {usd(s.longDeltaUsd, { signed: true })} · short {usd(s.shortDeltaUsd, { signed: true })} · {s.counts.opened} opened, {s.counts.closed} closed, {s.counts.flipped} flipped</p></>); })()}
            </Link>
          ))}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {table(`Largest Flow Index moves, ${w}`, 'Chain', chains.map((c) => ({ key: c.chain, name: <Link href={`/chain/${c.chain}`} className="flex items-center gap-2 font-semibold text-ink hover:underline"><ChainLogo chain={c.chain} size={16} />{chainName(c.chain)}</Link>, then: num(c.then, 0), now: num(c.now, 0), change: delta(c.d, (x) => `${x >= 0 ? '+' : '−'}${num(Math.abs(x), 0)}`) })), `History starts ${first ? new Date(first).toISOString().slice(0, 10) : 'with the first scan'}; ${w} comparisons appear once it is that old.`)}
        {table(`Largest sector net-flow changes, ${w}`, 'Sector', sectors.map((s) => ({ key: s.sector, name: <Link href={`/sectors/${encodeURIComponent(s.sector)}`} className="font-semibold text-ink hover:underline">{s.sector}</Link>, then: usd(s.then, { signed: true }), now: usd(s.now, { signed: true }), change: delta(s.d, (x) => usd(x, { signed: true })) })), 'Not enough sector history for this window yet.')}
      </div>
      {owner && <TimeMachine />}
      <p className="text-[11.5px] text-ink-muted">Then is the latest stored snapshot at or before {w} ago; now is the latest snapshot. For a token&apos;s own history, open it and use Time Machine.</p>
    </div>
  );
}
