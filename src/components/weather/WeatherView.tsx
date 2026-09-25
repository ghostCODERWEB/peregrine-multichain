'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HexMap } from './HexMap';
import { FrontsList, FrontSheet, frontKey } from './FrontsPanel';
import { CapitalFlows } from './CapitalFlows';
import { PressureLegend } from './PressureLegend';
import { ForecastStrip } from './ForecastStrip';
import { ChainTable } from './ChainTable';
import { StormTicker } from './StormTicker';
import { PulseBand } from './PulseBand';
import { LayerPanel } from './LayerPanel';
import { InferenceControls } from './InferenceControls';
import { AnchorCard } from '@/components/AnchorCard';
import type { AnchorReport } from '@/server/agents/anchor';
import { mapHeadline } from '@/lib/insights';
import { TimeAgo } from '@/components/TimeAgo';
import type { WeatherBulletin } from '@/server/weather/bulletin';

async function fetchBulletin(): Promise<WeatherBulletin> {
  const r = await fetch('/api/weather', { cache: 'no-store' });
  if (!r.ok) throw new Error(`weather ${r.status}`);
  return r.json();
}

export function WeatherView({ initial, anchor, alpha }: { initial: WeatherBulletin; anchor: AnchorReport | null; alpha?: React.ReactNode }) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['weather'],
    queryFn: fetchBulletin,
    initialData: initial,
    refetchInterval: 60_000,
  });
  const [view, setView] = useState<'map' | 'table'>('map');
  const [layer, setLayer] = useState('spot');
  const activeLayer = data.layers?.find((l) => l.id === layer);
  const [selected, setSelected] = useState<string | null>(null);
  const [showInferred, setShowInferred] = useState(false);
  const inferred = data.inference?.fronts ?? [];
  const selectedFront = [...data.fronts, ...inferred].find((f) => frontKey(f) === selected) ?? null;

  const scored = data.chains.filter((c) => c.cpi != null).length;

  return (
    <div className={`space-y-8 transition-opacity ${isFetching ? 'opacity-90' : ''}`}>
      <section aria-labelledby="map-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="map-title" className="text-xl font-semibold text-ink sm:text-2xl">
              {mapHeadline(data.chains, data.fronts)}
            </h1>
            <p className="num mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
              <span><span className="text-ink">{scored}</span>/{data.chains.length} chains live</span>
              <span aria-hidden>·</span>
              <span>scanned <TimeAgo ts={data.scan.last?.finished_at} /></span>
              <span aria-hidden>·</span>
              <span>{data.scan.runs} scans</span>
              <span aria-hidden>·</span>
              <span>{data.scan.trades.toLocaleString('en-US')} smart-money trades</span>
            </p>
          </div>
          <div className="flex rounded-md border border-border p-0.5 text-sm" role="tablist" aria-label="Map or table view">
            {(['map', 'table'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`rounded px-3 py-1 capitalize ${view === v ? 'bg-accent text-ink' : 'text-ink-2 hover:text-ink'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4"><PulseBand data={data} /></div>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Radar layers">
          {[{ id: 'spot', title: 'Spot flow' }, ...(data.layers ?? [])].map((l) => <button key={l.id} aria-pressed={layer === l.id} onClick={() => setLayer(l.id)} className={`rounded border border-border px-4 py-2 text-sm ${layer === l.id ? 'bg-accent text-ink' : 'text-ink-2 hover:text-ink'}`}>{l.title}</button>)}
        </div>
        <div className="glass rounded-2xl p-4">
          {activeLayer ? <LayerPanel layer={activeLayer} table={view === 'table'} onRefresh={refetch} /> : view === 'map' ? (
            <HexMap chains={data.chains} fronts={[...data.fronts, ...(showInferred ? inferred : [])]} selectedFront={selected} onSelectFront={setSelected} />
          ) : (
            <ChainTable chains={data.chains} />
          )}
          {!activeLayer && <div className="mt-4 border-t border-border pt-3">
            <PressureLegend />
          </div>}
        </div>
      </section>

      <CapitalFlows initial={data.fronts} chains={data.chains} withheld={data.withheld.includes('fronts')} />

      {alpha}

      <section aria-labelledby="anchor-title" className="glass rounded-2xl p-4">
        <h2 id="anchor-title" className="mb-2 text-base font-semibold text-ink">The market brief, read by Nansen&apos;s own agent</h2>
        <AnchorCard query="kind=bulletin" initial={anchor} label="Nansen's agent reads available spot, perp, sector and prediction observations, capital rotations, risk alerts and projections, then writes four sentences." />
      </section>

      <section aria-labelledby="storms-title">
        <h2 id="storms-title" className="mb-1 text-base font-semibold text-ink">
          {data.storms[0] && (data.storms[0].band === 'warning' || data.storms[0].band === 'watch')
            ? `Risk alerts: ${data.storms.filter((s) => s.band === 'warning' || s.band === 'watch').length} token${data.storms.filter((s) => s.band === 'warning' || s.band === 'watch').length === 1 ? '' : 's'} at elevated dump risk`
            : 'Risk alerts: no token above Moderate right now'}
        </h2>
        <p className="mb-3 text-[12.5px] text-ink-muted">Highest Dump Risk, last 48h, all chains · not financial advice</p>
        <StormTicker storms={data.storms} />
      </section>


      <section aria-labelledby="inferred-title" className="glass rounded-2xl border border-dashed border-border p-4">
        <h2 id="inferred-title" className="text-base font-semibold text-ink">Inferred rotations · evidence, not ownership</h2>
        <p className="mt-1 text-[12.5px] text-ink-muted">First-funding links plus a sell then buy within 12h; two independent groups must agree. Not proof of common control.</p>
        {!data.inference ? <p className="mt-2 text-sm text-ink-muted">Owner-only: these candidates use the instance&apos;s private smart-money trade history. Public and member views do not receive the evidence.</p> : <>
          <p className="mt-2 text-xs text-ink-muted">Last check <TimeAgo ts={data.inference.at} /> · {data.inference.checked} wallets checked · {data.inference.links} eligible direct funding records · {data.inference.failures} unavailable responses. {data.inference.stale ? 'Evidence expired after 24 hours; candidates are withheld.' : ''}</p>
          {inferred.length ? <>
            <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={showInferred} onChange={(e) => { setShowInferred(e.target.checked); setSelected(null); }} />Show inferred candidates as dashed arcs on the spot map</label>
            <FrontsList fronts={inferred} onSelect={setSelected} />
          </> : <p className="mt-3 text-sm text-ink-2">No qualifying inferred rotation in the current evidence.</p>}
          <InferenceControls maxCredits={data.inference.maxCredits} onUpdated={refetch} />
        </>}
      </section>

      <section aria-labelledby="forecast-title">
        <h2 id="forecast-title" className="mb-1 text-base font-semibold text-ink">24h flow projection — the ten chains furthest from neutral</h2>
        <p className="mb-3 text-sm text-ink-2">
          Holt linear smoothing on Peregrine&apos;s own CPI history, with an 80% fan. Every projection shows its track record next to it.
        </p>
        <ForecastStrip forecasts={data.forecasts} />
      </section>

      <FrontSheet front={selectedFront} onClose={() => setSelected(null)} />
    </div>
  );
}
