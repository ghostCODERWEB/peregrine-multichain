'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HexMap } from './HexMap';
import { FrontsList, FrontSheet, frontKey } from './FrontsPanel';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { ChainLogo } from '@/components/Logo';
import { InfoPopover } from '@/components/InfoPopover';
import { AreaSpark } from '@/components/viz/AreaSpark';
import { ActivityRings } from '@/components/viz/ActivityRings';
import { FlowOrbital } from '@/components/viz/FlowOrbital';
import { FlowMovers } from '@/components/viz/FlowMovers';
import { netFlowMap, chainNets } from '@/lib/viz/net-flow-map';
import { useSite } from '@/components/SiteContext';
import { LockedPanel } from '@/components/ui/SurfaceKit';
import { Segmented } from '@/components/ui/Segmented';
import { chainName, usd } from '@/lib/viz/format';
import { STORM_LABEL } from '@/lib/viz/scales';
import { ChainGrid } from './ChainGrid';
import { ScoreRing } from '@/components/viz/ScoreRing';
import type { WeatherLayer } from '@/server/weather/layers';
import { ForecastStrip } from './ForecastStrip';
import { ChainTable } from './ChainTable';
import { StormTicker } from './StormTicker';
import { LayerPanel } from './LayerPanel';
import { InferenceControls } from './InferenceControls';
import { AnchorCard } from '@/components/AnchorCard';
import type { AnchorReport } from '@/server/agents/anchor';
import { mapHeadline, frontsHeadline } from '@/lib/insights';
import { TimeAgo } from '@/components/TimeAgo';
import type { WeatherBulletin } from '@/server/weather/bulletin';

async function fetchBulletin(): Promise<WeatherBulletin> {
  const r = await fetch('/api/weather', { cache: 'no-store' });
  if (!r.ok) throw new Error(`weather ${r.status}`);
  return r.json();
}

