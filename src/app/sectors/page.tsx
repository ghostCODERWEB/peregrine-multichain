import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { TimeAgo } from '@/components/TimeAgo';
import { SectorSpark } from '@/components/sectors/SectorSpark';
import { sectorWeather, MIN_HISTORY, type SectorReading } from '@/server/sectors/weather';
import { displayMode, viewOf } from '@/server/mode';
import { pressureClass, fillVar, onFillVar, PRESSURE_LEGEND } from '@/lib/viz/scales';
import { chainName, num, pct, usd } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sectors — Peregrine' };

const BAND_WORD = { high: 'High pressure', neutral: 'Neutral', low: 'Low pressure' } as const;

function ScaleLegend() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-ink-muted">
      <span>Outflow</span>
      <span className="flex overflow-hidden rounded-sm" aria-hidden>
        {PRESSURE_LEGEND.map((s) => <span key={s.cls} className="h-2.5 w-7" style={{ background: fillVar(s.cls) }} title={`pressure ${s.label}`} />)}
      </span>
      <span>Inflow</span>
      <span className="sr-only">Sector pressure scale: {PRESSURE_LEGEND.map((s) => s.label).join(', ')}; below 35 is low pressure, above 65 high.</span>
    </div>
  );
}

function Tile({ s }: { s: SectorReading }) {
  const cls = pressureClass(s.pressure);
  const share = s.netFlow24hUsd != null && s.volume24hUsd ? s.netFlow24hUsd / s.volume24hUsd : null;
  return (
    <li id={encodeURIComponent(s.sector)} className="scroll-mt-20 glass rounded-2xl p-3 target:ring-2 target:ring-ring">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[13.5px] font-medium leading-snug text-ink">{s.sector}</h3>
        <span className="num rounded px-1.5 py-0.5 text-[13px] font-semibold" style={{ background: fillVar(cls), color: onFillVar(cls) }} title={`Sector pressure ${num(s.pressure, 1)} of 100`}>
          {num(s.pressure, 0)}
        </span>
      </div>
      <p className="mt-0.5 text-[11.5px] text-ink-muted">
        {BAND_WORD[s.band]} · {s.crossSectional ? `vs other sectors now (${s.historyPoints}/${MIN_HISTORY} own snapshots)` : 'vs its own 7 days'}
      </p>
      <p className="num mt-2 text-[12.5px] text-ink">
        {s.netFlow24hUsd != null ? usd(s.netFlow24hUsd, { signed: true }) : '—'} <span className="text-ink-muted">24h net{share != null ? ` · ${pct(share, 1)} of ${usd(s.volume24hUsd)} volume` : ''}{s.tokens != null ? ` · ${s.tokens} tokens` : ''}</span>
      </p>
      <SectorSpark points={s.spark} label={`${s.sector}: 24h net flow as a share of volume over time`} />
      {(s.top.inflows.length > 0 || s.top.outflows.length > 0) && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11.5px]">
          {([['In', s.top.inflows], ['Out', s.top.outflows]] as const).map(([k, movers]) => (
            <ul key={k} className="min-w-0 space-y-0.5">
              <li className="text-[10.5px] uppercase tracking-wider text-ink-muted">{k}</li>
              {movers.map((m) => (
                <li key={`${m.chain}:${m.address}`} className="flex min-w-0 justify-between gap-1">
                  <Link href={`/token/${m.chain}/${encodeURIComponent(m.address)}`} className="truncate text-ink-2 hover:text-ink hover:underline" title={`${m.symbol ?? m.address} on ${chainName(m.chain)}`}>
                    {m.symbol ?? '?'}{movers.filter((o) => o.symbol === m.symbol).length > 1 && <span className="text-ink-muted"> · {chainName(m.chain)}</span>}
                  </Link>
                  <span className="num shrink-0 text-ink-muted">{usd(m.netFlowUsd, { signed: true })}</span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </li>
  );
}

export default async function SectorsPage() {
  const mode = await displayMode();
  const w = sectorWeather(viewOf(mode));
  const who = w.source === 'smart-money' ? { name: 'Smart money', are: 'is', lean: 'leans' } : { name: 'All traders', are: 'are', lean: 'lean' };
  // The headline names real flows: the highest-pressure sector that actually
  // took in money over 24h, and the lowest that lost it, among sectors with
  // enough tokens to mean something. (Pressure is relative, so a sector can
  // score high while still losing money more slowly than the rest.)
  const solid = w.sectors.filter((x) => (x.tokens ?? 0) >= 5);
  const inflow = solid.filter((x) => (x.netFlow24hUsd ?? 0) > 0).sort((a, b) => b.pressure - a.pressure)[0];
  const outflow = solid.filter((x) => (x.netFlow24hUsd ?? 0) < 0).sort((a, b) => a.pressure - b.pressure)[0];
  const title = !w.sectors.length ? 'Sector weather'
    : inflow && outflow ? `${who.name} ${who.are} rotating into ${inflow.sector} (${usd(inflow.netFlow24hUsd, { signed: true })}); ${outflow.sector} is being sold (${usd(outflow.netFlow24hUsd, { signed: true })})`
    : inflow ? `${who.name} ${who.are} rotating into ${inflow.sector} (${usd(inflow.netFlow24hUsd, { signed: true })} in 24h)`
    : outflow ? `No sector took in net ${w.source === 'smart-money' ? 'smart money' : 'flow'} in 24h; ${outflow.sector} lost the most (${usd(outflow.netFlow24hUsd, { signed: true })})`
    : `${w.sectors.length} sectors, flat in 24h`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          Pressure per Nansen sector, built like the chain pressure index: net flow as a share of volume, compared with the sector&apos;s own last 7 days
          (or with the other sectors, until it has {MIN_HISTORY} snapshots of its own), on a 0–100 scale where 50 is normal.{' '}
          {w.source === 'market-flow' ? 'Public view: all-trader flows. Smart-money sector flows are shown to the API key owner only.' : 'Owner view: smart-money flows (Nansen labels), with all-trader volume as the denominator.'}
        </p>
      </div>

      <Card id="sectors" title={w.sectors.length ? `${w.sectors.length} sectors, hottest first` : 'Sectors'}
        sub={w.at ? <>Updated <TimeAgo ts={w.at} /> by the scanner. Sector membership: {w.membership.tokens.toLocaleString('en-US')} tokens on {w.membership.chains.map(chainName).join(', ')}.</> : undefined}
        action={w.provenance ? <InfoPopover p={w.provenance} /> : undefined}>
        {w.unavailable ? <Unavailable text={w.unavailable} /> : (
          <>
            <ScaleLegend />
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {w.sectors.map((s) => <Tile key={s.sector} s={s} />)}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
