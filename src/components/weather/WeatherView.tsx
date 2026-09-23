'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HexMap } from './HexMap';
import { FrontsList, FrontSheet, frontKey } from './FrontsPanel';
import { PressureLegend } from './PressureLegend';
import { ForecastStrip } from './ForecastStrip';
import { ChainTable } from './ChainTable';
import { StormTicker } from './StormTicker';
import { mapHeadline, frontsHeadline } from '@/lib/insights';
import { TimeAgo } from '@/components/TimeAgo';
import type { WeatherBulletin } from '@/server/weather/bulletin';

async function fetchBulletin(): Promise<WeatherBulletin> {
  const r = await fetch('/api/weather', { cache: 'no-store' });
  if (!r.ok) throw new Error(`weather ${r.status}`);
  return r.json();
}

export function WeatherView({ initial }: { initial: WeatherBulletin }) {
  const { data, isFetching } = useQuery({
    queryKey: ['weather'],
    queryFn: fetchBulletin,
    initialData: initial,
    refetchInterval: 60_000,
  });
  const [view, setView] = useState<'map' | 'table'>('map');
  const [selected, setSelected] = useState<string | null>(null);
  const selectedFront = data.fronts.find((f) => frontKey(f) === selected) ?? null;

  const scored = data.chains.filter((c) => c.cpi != null).length;

  return (
    <div className={`space-y-8 transition-opacity ${isFetching ? 'opacity-90' : ''}`}>
      <section aria-labelledby="map-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="map-title" className="text-xl font-semibold text-ink sm:text-2xl">
              {mapHeadline(data.chains, data.fronts)}
            </h1>
            <p className="mt-1 text-sm text-ink-2">
              Chain Pressure Index for all {data.chains.length} chains the Nansen API lists — {scored} with a live reading.
              Last scan <TimeAgo ts={data.scan.last?.finished_at} />, {data.scan.runs} scans and{' '}
              {data.scan.trades.toLocaleString('en-US')} smart-money trades recorded so far.
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
        <div className="rounded-xl border border-border bg-surface p-4">
          {view === 'map' ? (
            <HexMap chains={data.chains} fronts={data.fronts} selectedFront={selected} onSelectFront={setSelected} />
          ) : (
            <ChainTable chains={data.chains} />
          )}
          <div className="mt-4 border-t border-border pt-3">
            <PressureLegend />
          </div>
        </div>
      </section>

      <section aria-labelledby="storms-title">
        <h2 id="storms-title" className="mb-1 text-base font-semibold text-ink">
          {data.storms[0] && (data.storms[0].band === 'warning' || data.storms[0].band === 'watch')
            ? `Storm warnings: ${data.storms.filter((s) => s.band === 'warning' || s.band === 'watch').length} token${data.storms.filter((s) => s.band === 'warning' || s.band === 'watch').length === 1 ? '' : 's'} at elevated dump risk`
            : 'Storm warnings: no token above Cloudy right now'}
        </h2>
        <p className="mb-3 text-sm text-ink-2">
          Highest Storm Scores of the last 48 hours across all chains — concentration, insider clusters, informed selling into fresh buying, exit liquidity and sell pressure. Probabilistic, not financial advice.
        </p>
        <StormTicker storms={data.storms} />
      </section>

      <section aria-labelledby="fronts-title" className="rounded-xl border border-border bg-surface p-4">
        <h2 id="fronts-title" className="text-base font-semibold text-ink">{frontsHeadline(data.fronts)}</h2>
        <p className="mb-2 mt-1 text-sm text-ink-2">
          Rotation fronts: the same wallet sold risk on one chain and bought risk on another within 12 hours. Measured from
          smart-money DEX trades, not inferred from volume. Select a front to see the wallets behind it.
        </p>
        <FrontsList fronts={data.fronts} onSelect={setSelected} />
      </section>

      <section aria-labelledby="forecast-title">
        <h2 id="forecast-title" className="mb-1 text-base font-semibold text-ink">24h pressure forecast — the ten chains furthest from calm</h2>
        <p className="mb-3 text-sm text-ink-2">
          Holt linear smoothing on TIDE&apos;s own CPI history, with an 80% fan. Every forecast shows its track record next to it.
        </p>
        <ForecastStrip forecasts={data.forecasts} />
      </section>

      <FrontSheet front={selectedFront} onClose={() => setSelected(null)} />
    </div>
  );
}
