'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { History, RefreshCw, X } from 'lucide-react';
import { Segmented } from '@/components/ui/Segmented';
import { InfoPopover } from '@/components/InfoPopover';
import { Go } from '@/components/ui/Icons';
import { applyFilters, cohortMatrix, crowding, liquidationBands, positionsInBand, totalUsd, type Band } from '@/lib/perps/liquidation';
import { COHORT_NAME, type Cohort } from '@/lib/perps/positions';
import { ago, num, pct, price, usd } from '@/lib/viz/format';
import type { TerminalData } from '@/server/perps/terminal';
import type { Provenance } from '@/lib/provenance';
import { AnalystPanel } from './AnalystPanel';
import { ChangesPanel, ShiftCard, useChanges } from './ChangesPanel';
import { LiquidationRadar } from './LiquidationRadar';
import { BandInspector, CohortMatrix, ConsensusMap, DataTable, EntryChart, LeverageChart, PnlLeaders, ProximityTable, TradesTable, positionCols } from './Panels';
import { MarketBrief } from './MarketBrief';
import { PositioningHistory, type PositionPoint } from '@/components/charts/IntelCharts';
import { TABS, useTerminalState, type Tab } from './state';


function useTerminalData(symbol: string, at: number | null) {
  const [data, setData] = useState<TerminalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetch(`/api/perps/terminal?symbol=${encodeURIComponent(symbol)}${at ? `&at=${at}` : ''}`, { signal: ac.signal })
      .then(async (r) => { const d = await r.json(); if (!r.ok || d.unavailable) throw new Error(d.error ?? d.unavailable ?? `Nansen request failed (${r.status})`); return d as TerminalData; })
      .then((d) => { setData(d); setError(null); })
      .catch((e) => { if ((e as Error).name !== 'AbortError') setError((e as Error).message); })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [symbol, tick, at]);
  return { data, error, loading, refresh: () => setTick((t) => t + 1), tick };
}

const METHOD: Provenance = {
  title: 'Liquidation Cascade Radar',
  formula: 'band = price range of the chosen width, anchored at the mark\nexposure(band) = sum of position_value_usd for observed positions whose liquidation_price falls in the band\nSmart Money = positions Nansen returns for label_type smart_money',
  inputs: [{ label: 'Source', value: 'Nansen tgm/perp-positions (Hyperliquid)' }, { label: 'Scope', value: 'Largest positions Nansen returns per cohort, up to 1,000 each' }],
  calls: [],
  notes: ['Observed exposure only: positions outside what Nansen returns are not counted.', 'A concentration shows where observed positions would be force-closed, not that price will reach it.'],
};