export function WeatherView({
  initial,
  anchor,
  alpha,
}: {
  initial: WeatherBulletin;
  anchor: AnchorReport | null;
  alpha?: React.ReactNode;
}) {
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

  const ranked = data.chains.filter((c) => c.cpi != null).sort((a, b) => b.cpi! - a.cpi!);
  const top = ranked[0],
    bottom = ranked.at(-1);
  const withheld = data.withheld.includes('fronts');
  // On a public site the Capital Flows card is left out (it can never unlock).
  const { publicSite } = useSite();
  const flows = data.fronts.filter((f) => !f.inferred).slice(0, 5);
  // Public view: the same map from each chain's measured market-wide net flow.
  // The hero is a teaser: three chains each way stay legible on the small orbit.
  const netMap = useMemo(() => netFlowMap(chainNets(data.chains), { sellers: 3, buyers: 3, pairs: 6 }), [data.chains]);
  const netLine =
    netMap.sellers.length && netMap.buyers.length
      ? `${usd(netMap.totalOut)} of net flow left ${chainName(netMap.sellers[0].chain)}${netMap.sellers.length > 1 ? ` and ${netMap.sellers.length - 1} more chain${netMap.sellers.length > 2 ? 's' : ''}` : ''} in 24h; ${chainName(netMap.buyers[0].chain)} took in the most (+${usd(netMap.buyers[0].net)}).`
      : 'Market-wide net flow on every chain, measured against its own history.';
  const nets = useMemo(() => new Map([...netMap.sellers, ...netMap.buyers].map((n) => [n.chain, n.net])), [netMap]);
  const riskAlerts = (cls: string) => (
    <Card id="risk-alerts" title="Risk alerts" sub="Highest Dump Risk across chains, last 48 hours · not financial advice" className={cls}>
      <StormTicker storms={data.storms} />
    </Card>
  );
  const views = [
    { value: 'spot', label: 'Spot' },
    ...(data.layers ?? []).map((l) => ({
      value: l.id,
      label: ({ perps: 'Perps', sectors: 'Sectors', predictions: 'Predictions' } as Record<string, string>)[l.id] ?? l.title,
    })),
  ];
  const mapTabs = (
    <div
      role="tablist"
      aria-label="Map or table view"
      className="inline-flex gap-0.5 rounded-[12px] border border-[var(--hair)] bg-ink/5 p-[3px]"
    >
      {(['map', 'table'] as const).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          onClick={() => setView(v)}
          className={`min-h-[28px] rounded-[9px] px-3 text-xs font-bold capitalize ${view === v ? 'bg-ink/15 text-ink' : 'text-ink-muted hover:text-ink'}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
  return (
    <div className={`space-y-6 transition-opacity ${isFetching ? 'opacity-90' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="map-title" className="text-[22px] font-extrabold tracking-[-0.02em]">
            Overview
          </h1>
          <span className="flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            <span className="live-dot" />
            Live · {scored} of {data.chains.length} chains
          </span>
        </div>
        <Segmented
          label="Overview views"
          value={layer}
          options={views}
          onChange={(v) => {
            setLayer(v);
            setView('map');
          }}
        />
      </div>

      {activeLayer ? (
        <LayerOverview layer={activeLayer} table={view === 'table'} tabs={mapTabs} onRefresh={refetch} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section
              aria-label="Market overview"
              className="material rise relative grid min-h-[400px] items-center gap-2 p-6 sm:p-7 xl:col-span-8 xl:grid-cols-[1fr_1.05fr]"
            >
              <div className="relative z-10">
                <p className="mb-4 text-[12.5px] font-bold text-brand">{withheld ? 'All traders' : 'Smart money'} · last 24 hours</p>
                <h2 className="radar-headline">
                  {top && bottom ? (
                    <>
                      Accumulating <span className="text-accumulation">{chainName(top.chain)}.</span>
                      <br />
                      Distributing <span className="text-distribution">{chainName(bottom.chain)}.</span>
                    </>
                  ) : (
                    mapHeadline(data.chains, data.fronts)
                  )}
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{withheld ? netLine : frontsHeadline(data.fronts)}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/flows" className="pill-button pill-primary">
                    Open Capital Flows →
                  </Link>
                </div>
              </div>
              {!withheld ? (
                <FlowOrbital fronts={data.fronts} />
              ) : netMap.edges.length ? (
                <FlowOrbital fronts={netMap.edges} modeled nets={nets} />
              ) : (
                <FlowMovers chains={data.chains} />
              )}
            </section>
            <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
              {[top, bottom].map(
                (c, i) =>
                  c && (
                    <section key={i} className="material p-6" aria-label={i ? 'Top outflow' : 'Top inflow'}>
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <Link href={`/chain/${c.chain}`} className="flex items-center gap-2 font-semibold text-ink-2">
                          <ChainLogo chain={c.chain} size={24} />
                          {chainName(c.chain)}
                        </Link>
                        <span className="font-semibold" style={{ color: i ? 'var(--flare)' : 'var(--mint)' }}>
                          {i ? '↓ Top outflow' : '↑ Top inflow'}
                        </span>
                      </div>
                      <div className="my-3 flex items-baseline gap-2">
                        <span className="num text-[44px] font-extrabold leading-none">{Math.round(c.cpi!)}</span>
                        <span className="text-xs text-ink-muted">Flow Index</span>
                        {c.provenance && <InfoPopover p={c.provenance} />}
                      </div>
                      <AreaSpark
                        values={c.series.map((v) => ({ t: v.t, value: v.cpi }))}
                        color={i ? 'var(--flare)' : 'var(--mint)'}
                        label={`${chainName(c.chain)} seven-day Flow Index`}
                      />
                    </section>
                  ),
              )}
            </div>
            <section aria-labelledby="map-instrument-title" className="material min-w-0 p-5 sm:p-6 xl:col-span-12">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <h2 id="map-instrument-title" className="text-[19px] font-bold tracking-[-0.02em]">
                  Flow Index
                </h2>
                {mapTabs}
              </div>
              <p className="mb-4 text-[13px] text-ink-muted">Net flow against each chain’s own history · 50 is neutral</p>
              {view === 'table' ? (
                <ChainTable chains={data.chains} />
              ) : showInferred ? (
                <HexMap chains={data.chains} fronts={inferred} selectedFront={selected} onSelectFront={setSelected} />
              ) : (
                <ChainGrid chains={data.chains} />
              )}
            </section>
            <Card id="storms-title" title="Dump risk" sub="Highest readings, last 48 hours" className="xl:col-span-4">
              {data.storms[0] ? (
                <ActivityRings
                  values={data.storms
                    .slice(0, 3)
                    .map((s) => ({ name: `${s.symbol || s.tokenAddress.slice(0, 6)} · ${chainName(s.chain)}`, value: s.score }))}
                  value={data.storms[0].score}
                  band={STORM_LABEL[data.storms[0].band]}
                />
              ) : (
                <p className="text-sm text-ink-muted">No risk readings yet.</p>
              )}
            </Card>
            {publicSite && withheld ? (
              riskAlerts('xl:col-span-8')
            ) : (
              <>
                <Card
                  id="fronts-title"
                  title={withheld ? 'Capital flows: key-owner view only' : 'Capital Flows'}
                  sub="Same wallets moving between chains within 12 hours"
                  className="xl:col-span-8"
                  action={
                    <Link href="/flows" className="whitespace-nowrap text-xs font-bold text-brand">
                      See all →
                    </Link>
                  }
                >
                  {withheld ? (
                    <LockedPanel compact />
                  ) : flows.length ? (
                    <ul className="divide-y divide-border">
                      {flows.map((f) => (
                        <li key={frontKey(f)}>
                          <Link href="/flows" className="flex items-center gap-3 py-4">
                            <span className="flex -space-x-1">
                              <ChainLogo chain={f.from} size={26} />
                              <ChainLogo chain={f.to} size={26} />
                            </span>
                            <span className="min-w-0 flex-1 text-[13px] font-bold">
                              {chainName(f.from)} → {chainName(f.to)}
                              <span className="block text-xs font-normal text-ink-muted">{f.walletCount} wallets</span>
                            </span>
                            <span className="hidden h-1.5 w-24 rounded-full bg-raised sm:block">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${(f.netUsd / Math.max(...flows.map((f) => f.netUsd), 1)) * 100}%`,
                                  background: 'linear-gradient(90deg,var(--flare),var(--mint))',
                                }}
                              />
                            </span>
                            <span className="num text-sm font-bold">{usd(f.netUsd)}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-muted">No rotations in 24 hours. Try a longer window in Capital Flows.</p>
                  )}
                </Card>
              </>
            )}
            {(!publicSite || anchor) && (
              <Card id="anchor-title" title="Ask Nansen" sub="Nansen’s latest market brief" className="xl:col-span-12">
                <AnchorCard query="kind=bulletin" initial={anchor} label="Nansen’s market brief from available observations." />
                <div className="owner-action mt-4 flex flex-wrap gap-2">
                  {['What is accumulating?', 'Where are wallets rotating?', 'What is driving risk?'].map((q) => (
                    <Link
                      key={q}
                      href={`/agent?q=${encodeURIComponent(q)}`}
                      className="rounded-full border border-border px-3 py-2 text-xs"
                    >
                      {q}
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
          {alpha}
          {!(publicSite && withheld) && riskAlerts('')}
          {data.inference && (
            <section aria-labelledby="inferred-title" className="material border-dashed p-5 sm:p-6">
              <h2 id="inferred-title" className="text-[19px] font-bold tracking-[-0.02em] text-ink">
                Inferred rotations
              </h2>
              <p className="mt-1 text-[13.5px] text-ink-muted">
                Shared first funders plus a sell-then-buy within 12h. Evidence, not proof of common control.
              </p>
              <p className="mt-2 text-xs text-ink-muted">
                Checked <TimeAgo ts={data.inference.at} /> · {data.inference.checked} wallets
                {data.inference.stale ? ' · evidence over 24h old, candidates withheld' : ''}
              </p>
              {inferred.length ? (
                <>
                  <label className="my-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showInferred}
                      onChange={(e) => {
                        setShowInferred(e.target.checked);
                        setSelected(null);
                        setView('map');
                      }}
                    />
                    Show as dashed arcs on the map
                  </label>
                  <FrontsList fronts={inferred} onSelect={setSelected} />
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-2">No inferred rotation in the current evidence.</p>
              )}
              <InferenceControls maxCredits={data.inference.maxCredits} onUpdated={refetch} />
            </section>
          )}
          <Card id="forecast-title" title="24h projections" sub="Chains furthest from neutral · shaded: 80% range">
            <ForecastStrip forecasts={data.forecasts} />
          </Card>
        </>
      )}

      <FrontSheet front={selectedFront} onClose={() => setSelected(null)} />
    </div>
  );
}

/** A Perps, Sectors or Predictions view of the whole Overview: its own
 *  finding, the two readings furthest apart, and every reading. */
function LayerOverview({
  layer,
  table,
  tabs,
  onRefresh,
}: {
  layer: WeatherLayer;
  table: boolean;
  tabs: React.ReactNode;
  onRefresh: () => Promise<unknown>;
}) {
  const scored = layer.readings.filter((r) => r.score != null).sort((a, b) => b.score! - a.score!);
  const hi = scored[0],
    lo = scored.length > 1 ? scored.at(-1)! : null;
  const signed = layer.id === 'sectors';
  // One plain line per view; the formula and inputs stay in the ⓘ receipt.
  const plain = {
    perps: 'Hyperliquid coins scored 0–100 on long/short bias. 50 is balanced.',
    sectors: 'Sector baskets scored against their own history. Above 50, money is coming in.',
    predictions: 'Polymarket categories by trading activity against their usual weekly pace. Not net YES/NO flow or a probability.',
  }[layer.id];
  const headline = !hi ? (
    layer.title
  ) : layer.id === 'perps' ? (
    <>
      Longs lean into <span className="text-accumulation">{hi.name}.</span>
      {lo && (
        <>
          <br />
          Shorts into <span className="text-distribution">{lo.name}.</span>
        </>
      )}
    </>
  ) : layer.id === 'sectors' ? (
    <>
      Money into <span className="text-accumulation">{hi.name}.</span>
      {lo && (
        <>
          <br />
          Out of <span className="text-distribution">{lo.name}.</span>
        </>
      )}
    </>
  ) : (
    <>
      <span className="text-accumulation">{hi.name}</span> is running hot.
    </>
  );
  const empty = !hi;
  const card = (r: typeof hi | null, i: number) =>
    r && (
      <section key={i} className="material p-6" aria-label={i ? 'Lowest reading' : 'Highest reading'}>
        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="truncate font-semibold text-ink-2">{r.name}</span>
          <span className="font-semibold" style={{ color: i ? 'var(--flare)' : 'var(--mint)' }}>
            {i ? '↓ Lowest' : '↑ Highest'}
          </span>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <ScoreRing score={r.score!} size={84} stroke={8} color={i ? 'var(--flare)' : 'var(--mint)'} label={r.name} />
          <div>
            <div className="text-xs text-ink-muted">{layer.metric}</div>
            <div className="num text-[22px] font-extrabold">{usd(r.value, { signed })}</div>
          </div>
        </div>
      </section>
    );
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <section
        aria-label={`${layer.title} overview`}
        className={`material rise flex flex-col justify-center p-6 sm:p-7 ${empty ? 'xl:col-span-12' : 'min-h-[260px] xl:col-span-8'}`}
      >
        <p className="mb-4 text-[12.5px] font-bold text-brand">
          {layer.title}
          {layer.at ? (
            <>
              {' '}
              · <TimeAgo ts={layer.at} />
            </>
          ) : null}
        </p>
        <h2 className="radar-headline">{empty ? `No fresh ${layer.title.toLowerCase()} yet` : headline}</h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-2">{plain}</p>
        <div className="mt-5">
          <Link href={layer.href} className="pill-button pill-primary">
            Open {layer.title} →
          </Link>
        </div>
      </section>
      {!empty && (
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          {card(hi, 0)}
          {card(lo, 1)}
        </div>
      )}
      <section aria-labelledby="layer-readings" className="material min-w-0 p-5 sm:p-6 xl:col-span-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="layer-readings" className="text-[19px] font-bold tracking-[-0.02em]">
            All readings
          </h2>
          {tabs}
        </div>
        <LayerPanel layer={layer} table={table} onRefresh={onRefresh} />
      </section>
    </div>
  );
}
