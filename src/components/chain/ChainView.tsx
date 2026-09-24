'use client';
import Link from 'next/link';
import { Card, Unavailable } from '@/components/Card';
import { Barometer, barometerTitle } from './Barometer';
import { TideChart, tideTitle } from './TideChart';
import { FlowBars, flowsTitle } from './FlowBars';
import { SectorTreemap, sectorsTitle } from './SectorTreemap';
import { PeersSlope, peersTitle } from './PeersSlope';
import { ChainHero, MarketGrid, gridTitle, ChainRank, rankTitle } from './Visuals';
import { TradeTape } from './TradeTape';
import { PaidTradeTape } from '@/components/x402/PaidTradeTape';
import { ForecastMultiple } from '@/components/weather/ForecastStrip';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, num } from '@/lib/viz/format';
import type { ChainPageData, PeerRow } from '@/server/weather/chain-page';
import { AskNansen } from '@/components/agent/AskNansen';

export interface ModuleGaps {
  /** null when available; otherwise the plain "not available" sentence. */
  pressure: string | null;
  trades: string | null;
  tier: string;
}

export function ChainView({ d, gaps }: { d: ChainPageData; gaps: ModuleGaps }) {
  const name = chainName(d.chain);
  const who = d.weather.source === 'market-flow' ? 'all-trader' : 'smart-money';
  const f = d.forecast;
  const fEnd = f.points.at(-1)?.forecast;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/" className="text-[12.5px] text-ink-2 hover:text-ink">← Radar</Link>
        <AskNansen subject={{ kind: 'chain', chain: d.chain }} label={`the ${name} chain page`} />
      </div>
      <ChainHero d={d} tier={gaps.tier} title={barometerTitle(d.weather)} note={<>
        {d.weather.source === 'smart-money' && 'Smart-money flow (Nansen labels).'}
        {d.weather.source === 'market-flow' && (d.mode !== 'owner' && gaps.tier === 'A' ? 'All-trader flow; smart-money flow is owner-only.' : `All-trader flow: Nansen has no smart-money labels on ${name}.`)}
        {d.weather.source == null && gaps.pressure}
      </>} />

      {d.chain === 'hyperliquid' && (
        <p className="glass rounded-2xl px-4 py-3 text-[13px] text-ink-2">
          Hyperliquid is a perp venue: its reading here is the Perp Flow Index, weighted by open interest across its coins.{' '}
          <Link href="/perps" className="text-ink underline-offset-2 hover:underline">Open the perps terminal →</Link>
        </p>
      )}

      <Card id="grid" title={d.grid.tiles.length ? gridTitle(d.chain, d.grid.tiles) : `${name} market`}
        sub="The chain's most-traded tokens today, one tile each: colour is the 24h move (green up, red down), the bar is volume. All traders."
        action={d.grid.provenance ? <InfoPopover p={d.grid.provenance} /> : undefined}>
        {d.grid.tiles.length ? <MarketGrid chain={d.chain} tiles={d.grid.tiles} /> : <Unavailable text={d.grid.unavailable ?? `Nansen returned no tokens for ${name}.`} />}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card id="baro" title="Flow gauge" sub="0–100 · 50 neutral · above 65 accumulation · below 35 distribution">
          <Barometer w={d.weather} provenance={d.cpiProvenance} />
          {d.weather.cpi != null && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="text-[12.5px] font-medium text-ink">
                  {f.insufficient ? '24h projection' : `24h projection: ${num(d.weather.cpi, 0)} → ${num(fEnd, 0)}`}
                </span>
                <InfoPopover p={d.forecastProvenance} />
              </div>
              {f.history.length > 0 && <ForecastMultiple f={{ ...f, provenance: d.forecastProvenance }} />}
              <p className="num mt-1 text-[11px] text-ink-muted">
                {f.insufficient ? `unlocks at 12 snapshots · ${f.sampleSize} so far` : `80% fan · in-sample MAPE ${f.mape == null ? '—' : `${num(f.mape)}%`} · n=${f.sampleSize}`}
              </p>
            </div>
          )}
        </Card>

        <Card
          id="tide"
          className="lg:col-span-2"
          title={d.weather.source ? tideTitle(d.chain, d.tide, `${who} flow`) : 'Cumulative flow'}
          sub={`Running total of ${who} net flow into ${name} from Peregrine's own snapshots. The shaded fan is a 24h Holt projection with an 80% band.`}
        >
          {d.weather.source ? <TideChart tide={d.tide} /> : <p className="text-sm text-ink-2">{gaps.pressure}</p>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          id="flows"
          title={d.flows.kind === 'unavailable' ? 'Token flows' : flowsTitle(d.chain, d.flows)}
          sub="Top ten tokens each way by 24h net flow, on one shared USD scale. Select a token for its page."
        >
          <FlowBars chain={d.chain} f={d.flows} />
        </Card>
        <Card
          id="sectors"
          title={d.flows.kind === 'smart-money' ? sectorsTitle(d.chain, d.flows) : 'Sectors'}
          sub="Tile area = gross smart-money flow through the sector in 24h; color = net direction (green in, red out)."
        >
          {d.flows.kind === 'unavailable' ? <p className="text-sm text-ink-2">{d.flows.unavailable}</p>
            : d.mode === 'public' && gaps.tier === 'A' ? <Unavailable text="Sector flows come from Nansen smart-money inflows, which are shown to the API key owner only." />
            : <SectorTreemap f={d.flows} />}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="rank" title={rankTitle(d.chain, d.peers.rows as PeerRow[])} sub="Every chain Nansen ranks, by one weekly metric at a time; this chain highlighted."
          action={d.peers.provenance ? <InfoPopover p={d.peers.provenance} /> : undefined}>
          <ChainRank chain={d.chain} rows={d.peers.rows as PeerRow[]} />
        </Card>
        <Card
          id="peers"
          title={peersTitle(d.chain, d.peers)}
          sub="DEX volume indexed to 100 over the prior 7 days. Every other chain in gray."
        >
          <PeersSlope chain={d.chain} p={d.peers} />
        </Card>
      </div>

      <div>
        <Card
          id="tape"
          title={`Latest smart-money trades on ${name}`}
          sub="DEX swaps by Nansen-labelled smart money, recorded by the scanner. Buy = stable or native in, risk token out of the pool."
        >
          {gaps.trades ? <p className="text-sm text-ink-2">{gaps.trades}</p>
            : d.tapeSource === 'withheld' ? (
              <div className="space-y-3">
                <Unavailable text="Shown only to this instance's owner: the tape comes from the scanner's smart-money trades, fetched with the owner's Nansen key, which Nansen's redistribution rules keep out of shared views." />
                {d.x402 && <PaidTradeTape chain={d.chain} />}
              </div>
            )
            : d.tapeSource === 'error' ? <p className="text-sm text-ink-2">Nansen did not return smart-money trades for {name} on your key just now.</p>
            : (
              <>
                {d.tapeSource === 'live' && <p className="mb-2 text-xs text-ink-muted">Fetched just now with your Nansen key.</p>}
                <TradeTape tape={d.tape} />
              </>
            )}
        </Card>
      </div>
    </div>
  );
}
