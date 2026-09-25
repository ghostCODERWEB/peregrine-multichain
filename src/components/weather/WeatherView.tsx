'use client';
import { useState } from 'react';
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
import { LockedPanel } from '@/components/ui/SurfaceKit';
import { Segmented } from '@/components/ui/Segmented';
import { chainName, usd } from '@/lib/viz/format';
import { STORM_LABEL } from '@/lib/viz/scales';
import { PressureLegend } from './PressureLegend';
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

  const ranked = data.chains.filter(c => c.cpi != null).sort((a,b) => b.cpi! - a.cpi!);
  const top = ranked[0], bottom = ranked.at(-1);
  const withheld = data.withheld.includes('fronts');
  const flows = data.fronts.filter(f => !f.inferred).slice(0,5);
  return (
    <div className={`space-y-8 transition-opacity ${isFetching ? 'opacity-90' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3"><h1 id="map-title" className="text-[22px] font-extrabold">Radar</h1><span className="flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand"><span className="live-dot" />Live · {scored} of {data.chains.length} chains</span></div>
        <Segmented label="Radar layers" value={layer} options={[{value:'spot',label:'Spot'},...(data.layers ?? []).map(l=>({value:l.id,label:({perps:'Perps',sectors:'Sectors',predictions:'Predictions'} as Record<string,string>)[l.id] ?? l.title}))]} onChange={setLayer} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <section aria-label="Market overview" className="material rise relative grid min-h-[420px] items-center gap-2 p-6 sm:p-7 xl:col-span-8 xl:grid-cols-[1.05fr_1fr]">
          <div className="relative z-10">
            <p className="mb-5 text-[12.5px] font-bold text-brand">{withheld ? 'All traders' : 'Smart money'} · last 24 hours</p>
            <h2 className="radar-headline">{top && bottom ? <>Accumulating <span className="text-accumulation">{chainName(top.chain)}.</span><br />Distributing <span className="text-distribution">{chainName(bottom.chain)}.</span></> : mapHeadline(data.chains,data.fronts)}</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-ink-2">{withheld ? 'Market-wide flow, normalized against each chain’s own history. Same-wallet rotations are private.' : frontsHeadline(data.fronts)}</p>
            <div className="mt-5 flex flex-wrap gap-2"><Link href="/flows" className="pill-button pill-primary">Open Capital Flows →</Link><Link href="/agent" className="pill-button pill-secondary">Ask Nansen why</Link></div>
          </div>
          {withheld ? <LockedPanel /> : <FlowOrbital fronts={data.fronts} />}
        </section>
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          {[top,bottom].map((c,i)=>c && <section key={i} className="material p-6" aria-label={i ? 'Top outflow' : 'Top inflow'}>
            <div className="flex items-center justify-between gap-2 text-[13px]"><Link href={`/chain/${c.chain}`} className="flex items-center gap-2 font-semibold text-ink-2"><ChainLogo chain={c.chain} size={24}/>{chainName(c.chain)}</Link><span style={{color:i?'var(--flare)':'var(--mint)'}}>{i?'↓ Top outflow':'↑ Top inflow'}</span></div>
            <div className="my-3 flex items-baseline gap-2"><span className="num text-[44px] font-extrabold leading-none">{Math.round(c.cpi!)}</span><span className="text-xs text-ink-muted">Flow Index</span>{c.provenance && <InfoPopover p={c.provenance}/>}</div>
            <AreaSpark values={c.series.map(v=>({t:v.t,value:v.cpi}))} color={i?'var(--flare)':'var(--mint)'} label={`${chainName(c.chain)} seven-day Flow Index; local trend scale`} />
          </section>)}
        </div>
        <section aria-labelledby="map-instrument-title" className="material min-w-0 p-5 sm:p-6 xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="map-instrument-title" className="text-[19px] font-bold">Flow Index across {data.chains.length} chains</h2><div role="tablist" aria-label="Map or table view">{(['map','table'] as const).map(v=><button key={v} role="tab" aria-selected={view===v} onClick={()=>setView(v)} className="terminal-tab px-3 py-2 text-xs capitalize">{v}</button>)}</div></div>
          <p className="mb-4 text-[13px] text-ink-muted">{withheld?'All-trader':'Smart-money'} net flow against each chain’s own history · 50 is neutral.</p>
          {activeLayer ? <LayerPanel layer={activeLayer} table={view==='table'} onRefresh={refetch}/> : view==='map' ? <HexMap chains={data.chains} fronts={showInferred?inferred:[]} selectedFront={selected} onSelectFront={setSelected}/> : <ChainTable chains={data.chains}/>}
          {!activeLayer && <div className="mt-4"><PressureLegend/></div>}
        </section>
        <Card id="storms-title" title="Dump risk" sub="Highest readings in the last 48 hours." className="xl:col-span-4">
          {data.storms[0] ? <ActivityRings values={data.storms.slice(0,3).map(s=>({name:`${s.symbol || s.tokenAddress.slice(0,6)} · ${chainName(s.chain)}`,value:s.score}))} value={data.storms[0].score} band={STORM_LABEL[data.storms[0].band]}/> : <p className="text-sm text-ink-muted">No stored risk readings yet.</p>}
        </Card>
        <Card id="fronts-title" title={withheld?'Capital flows: key-owner view only':'Capital Flows'} sub="Same wallets moving between chains within 12 hours." className="xl:col-span-7" action={<Link href="/flows" className="whitespace-nowrap text-xs font-bold text-brand">See all →</Link>}>
          {withheld ? <LockedPanel compact/> : flows.length ? <ul className="divide-y divide-border">{flows.map(f=><li key={frontKey(f)}><Link href="/flows" className="flex items-center gap-3 py-4"><span className="flex -space-x-1"><ChainLogo chain={f.from} size={26}/><ChainLogo chain={f.to} size={26}/></span><span className="min-w-0 flex-1 text-[13px] font-bold">{chainName(f.from)} → {chainName(f.to)}<span className="block text-xs font-normal text-ink-muted">{f.walletCount} wallets</span></span><span className="hidden h-1.5 w-24 rounded-full bg-raised sm:block"><span className="block h-full rounded-full" style={{width:`${f.netUsd/Math.max(...flows.map(f=>f.netUsd),1)*100}%`,background:'linear-gradient(90deg,var(--flare),var(--mint))'}}/></span><span className="num text-sm font-bold">{usd(f.netUsd)}</span></Link></li>)}</ul> : <p className="text-sm text-ink-muted">No qualifying rotations in 24 hours. Explore longer windows in Capital Flows.</p>}
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">Flow Index measures market-wide net flow against a chain’s history. Rotated USD tracks the same wallets between chains; the two can disagree.</p>
        </Card>
        <Card id="anchor-title" title="Ask Nansen" sub="Market brief · expert questions cost 750 credits" className="xl:col-span-5">
          <AnchorCard query="kind=bulletin" initial={anchor} label="Nansen’s market brief from available observations."/>
          <div className="mt-4 flex flex-wrap gap-2">{['What is accumulating?','Where are wallets rotating?','What is driving risk?'].map(q=><Link key={q} href={`/agent?q=${encodeURIComponent(q)}`} className="rounded-full border border-border px-3 py-2 text-xs">{q}</Link>)}</div>
          <Link href="/agent" className="inset-well mt-4 flex justify-between gap-3 p-4 text-sm text-ink-muted">Ask about a chain, token or wallet <span className="text-ink">↑</span></Link>
        </Card>
      </div>
      {alpha}
      <StormTicker storms={data.storms}/>
      <section aria-labelledby="inferred-title" className="material border-dashed p-5 sm:p-6">
        <h2 id="inferred-title" className="text-[19px] font-bold tracking-[-0.02em] text-ink">Inferred rotations · evidence, not ownership</h2>
        <p className="mt-1 text-[13.5px] text-ink-muted">First-funding links plus a sell then buy within 12h; two independent groups must agree. Not proof of common control.</p>
        {!data.inference ? <div className="mt-3"><LockedPanel compact /></div> : <>
          <p className="mt-2 text-xs text-ink-muted">Last check <TimeAgo ts={data.inference.at} /> · {data.inference.checked} wallets checked · {data.inference.links} eligible direct funding records · {data.inference.failures} unavailable responses. {data.inference.stale ? 'Evidence expired after 24 hours; candidates are withheld.' : ''}</p>
          {inferred.length ? <>
            <label className="my-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={showInferred} onChange={(e) => { setShowInferred(e.target.checked); setSelected(null); }} />Show inferred candidates as dashed arcs on the spot map</label>
            <FrontsList fronts={inferred} onSelect={setSelected} />
          </> : <p className="mt-3 text-sm text-ink-2">No qualifying inferred rotation in the current evidence.</p>}
          <InferenceControls maxCredits={data.inference.maxCredits} onUpdated={refetch} />
        </>}
      </section>

      <section aria-labelledby="forecast-title">
        <h2 id="forecast-title" className="mb-1 text-[19px] font-bold tracking-[-0.02em] text-ink">24h flow projection — the ten chains furthest from neutral</h2>
        <p className="mb-3 text-sm text-ink-2">
          Holt linear smoothing on Peregrine&apos;s own CPI history, with an 80% fan. Every projection shows its track record next to it.
        </p>
        <ForecastStrip forecasts={data.forecasts} />
      </section>

      <FrontSheet front={selectedFront} onClose={() => setSelected(null)} />
    </div>
  );
}