/** Position Replay: step through stored position snapshots; the whole workspace follows. */
function ReplayBar({ times, at, shownAt, onChange }: { times: number[]; at: number | null; shownAt: number; onChange: (t: number | null) => void }) {
  const idx = at ? times.reduce((best, t, i) => (Math.abs(t - at) < Math.abs(times[best] - at) ? i : best), 0) : times.length - 1;
  const fmt = (t: number) => new Date(t).toISOString().slice(5, 16).replace('T', ' ');
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-[var(--r-inner)] border px-3.5 py-2 text-[12.5px] ${at ? 'border-[color-mix(in_srgb,var(--signal)_45%,transparent)] bg-[color-mix(in_srgb,var(--signal)_8%,transparent)]' : 'border-[var(--hair)]'}`}>
      <span className="font-semibold text-ink">{at ? 'Replay' : 'Position Replay'}</span>
      <input type="range" min={0} max={times.length - 1} value={idx} aria-label="Snapshot time" className="min-w-[160px] flex-1"
        onChange={(e) => { const i = Number(e.target.value); onChange(i === times.length - 1 ? null : times[i]); }} />
      <span className="num text-ink-2">{at ? `Showing the stored snapshot of ${fmt(shownAt)} UTC` : `${times.length} stored snapshots since ${fmt(times[0])} UTC · drag to replay`}</span>
      {at && <button type="button" onClick={() => onChange(null)} className="font-semibold text-brand">Back to live</button>}
    </div>
  );
}

export function PerpsTerminal({ symbol, coins, owner, positioning = [] }: { symbol: string; coins: string[]; owner: boolean; positioning?: PositionPoint[] }) {
  const router = useRouter();
  const { state, set } = useTerminalState();
  const { data, error, loading, refresh, tick } = useTerminalData(symbol, state.at);
  const changes = useChanges(symbol, state.win, tick);
  const [hoverLiq, setHoverLiq] = useState<number | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const available = (data?.cohorts ?? []) as Cohort[];
  const mark = data?.mark ?? null;
  const filters = { cohort: available.includes(state.cohort as Cohort) ? state.cohort : 'all', side: state.side, minUsd: state.minUsd, minLeverage: state.minLeverage } as const;
  const filtered = useMemo(() => (data ? applyFilters(data.positions, filters) : []), [data, filters.cohort, filters.side, filters.minUsd, filters.minLeverage]); // eslint-disable-line react-hooks/exhaustive-deps
  const inEntry = useMemo(() => (state.entry ? filtered.filter((p) => p.entry != null && p.entry >= state.entry!.lo && p.entry < state.entry!.hi) : filtered), [filtered, state.entry]);
  const band = useMemo((): Band | null => {
    if (!state.band || !mark) return null;
    const { bands } = liquidationBands(filtered, mark, state.bandPct, state.range);
    return bands.find((b) => Math.abs(b.lo - state.band!.lo) < mark * 1e-6) ?? null;
  }, [state.band, filtered, mark, state.bandPct, state.range]);
  const inBand = useMemo(() => (state.band ? positionsInBand(inEntry, state.band.lo, state.band.hi) : inEntry), [inEntry, state.band]);
  const crowd = useMemo(() => crowding(filtered), [filtered]);

  const goTab = (t: Tab) => { set({ tab: t }); requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  const selectBand = useCallback((b: { lo: number; hi: number } | null) => set({ band: b ? { lo: +b.lo.toPrecision(10), hi: +b.hi.toPrecision(10) } : null }, true), [set]);
  const selectRange = (lo: number, hi: number) => {
    if (!mark) return;
    const { bands } = liquidationBands(filtered, mark, state.bandPct, state.range);
    const mid = (lo + hi) / 2;
    const hit = bands.find((b) => mid >= b.lo && mid < b.hi) ?? bands.find((b) => b.hi > lo && b.lo < hi);
    if (hit) selectBand(hit);
  };

  const buildContext = () => {
    if (!data || !mark) return { symbol };
    const view = (state.band ? inBand : inEntry).slice(0, 30);
    const shift = changes && !('unavailable' in changes) ? { from: new Date(changes.from).toISOString(), to: new Date(changes.to).toISOString(), shift: changes.shift, topChanges: changes.changes.slice(0, 15).map((c) => ({ kind: c.kind, address: c.address, label: c.label, cohorts: c.cohorts, side: c.side, beforeUsd: Math.round(c.beforeUsd), afterUsd: Math.round(c.afterUsd) })) } : null;
    return {
      coin: symbol, dataAt: new Date(data.at).toISOString(), markPrice: mark,
      filters: { cohort: filters.cohort, side: filters.side, minPositionUsd: filters.minUsd, minLeverage: filters.minLeverage, bandWidthPct: state.bandPct * 100, entryRange: state.entry },
      selectedLiquidationBand: band ? { from: band.lo, to: band.hi, observedUsd: Math.round(totalUsd(band)), longUsd: Math.round(band.longUsd), shortUsd: Math.round(band.shortUsd), traders: band.traders, smartMoneyTraders: band.smTraders, medianLeverage: band.medianLeverage } : null,
      positionsInView: view.map((p) => ({ address: p.address, label: p.label, cohorts: p.cohorts, side: p.side, valueUsd: Math.round(p.valueUsd), leverage: p.leverage, entry: p.entry, liquidation: p.liq, upnlUsd: p.upnlUsd && Math.round(p.upnlUsd) })),
      cohortMatrix: cohortMatrix(data.positions, mark, ['all', ...available]).map((r) => ({ cohort: r.cohort, traders: r.traders, longUsd: Math.round(r.longUsd), shortUsd: Math.round(r.shortUsd), medianLeverage: r.medianLeverage, nearLiquidationUsd: Math.round(r.nearLiqUsd) })),
      crowding: crowd, whatChanged: shift, scope: 'Observed positions: the largest Nansen returns per cohort, not the whole exchange.',
    };
  };

  const suggestions = [
    band ? 'Who is exposed in the selected band, and how have they traded?' : 'What is happening in this market right now?',
    'What changed in Smart Money positioning?',
    'Which profitable traders are closest to liquidation?',
    'Compare Smart Money with whales here.',
  ];

  const activeChips: Array<[string, () => void]> = [];
  if (filters.cohort !== 'all') activeChips.push([COHORT_NAME[filters.cohort], () => set({ cohort: 'all' })]);
  if (state.side !== 'both') activeChips.push([state.side === 'long' ? 'Longs' : 'Shorts', () => set({ side: 'both' })]);
  if (state.minLeverage > 1) activeChips.push([`${state.minLeverage}x+`, () => set({ minLeverage: 1 })]);
  if (state.minUsd > 0) activeChips.push([`${usd(state.minUsd)}+`, () => set({ minUsd: 0 })]);
  if (state.band) activeChips.push([`Liq. ${price(state.band.lo)} to ${price(state.band.hi)}`, () => selectBand(null)]);
  if (state.entry) activeChips.push([`Entry ${price(state.entry.lo)} to ${price(state.entry.hi)}`, () => set({ entry: null })]);

  const cols = mark ? positionCols(mark) : [];
  const freshness = data ? ago(data.at) : null;

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------- header */}
      <header className="hero-seq flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-1 flex items-center gap-1 text-[12.5px] text-ink-muted">
            <Link href="/perps" className="hover:text-ink">Perps</Link><Go /><span className="text-ink-2">{symbol}</span>
            {state.band && <><Go /><button type="button" className="text-ink-2 hover:text-ink" onClick={() => goTab('positions')}>Liq. {price(state.band.lo)} to {price(state.band.hi)}</button></>}
          </nav>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <label className="relative">
              <span className="sr-only">Coin</span>
              <select value={symbol} onChange={(e) => router.push(`/perps/${encodeURIComponent(e.target.value)}`)}
                className="t-title cursor-pointer appearance-none bg-transparent pr-6 text-ink focus-visible:outline-none">
                {[symbol, ...coins.filter((c) => c !== symbol)].map((c) => <option key={c} value={c} className="bg-[var(--surface-1)] text-[14px]">{c}</option>)}
              </select>
              <span aria-hidden className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-muted">▾</span>
            </label>
            <span className="num text-[22px] font-bold tracking-[-0.02em] text-ink">{price(mark)}</span>
            <span className="text-[12.5px] text-ink-muted">Hyperliquid perp · mark{data?.meta?.maxLeverage ? ` · max ${data.meta.maxLeverage}x` : ''}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12px] text-ink-muted" title={data ? new Date(data.at).toISOString() : undefined}>
            <span className={`h-1.5 w-1.5 rounded-full ${loading ? 'animate-pulse bg-ink-muted' : 'bg-[var(--mint)]'}`} />{loading ? 'Refreshing' : freshness ? `Positions ${freshness}` : ''}
          </span>
          <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh" className="pill-button pill-secondary min-h-[34px] px-3"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /></button>
          <Link href={`/perps/compare?a=${encodeURIComponent(symbol)}&b=${symbol === 'BTC' ? 'ETH' : 'BTC'}`} className="pill-button pill-secondary min-h-[34px] px-3.5 text-[12.5px]">Compare</Link>
          <button type="button" onClick={() => goTab('changes')} className="pill-button pill-secondary min-h-[34px] px-3.5 text-[12.5px]"><History className="h-3.5 w-3.5" aria-hidden />What changed?</button>
        </div>
      </header>

      {data && data.snapshots.length > 1 && (
        <ReplayBar times={data.snapshots} at={state.at} shownAt={data.at} onChange={(t) => set({ at: t })} />
      )}

      {error && !data && <p role="alert" className="rounded-[12px] border border-[var(--hair-2)] p-4 text-[13px] text-ink-2">{error} <button type="button" onClick={refresh} className="ml-2 font-semibold text-brand">Retry</button></p>}

      {/* ------------------------------------------------------------- metrics */}
      <ul className="stagger grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Observed exposure', data ? usd(crowd.totalUsd) : '…', `${filtered.length} positions`],
          ['Long share', crowd.longShare == null ? '…' : pct(crowd.longShare, 0), crowd.longShare == null ? '' : `${usd(crowd.totalUsd * crowd.longShare)} long`],
          ['Traders', data ? String(crowd.traders) : '…', filters.cohort === 'all' ? 'all observed' : COHORT_NAME[filters.cohort]],
          ['Top 10 hold', crowd.top10Share == null ? '…' : pct(crowd.top10Share, 0), 'of observed exposure'],
          ['Smart Money', !data ? '…' : available.includes('smart_money') ? usd(data.positions.filter((p) => p.cohorts.includes('smart_money')).reduce((a, p) => a + p.valueUsd, 0)) : 'owner view', available.includes('smart_money') && data ? `${new Set(data.positions.filter((p) => p.cohorts.includes('smart_money')).map((p) => p.address)).size} traders` : ''],
          ['Conviction shift', changes && !('unavailable' in changes) && changes.shift[filters.cohort] ? changes.shift[filters.cohort]!.direction.replace('-', ' ') : 'n/a', `vs ${state.win} ago`],
        ].map(([k, v, note]) => (
          <li key={k} className="min-w-0 bg-[var(--surface-1)] px-3.5 py-2.5">
            <span className="block text-[11.5px] font-semibold text-ink-muted">{k}</span>
            <span className="num mt-0.5 block truncate text-[17px] font-bold capitalize tracking-[-0.02em] text-ink">{v}</span>
            <span className="block truncate text-[11.5px] text-ink-2">{note}</span>
          </li>
        ))}
      </ul>

      {/* ------------------------------------------------------------- filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Cohort" value={filters.cohort} options={[{ value: 'all', label: 'All' }, ...available.map((c) => ({ value: c, label: COHORT_NAME[c] }))]} onChange={(v) => set({ cohort: v })} />
        <Segmented label="Side" value={state.side} options={[{ value: 'both', label: 'Both' }, { value: 'long', label: 'Longs' }, { value: 'short', label: 'Shorts' }]} onChange={(v) => set({ side: v })} />
        <Segmented label="Radar range" value={state.range} options={[{ value: 0.05, label: '±5%' }, { value: 0.1, label: '±10%' }, { value: 0.25, label: '±25%' }]} onChange={(v) => set({ range: v })} />
        <Segmented label="Band width" value={state.bandPct} options={[{ value: 0.0025, label: '0.25%' }, { value: 0.005, label: '0.5%' }, { value: 0.01, label: '1%' }]} onChange={(v) => set({ bandPct: v, band: null })} />
        <Segmented label="Minimum leverage" value={state.minLeverage} options={[{ value: 1, label: 'Any lev.' }, { value: 5, label: '5x+' }, { value: 10, label: '10x+' }, { value: 20, label: '20x+' }]} onChange={(v) => set({ minLeverage: v })} />
        <Segmented label="Minimum size" value={state.minUsd} options={[{ value: 0, label: 'Any size' }, { value: 100_000, label: '$100K+' }, { value: 1_000_000, label: '$1M+' }]} onChange={(v) => set({ minUsd: v })} />
        {activeChips.length > 0 && (
          <span className="flex flex-wrap items-center gap-1.5">
            {activeChips.map(([t, clear]) => (
              <button key={t} type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2.5 py-1 text-[12px] font-semibold text-ink hover:bg-ink/15">{t}<X className="h-3 w-3" aria-hidden /></button>
            ))}
            {activeChips.length > 1 && <button type="button" onClick={() => set({ cohort: 'all', side: 'both', minLeverage: 1, minUsd: 0, band: null, entry: null })} className="text-[12px] font-semibold text-ink-muted hover:text-ink">Clear all</button>}
          </span>
        )}
      </div>

      <div className={`grid gap-4 ${positioning.length > 1 ? 'xl:grid-cols-2' : ''}`}>
        {data && mark && (
          <MarketBrief data={data} mark={mark} changes={changes} available={available} onBand={(b) => selectBand(b)} onTab={goTab} onCohort={(c) => set({ cohort: c })} />
        )}
        {positioning.length > 1 && (
          <section aria-labelledby="posh-title" className="material min-w-0 p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="posh-title" className="text-[13.5px] font-bold text-ink">Positioning history</h2>
              <span className="text-[11.5px] text-ink-muted">{positioning.length} stored snapshots · select a point to replay it</span>
            </div>
            <PositioningHistory points={positioning} onReplay={(t) => set({ at: t })} />
          </section>
        )}
      </div>

      {/* ---------------------------------------------------------- workspace */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] 3xl:grid-cols-[minmax(0,1fr)_520px]">
        <section aria-labelledby="radar-title" className="material min-w-0 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 id="radar-title" className="t-section text-ink">Liquidation Cascade Radar</h2>
              <InfoPopover p={METHOD} />
            </div>
            <span className="flex items-center gap-3 text-[11.5px] text-ink-muted">
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-[2px] bg-[var(--mint)]" />Long liq.</span>
              <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-[2px] bg-[var(--flare)]" />Short liq.</span>
              {available.includes('smart_money') && <span className="flex items-center gap-1"><span className="h-1 w-3 rounded-[2px] bg-[var(--signal)]" />Smart Money</span>}
            </span>
          </div>
          {!data || !mark ? (
            <div className="space-y-1.5" aria-busy="true">{Array.from({ length: 16 }, (_, i) => <div key={i} className="h-[22px] animate-pulse rounded-[6px] bg-ink/5" style={{ width: `${40 + ((i * 37) % 55)}%` }} />)}</div>
          ) : (
            <LiquidationRadar positions={inEntry} mark={mark} bandPct={state.bandPct} window={state.range} selected={state.band} highlightLiq={hoverLiq} smAvailable={available.includes('smart_money')} onSelect={selectBand} />
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <section aria-label="Inspector" className="material p-4 sm:p-5">
            {band && mark ? (
              <BandInspector band={band} positions={inBand} mark={mark} onClear={() => selectBand(null)} onHover={setHoverLiq} />
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-[13.5px] font-bold text-ink">Smart Money conviction shift</h3>
                  <p className="text-[12px] text-ink-muted">Select a band on the radar to see who is exposed there.</p>
                </div>
                {changes && !('unavailable' in changes) ? (
                  <ShiftCard data={changes} cohort={filters.cohort in changes.shift ? filters.cohort : available.includes('smart_money') && 'smart_money' in changes.shift ? 'smart_money' : 'all'} onDrill={() => goTab('changes')} />
                ) : (
                  <p className="text-[12.5px] text-ink-2">{changes && 'unavailable' in changes ? changes.unavailable : 'Loading changes…'}</p>
                )}
                <button type="button" onClick={() => goTab('cohorts')} className="text-[12.5px] font-semibold text-brand">Smart Money vs crowd <Go /></button>
              </div>
            )}
          </section>
          <section className="material p-4 sm:p-5">
            <AnalystPanel symbol={symbol} available={owner} suggestions={suggestions} buildContext={buildContext} coins={coins} onRange={selectRange}
              onAction={(a) => { if (a.navigate) router.push(a.navigate); else { set(a.patch as never); if (a.patch.tab) goTab(a.patch.tab); } }} />
          </section>
        </aside>
      </div>

      {/* --------------------------------------------------------------- tabs */}
      <section ref={tabsRef} aria-label="Analytics" className="material scroll-mt-4 p-4 sm:p-5">
        <div role="tablist" aria-label="Analytics views" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          {TABS.map((t) => (
            <button key={t.key} role="tab" type="button" aria-selected={state.tab === t.key} onClick={() => set({ tab: t.key })}
              className={`shrink-0 whitespace-nowrap rounded-[8px] px-3 py-1.5 text-[13px] font-semibold transition-colors duration-[var(--dur-fast)] ${state.tab === t.key ? 'bg-ink/12 text-ink' : 'text-ink-muted hover:text-ink'}`}>
              {t.label}
              {t.key === 'positions' && data ? <span className="num ml-1.5 text-ink-muted">{inBand.length}</span> : null}
            </button>
          ))}
        </div>
        {!data || !mark ? <div className="h-40 animate-pulse rounded-[10px] bg-ink/5" /> : (
          <div role="tabpanel">
            {state.tab === 'positions' && (
              <DataTable rows={inBand} cols={cols} rowKey={(p) => `${p.address}:${p.side}`} initialSort={{ key: 'value', dir: -1 }} onRowHover={(p) => setHoverLiq(p?.liq ?? null)}
                label="Observed positions" empty={<>No positions match these filters. {activeChips.length > 0 && <button type="button" className="font-semibold text-brand" onClick={() => set({ cohort: 'all', side: 'both', minLeverage: 1, minUsd: 0, band: null, entry: null })}>Clear filters</button>}</>} />
            )}
            {state.tab === 'consensus' && <ConsensusMap positions={inBand} mark={mark} />}
            {state.tab === 'leaders' && (owner ? <PnlLeaders symbol={symbol} /> : <p className="text-[13px] text-ink-muted">Nansen allows the PnL leaderboard only in the key owner&apos;s view.</p>)}
            {state.tab === 'proximity' && <ProximityTable positions={inEntry} mark={mark} onHover={setHoverLiq} />}
            {state.tab === 'changes' && <ChangesPanel data={changes} win={state.win} onWin={(w) => set({ win: w })} cohort={filters.cohort} />}
            {state.tab === 'cohorts' && <CohortMatrix positions={data.positions} mark={mark} available={available} active={filters.cohort} onPick={(c) => set({ cohort: c })} />}
            {state.tab === 'leverage' && <LeverageChart positions={inEntry} onPick={(l) => set({ minLeverage: l, tab: 'positions' })} />}
            {state.tab === 'entries' && <EntryChart positions={filtered} mark={mark} selected={state.entry} onPick={(r) => set({ entry: r })} />}
            {state.tab === 'trades' && (
              <div className="space-y-5">
                {data.smTrades && (
                  <div>
                    <h3 className="mb-2 text-[13.5px] font-bold text-ink">Smart Money perp trades, 24h</h3>
                    {'unavailable' in data.smTrades ? <p className="text-[12.5px] text-ink-muted">{data.smTrades.unavailable}</p> : <TradesTable trades={data.smTrades} label="Smart Money trades" />}
                  </div>
                )}
                <div>
                  <h3 className="mb-2 text-[13.5px] font-bold text-ink">Largest trades, 24h</h3>
                  {'unavailable' in data.trades ? <p className="text-[12.5px] text-ink-muted">{data.trades.unavailable}</p> : <TradesTable trades={data.trades} label="Largest trades" />}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <p className="text-[11.5px] text-ink-muted">
        Nansen data via your API key: {data ? `${data.tally.calls} calls, ${data.tally.credits} credits (${data.tally.cached} cached) for this view` : 'loading'}. Positions are the largest Nansen returns per cohort (up to {num(1000, 0)} each), refreshed at most every 5 minutes.
      </p>
    </div>
  );
}
