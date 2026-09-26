'use client';
import { useEffect, useMemo, useState } from 'react';
import { AddressLink } from '@/components/entity/AddressLink';
import { CohortBadges } from '@/components/entity/CohortBadges';
import { Segmented } from '@/components/ui/Segmented';
import { DIRECTION_TEXT, type ChangeKind, type PositionChange } from '@/lib/perps/changes';
import { COHORT_NAME, type Cohort } from '@/lib/perps/positions';
import { usd } from '@/lib/viz/format';
import type { ChangesData } from '@/server/perps/terminal';
import { WINDOWS, type WindowKey } from './state';

const KIND_TEXT: Record<ChangeKind, string> = { opened: 'Opened', closed: 'Closed', increased: 'Added', reduced: 'Reduced', flipped: 'Flipped', 'left-set': 'Left observed set' };
const utc = (t: number) => new Date(t).toISOString().slice(5, 16).replace('T', ' ');

export function useChanges(symbol: string, win: WindowKey, refreshKey: number) {
  const [data, setData] = useState<ChangesData | { unavailable: string } | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    fetch(`/api/perps/terminal?symbol=${encodeURIComponent(symbol)}&changes=${win}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setData(d.error ? { unavailable: d.error } : d))
      .catch((e) => { if ((e as Error).name !== 'AbortError') setData({ unavailable: 'Could not load the comparison.' }); });
    return () => ac.abort();
  }, [symbol, win, refreshKey]);
  return data;
}

/** Conviction Shift: one cohort's change, stated with its drivers. */
export function ShiftCard({ data, cohort, onDrill }: { data: ChangesData; cohort: Cohort | 'all'; onDrill: (kind: ChangeKind | null) => void }) {
  const s = data.shift[cohort];
  if (!s) return null;
  const drivers: Array<[ChangeKind, string]> = [['opened', 'opened'], ['increased', 'added'], ['reduced', 'reduced'], ['closed', 'closed'], ['flipped', 'flipped side']];
  return (
    <div className="space-y-2">
      <p className="text-[11.5px] font-semibold text-ink-muted">{COHORT_NAME[cohort]} · {utc(data.from)} to {utc(data.to)} UTC</p>
      <p className="text-[16px] font-bold tracking-[-0.015em]" style={{ color: /long/.test(s.direction) && s.direction.startsWith('increasing') || s.direction === 'reducing-short' ? 'var(--mint)' : s.direction === 'mixed' || s.direction === 'unchanged' ? 'var(--ink-1)' : 'var(--flare)' }}>
        {DIRECTION_TEXT[s.direction]}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {drivers.filter(([k]) => s.counts[k]).map(([k, word]) => (
          <li key={k}><button type="button" onClick={() => onDrill(k)} className="rounded-full border border-[var(--hair)] px-2.5 py-1 text-[12px] text-ink-2 hover:border-[var(--hair-2)] hover:text-ink">
            <span className="num font-bold text-ink">{s.counts[k]}</span> {word}
          </button></li>
        ))}
      </ul>
      <p className="num text-[12px] text-ink-2">
        Long exposure {usd(s.longDeltaUsd, { signed: true })} · short {usd(s.shortDeltaUsd, { signed: true })} · net {usd(s.netExposureDeltaUsd, { signed: true })}
        {s.tradersAddingLong + s.tradersAddingShort > 0 && ` · ${s.tradersAddingLong} added long, ${s.tradersAddingShort} added short`}
      </p>
    </div>
  );
}

export function ChangesPanel({ data, win, onWin, cohort }: { data: ChangesData | { unavailable: string } | null; win: WindowKey; onWin: (w: WindowKey) => void; cohort: Cohort | 'all' }) {
  const [kind, setKind] = useState<ChangeKind | null>(null);
  const rows = useMemo(() => {
    if (!data || 'unavailable' in data) return [];
    return data.changes.filter((c) => (cohort === 'all' || c.cohorts.includes(cohort)) && (kind ? c.kind === kind : c.kind !== 'left-set'));
  }, [data, cohort, kind]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Compare with" value={win} options={WINDOWS.map((w) => ({ value: w, label: w }))} onChange={onWin} />
        {data && !('unavailable' in data) && (
          <span className="text-[12px] text-ink-muted">Snapshot {utc(data.from)} vs {utc(data.to)} UTC{Math.abs(data.to - data.from - data.requestedMs) > data.requestedMs * 0.25 ? ' (closest available)' : ''}</span>
        )}
      </div>
      {!data ? <p className="text-[13px] text-ink-muted">Loading comparison…</p>
        : 'unavailable' in data ? <p className="rounded-[10px] border border-dashed border-[var(--hair-2)] px-4 py-5 text-[13px] text-ink-2">{data.unavailable}</p>
        : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <ShiftCard data={data} cohort={cohort in data.shift ? cohort : 'all'} onDrill={setKind} />
              {cohort !== 'all' && <ShiftCard data={data} cohort="all" onDrill={setKind} />}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
              {kind && <button type="button" onClick={() => setKind(null)} className="rounded-full bg-ink/10 px-2.5 py-1 font-semibold text-ink">{KIND_TEXT[kind]} ✕</button>}
              <span className="text-ink-muted">{rows.length} change{rows.length === 1 ? '' : 's'}{cohort !== 'all' ? ` in ${COHORT_NAME[cohort]}` : ''}, largest first</span>
            </div>
            <ol className="divide-y divide-[var(--hair)] rounded-[10px] border border-[var(--hair)]">
              {rows.slice(0, 80).map((c: PositionChange) => (
                <li key={`${c.address}:${c.kind}`} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                  <span className="w-[112px] shrink-0 font-semibold" style={{ color: c.deltaUsd >= 0 ? 'var(--mint)' : 'var(--flare)' }}>
                    {KIND_TEXT[c.kind]} {c.kind === 'flipped' ? `to ${c.side}` : c.side}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5"><AddressLink address={c.address} label={c.label} /><CohortBadges cohorts={c.cohorts} /></span>
                  <span className="num w-[150px] text-right text-ink-2">{usd(c.beforeUsd)} to {usd(c.afterUsd)}</span>
                  <span className="num w-[90px] text-right font-semibold" style={{ color: c.deltaUsd >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(c.deltaUsd, { signed: true })}</span>
                </li>
              ))}
              {!rows.length && <li className="px-3 py-5 text-center text-[13px] text-ink-muted">No material changes for this cohort in this window.</li>}
            </ol>
            <p className="text-[11.5px] text-ink-muted">
              Matched by wallet between two stored reads of the largest observed positions. A size change under 10% is ignored (price moves change value alone). A wallet that fell out of the observed set while small is listed as &quot;left observed set&quot;, not as a close.
            </p>
          </>
        )}
    </div>
  );
}
