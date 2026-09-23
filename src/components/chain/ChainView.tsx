'use client';
import Link from 'next/link';
import { Card, Unavailable } from '@/components/Card';
import { Barometer, barometerTitle } from './Barometer';
import { TideChart, tideTitle } from './TideChart';
import { FlowBars, flowsTitle } from './FlowBars';
import { SectorTreemap, sectorsTitle } from './SectorTreemap';
import { PeersSlope, peersTitle } from './PeersSlope';
import { TradeTape } from './TradeTape';
import { PaidTradeTape } from '@/components/x402/PaidTradeTape';
import { ForecastMultiple } from '@/components/weather/ForecastStrip';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, num } from '@/lib/viz/format';
import type { ChainPageData } from '@/server/weather/chain-page';

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
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-[12.5px] text-ink-2 hover:text-ink">← Weather map</Link>
        <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{barometerTitle(d.weather)}</h1>
        <p className="mt-1 text-sm text-ink-2">
          Nansen coverage tier {gaps.tier}.{' '}
          {d.weather.source === 'smart-money' && 'Pressure is measured from Nansen smart-money labels.'}
          {d.mode !== 'owner' && d.weather.source === 'market-flow' && gaps.tier === 'A' && ' Pressure here is all-trader flow; the scanner\'s smart-money pressure is the instance owner\'s view only.'}
          {d.weather.source === 'market-flow' && `Nansen has no smart-money labels on ${name}, so pressure here reads all-trader flow and is ranked only against other all-trader chains.`}
          {d.weather.source == null && gaps.pressure}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card id="baro" title="Barometer" sub="Chain Pressure Index, 0–100. 50 is calm; above 65 is high pressure (net buying), below 35 low.">
          <Barometer w={d.weather} provenance={d.cpiProvenance} />
          {d.weather.cpi != null && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-1 flex items-start justify-between gap-2">
                <span className="text-[12.5px] font-medium text-ink">
                  {f.insufficient ? '24h forecast' : `24h forecast: ${num(d.weather.cpi, 0)} → ${num(fEnd, 0)}`}
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
          title={d.weather.source ? tideTitle(d.chain, d.tide, `${who} flow`) : 'Tide'}
          sub={`Running total of ${who} net flow into ${name} from TIDE's own snapshots. The shaded fan is a 24h Holt forecast with an 80% band.`}
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
          sub="Tile area = gross smart-money flow through the sector in 24h; color = net direction (amber in, blue out)."
        >
          {d.flows.kind === 'unavailable' ? <p className="text-sm text-ink-2">{d.flows.unavailable}</p>
            : d.mode === 'public' && gaps.tier === 'A' ? <Unavailable text="Sector flows come from Nansen smart-money inflows, which are shown to the API key owner only." />
            : <SectorTreemap f={d.flows} />}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card
          id="peers"
          className="lg:col-span-2"
          title={peersTitle(d.chain, d.peers)}
          sub="DEX volume indexed to 100 over the prior 7 days. Every other chain in gray."
        >
          <PeersSlope chain={d.chain} p={d.peers} />
        </Card>
        <Card
          id="tape"
          className="lg:col-span-3"
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
