import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card } from '@/components/Card';
import { StatStrip } from '@/components/StatStrip';
import { TimeAgo } from '@/components/TimeAgo';
import { ChainLogo } from '@/components/Logo';
import { NetFlowBars } from '@/components/sectors/NetFlowBars';
import { sectorDetail, type SectorWindowReading } from '@/server/sectors/detail';
import { displayMode, viewOf } from '@/server/mode';
import { chainName, num, pct, spanOf, usd } from '@/lib/viz/format';
import type { SectorMover } from '@/lib/models/sector-flows';
import { Go } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

const BAND = { high: 'Accumulation', neutral: 'Neutral', low: 'Distribution' } as const;
const WINDOW_NAME = { '1h': 'Last hour', '24h': 'Last 24 hours', '7d': 'Last 7 days' } as const;

export async function generateMetadata({ params }: { params: Promise<{ sector: string }> }): Promise<Metadata> {
  return { title: `${decodeURIComponent((await params).sector)}, Sectors · Peregrine` };
}

function MoverList({ title, rows, tone }: { title: string; rows: SectorMover[]; tone: 'in' | 'out' }) {
  return (
    <div className="min-w-0">
      <h4 className="mb-1.5 text-[12px] font-semibold text-ink-muted">{title}</h4>
      {rows.length ? (
        <ol className="divide-y divide-[var(--hair)]">
          {rows.map((m) => (
            <li key={`${m.chain}:${m.address}`}>
              <Link prefetch={false} href={`/token/${m.chain}/${encodeURIComponent(m.address)}`} className="flex min-h-[40px] items-center gap-2 py-1.5 text-[13px] hover:text-ink">
                <ChainLogo chain={m.chain} size={16} labelled />
                <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                  {m.symbol ?? `${m.address.slice(0, 6)}…`} <span className="font-normal text-ink-muted">{chainName(m.chain)}</span>
                </span>
                <span className="num shrink-0 whitespace-nowrap text-right font-semibold" style={{ color: tone === 'in' ? 'var(--mint)' : 'var(--flare)' }}>{usd(m.netFlowUsd, { signed: true })}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-2 text-[12.5px] text-ink-muted">None in this window.</p>
      )}
    </div>
  );
}

function WindowCard({ w }: { w: SectorWindowReading }) {
  return (
    <section aria-label={WINDOW_NAME[w.window]} className="inset-well p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-bold text-ink">{WINDOW_NAME[w.window]}</h3>
        <span className="text-[11.5px] text-ink-muted"><TimeAgo ts={w.at} /></span>
      </div>
      <p className="num mt-2 text-[22px] font-bold tracking-[-0.02em]" style={{ color: w.netFlowUsd >= 0 ? 'var(--mint)' : 'var(--flare)' }}>
        {usd(w.netFlowUsd, { signed: true })}
      </p>
      <p className="text-[12.5px] text-ink-2">
        net on {usd(w.volumeUsd)} volume · {pct(w.volumeUsd ? w.netFlowUsd / w.volumeUsd : 0, 1)} · {w.tokens} tokens
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1 3xl:grid-cols-2">
        <MoverList title="Largest net buying" rows={w.inflows} tone="in" />
        <MoverList title="Largest net selling" rows={w.outflows} tone="out" />
      </div>
    </section>
  );
}

export default async function SectorPage({ params }: { params: Promise<{ sector: string }> }) {
  const name = decodeURIComponent((await params).sector);
  const d = sectorDetail(name, viewOf(await displayMode()));
  if (!d) notFound();
  const r = d.reading;
  const share = r.netFlow24hUsd != null && r.volume24hUsd ? r.netFlow24hUsd / r.volume24hUsd : null;
  const members = d.membersByChain.reduce((a, c) => a + c.tokens, 0);

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-[12.5px] text-ink-muted">
        <Link prefetch={false} href="/sectors" className="hover:text-ink">Sectors</Link> <span className="text-ink-muted"><Go /></span> <span className="text-ink-2">{name}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="hero-seq">
          <h1 className="t-title text-ink">{name}</h1>
          <p className="mt-1.5 text-[13px] text-ink-2">
            {BAND[r.band]} · #{d.rank} of {d.of} sectors by Flow Index · {d.source === 'smart-money' ? 'smart-money flows' : 'all-trader flows'}
          </p>
        </div>
      </div>

      <StatStrip
        className="rise"
        stats={[
          { label: 'Flow Index', value: `${num(r.pressure, 0)} / 100`, note: r.crossSectional ? 'vs other sectors' : 'vs its own 7 days' },
          { label: 'Net flow, 24h', value: r.netFlow24hUsd != null ? usd(r.netFlow24hUsd, { signed: true }) : 'n/a', tone: (r.netFlow24hUsd ?? 0) >= 0 ? 'in' : 'out' },
          { label: 'Volume, 24h', value: r.volume24hUsd != null ? usd(r.volume24hUsd) : 'n/a' },
          { label: 'Net / volume', value: share != null ? pct(share, 1) : 'n/a' },
          { label: 'Tokens tracked', value: members.toLocaleString('en-US'), note: `${d.membersByChain.length} chains` },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card id="history" title={`24h net flow, last ${spanOf(d.history.map((x) => x.t), 7)}`} sub="One bar per scan · up is net buying · hover a bar for its value" className="xl:col-span-2">
          <NetFlowBars points={d.history} label={`${name} 24h net flow`} />
        </Card>
        <Card id="members" title="Where its tokens trade" sub="Tokens in this sector per chain">
          <ul className="stagger grid grid-cols-2 gap-1.5">
            {d.membersByChain.map((c) => (
              <li key={c.chain}>
                <Link prefetch={false} href={`/chain/${c.chain}`} className="inset-well flex min-h-[40px] items-center gap-2 px-3 py-2 text-[13px]">
                  <ChainLogo chain={c.chain} size={16} />
                  <span className="min-w-0 flex-1 truncate text-ink">{chainName(c.chain)}</span>
                  <span className="num text-ink-2">{c.tokens}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card id="movers" title="What moved it" sub="Tokens with the largest net flow in each window · select one for its page">
        <div className="stagger grid gap-4 xl:grid-cols-3">
          {d.windows.map((w) => <WindowCard key={w.window} w={w} />)}
        </div>
      </Card>
    </div>
  );
}
