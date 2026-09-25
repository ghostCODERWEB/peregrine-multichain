import Link from 'next/link';
import type { Metadata } from 'next';
import { Card, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { TimeAgo } from '@/components/TimeAgo';
import { SectorSpark } from '@/components/sectors/SectorSpark';
import { FilterBox } from '@/components/FilterBox';
import { PageTitle } from '@/components/PageTitle';
import { StatStrip } from '@/components/StatStrip';
import { sectorHref } from '@/server/sectors/detail';
import { sectorWeather, MIN_HISTORY, type SectorReading } from '@/server/sectors/weather';
import { displayMode, viewOf } from '@/server/mode';
import { pressureClass, fillVar, onFillVar, PRESSURE_LEGEND } from '@/lib/viz/scales';
import { chainName, num, pct, usd } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sectors — Peregrine' };

const BAND_WORD = { high: 'Accumulation', neutral: 'Neutral', low: 'Distribution' } as const;

function ScaleLegend() {
  return (
    <div className="hidden items-center gap-2 text-[11px] text-ink-muted sm:flex">
      <span>Outflow</span>
      <span className="flex overflow-hidden rounded-sm" aria-hidden>
        {PRESSURE_LEGEND.map((s) => <span key={s.cls} className="h-2.5 w-7" style={{ background: fillVar(s.cls) }} title={`Flow Index ${s.label}`} />)}
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
    <li id={encodeURIComponent(s.sector)} data-group={BAND_WORD[s.band]}
      data-search={[s.sector, BAND_WORD[s.band], ...s.top.inflows.map((m) => m.symbol ?? ''), ...s.top.outflows.map((m) => m.symbol ?? '')].join(' ')}
      className="scroll-mt-20 material p-4 target:ring-2 target:ring-ring">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[14px] font-bold leading-snug text-ink">
          <Link href={sectorHref(s.sector)} className="hover:underline hover:underline-offset-2">{s.sector}</Link>
        </h3>
        <span className="num shrink-0 rounded-md px-1.5 py-0.5 text-[13px] font-bold" style={{ background: fillVar(cls), color: onFillVar(cls) }}
          title={`Flow Index ${num(s.pressure, 1)} of 100, ${s.crossSectional ? `ranked against other sectors until it has ${MIN_HISTORY} snapshots of its own (${s.historyPoints} so far)` : 'against its own last 7 days'}`}>
          {num(s.pressure, 0)}
        </span>
      </div>
      <p className="num mt-3 text-[20px] font-bold tracking-[-0.02em]" style={{ color: (s.netFlow24hUsd ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' }}>
        {s.netFlow24hUsd != null ? usd(s.netFlow24hUsd, { signed: true }) : '—'}
      </p>
      <p className="num text-[12px] text-ink-2">
        net in 24h{share != null ? ` · ${pct(share, 1)} of ${usd(s.volume24hUsd)}` : ''}{s.tokens != null ? ` · ${s.tokens} tokens` : ''}
      </p>
      <SectorSpark points={s.spark} label={`${s.sector}: 24h net flow as a share of volume over time`} />
      {(s.top.inflows.length > 0 || s.top.outflows.length > 0) && (
        <details className="mt-2 text-[11.5px]">
          <summary className="cursor-pointer font-bold text-brand">Top tokens in and out ({s.top.inflows.length + s.top.outflows.length})</summary>
          {s.tokens != null && <p className="mt-1 text-ink-muted">{s.tokens} tokens tracked in this sector</p>}
        <div className="mt-2 grid grid-cols-2 gap-2">
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
        </details>
      )}
      <Link href={sectorHref(s.sector)} className="mt-3 inline-block text-[12.5px] font-bold text-brand">Open sector <span aria-hidden>→</span></Link>
    </li>
  );
}

export default async function SectorsPage() {
  const mode = await displayMode();
  const w = sectorWeather(viewOf(mode));
  // Leaders among sectors with enough tokens to mean something. Flow Index is
  // relative, so the top inflow is the highest-index sector that actually took
  // in money, not merely the one losing it slowest.
  const solid = w.sectors.filter((x) => (x.tokens ?? 0) >= 5);
  const inflow = solid.filter((x) => (x.netFlow24hUsd ?? 0) > 0).sort((a, b) => b.pressure - a.pressure)[0];
  const outflow = solid.filter((x) => (x.netFlow24hUsd ?? 0) < 0).sort((a, b) => a.pressure - b.pressure)[0];
  const net = w.sectors.reduce((a, x) => a + (x.netFlow24hUsd ?? 0), 0);
  const count = (band: SectorReading['band']) => w.sectors.filter((x) => x.band === band).length;

  return (
    <div className="space-y-5">
      <PageTitle title="Sectors" pill={<>{w.source === 'smart-money' ? 'Smart money' : 'All traders'} · 24h{w.at ? <> · <TimeAgo ts={w.at} /></> : null}</>} />
      {w.sectors.length > 0 && (
        <StatStrip
          className="rise"
          stats={[
            { label: 'Top inflow', value: inflow ? usd(inflow.netFlow24hUsd, { signed: true }) : '—', note: inflow?.sector, href: inflow && sectorHref(inflow.sector), tone: 'in' },
            { label: 'Top outflow', value: outflow ? usd(outflow.netFlow24hUsd, { signed: true }) : '—', note: outflow?.sector, href: outflow && sectorHref(outflow.sector), tone: 'out' },
            { label: 'Net across sectors', value: usd(net, { signed: true }), note: `${w.sectors.length} sectors`, tone: net >= 0 ? 'in' : 'out' },
            { label: 'Accumulating', value: count('high'), note: 'Flow Index 65+' },
            { label: 'Distributing', value: count('low'), note: 'Flow Index 35 or less' },
          ]}
        />
      )}

      <Card id="sectors" title="All sectors"
        sub={`Highest Flow Index first · ${w.membership.tokens.toLocaleString('en-US')} tokens on ${w.membership.chains.length} chains · Flow Index 50 is neutral`}
        action={w.provenance ? <InfoPopover p={w.provenance} /> : undefined}>
        {w.unavailable ? <Unavailable text={w.unavailable} /> : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterBox target="#sector-groups" label="Filter sectors" placeholder="Search sectors or tokens" groups={Object.values(BAND_WORD)} />
              <ScaleLegend />
            </div>
            <div id="sector-groups" className="mt-4 space-y-4">
              {(['high', 'neutral', 'low'] as const).map((band) => {
                const list = w.sectors.filter((x) => x.band === band);
                return list.length > 0 && (
                  <details key={band} open data-filter-group className="group">
                    <summary className="mb-3 cursor-pointer text-[14px] font-bold text-ink">{BAND_WORD[band]} <span className="font-normal text-ink-muted">· {list.length}</span></summary>
                    <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6">
                      {list.map((s) => <Tile key={s.sector} s={s} />)}
                    </ul>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
