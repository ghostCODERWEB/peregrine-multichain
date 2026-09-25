'use client';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, TriangleAlert, Radio, Shuffle, Activity } from 'lucide-react';
import { ChainLogo, TokenLogo } from '@/components/Logo';
import type { WeatherBulletin } from '@/server/weather/bulletin';
import { chainName, num } from '@/lib/viz/format';
import { pressureClass, fillVar } from '@/lib/viz/scales';

type Chain = WeatherBulletin['chains'][number];

/** A tiny line of a chain's blended CPI over 7 days (50 = neutral). */
function Spark({ series, color }: { series: Chain['series']; color: string }) {
  if (series.length < 2) return null;
  const W = 96, H = 26, t0 = series[0].t, t1 = series.at(-1)!.t;
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * W;
  const y = (v: number) => H - (v / 100) * H;
  const d = series.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.cpi).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[26px] w-[96px]" aria-hidden preserveAspectRatio="none">
      <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="var(--axis)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Tile({ icon, label, children, href, foot, tone = 'brand' }: { icon: React.ReactNode; label: string; children: React.ReactNode; href?: string; foot?: React.ReactNode; tone?: 'brand' | 'in' | 'out' | 'risk' | 'cyan' }) {
  const body = (
    <div className={`metric-card metric-${tone} glass liquid-panel rise flex h-full flex-col rounded-2xl p-3.5`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-muted">{icon}{label}</div>
      <div className="mt-2 flex-1">{children}</div>
      {foot && <div className="mt-2 text-[11.5px] text-ink-muted">{foot}</div>}
    </div>
  );
  return href ? <Link href={href} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">{body}</Link> : body;
}

/**
 * The top of the weather map: the six numbers a visitor needs before the
 * map — how many chains read, where money is arriving and leaving, how
 * many rotations and storms there are, and how much history backs it.
 */
export function PulseBand({ data }: { data: WeatherBulletin }) {
  const scored = data.chains.filter((c) => c.cpi != null);
  const sorted = [...scored].sort((a, b) => (b.cpi ?? 0) - (a.cpi ?? 0));
  const top = sorted[0], bottom = sorted.at(-1);
  const storms = data.storms.filter((s) => s.band === 'watch' || s.band === 'warning');
  const reading = (c: Chain | undefined, dir: 'in' | 'out') => c && (
    <div className="flex items-end justify-between gap-2">
      <div>
        <div className="flex items-center gap-1.5 text-[15px] font-medium text-ink"><ChainLogo chain={c.chain} size={16} />{chainName(c.chain)}</div>
        <div className="num text-[26px] font-semibold leading-none" style={{ color: fillVar(pressureClass(c.cpi ?? 50)) }}>
          {num(c.cpi, 0)}
          {c.trend6h != null && Math.abs(c.trend6h) >= 1 && (
            <span className="ml-1 align-middle text-[12px] font-normal text-ink-muted">{c.trend6h > 0 ? '▲' : '▼'} {num(Math.abs(c.trend6h), 0)} in 6h</span>
          )}
        </div>
      </div>
      <Spark series={c.series} color={dir === 'in' ? 'var(--in-3)' : 'var(--out-3)'} />
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Tile icon={<Radio className="h-3.5 w-3.5" />} label="Live chains" tone="brand" foot={`of ${data.chains.length} chains Nansen lists`}>
        <div className="num text-[26px] font-semibold leading-none text-ink">{scored.length}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent" aria-hidden>
          <div className="h-full rounded-full bg-brand" style={{ width: `${(scored.length / Math.max(1, data.chains.length)) * 100}%` }} />
        </div>
      </Tile>
      <Tile icon={<ArrowUpRight className="h-3.5 w-3.5" />} label="Top inflow" tone="in" href={top ? `/chain/${top.chain}` : undefined} foot="Flow Index · 50 = neutral">
        {reading(top, 'in')}
      </Tile>
      <Tile icon={<ArrowDownRight className="h-3.5 w-3.5" />} label="Top outflow" tone="out" href={bottom ? `/chain/${bottom.chain}` : undefined} foot="lowest flow right now">
        {reading(bottom, 'out')}
      </Tile>
      <Tile icon={<Shuffle className="h-3.5 w-3.5" />} label="Capital rotations" tone="cyan" foot={data.mode === 'public' ? 'shown to the key owner' : 'smart money moving between chains, 24h'}>
        <div className="num text-[26px] font-semibold leading-none text-ink">{data.mode === 'public' ? '—' : data.fronts.length}</div>
        {data.mode !== 'public' && data.fronts[0] && (
          <div className="mt-1.5 flex items-center gap-1 truncate text-[12px] text-ink-2"><ChainLogo chain={data.fronts[0].from} size={12} />{chainName(data.fronts[0].from)} → <ChainLogo chain={data.fronts[0].to} size={12} />{chainName(data.fronts[0].to)}</div>
        )}
      </Tile>
      <Tile icon={<TriangleAlert className="h-3.5 w-3.5" />} label="Risk alerts" tone="risk" href="/#storms-title" foot="tokens at High or Critical">
        <div className="num text-[26px] font-semibold leading-none" style={{ color: storms.length ? 'var(--storm-3)' : 'var(--ink-1)' }}>{storms.length}</div>
        {storms[0] && <div className="mt-1.5 flex items-center gap-1.5 truncate text-[12px] text-ink-2"><TokenLogo symbol={storms[0].symbol} logo={storms[0].logo} size={14} />{storms[0].symbol ?? 'token'} · <ChainLogo chain={storms[0].chain} size={12} />{chainName(storms[0].chain)} · {num(storms[0].score, 0)}</div>}
      </Tile>
      <Tile icon={<Activity className="h-3.5 w-3.5" />} label="Evidence" tone="brand" foot={data.mode === 'public' ? 'scanner runs, all-trader flow' : 'scanner runs · smart-money trades'}>
        <div className="num text-[26px] font-semibold leading-none text-ink">{data.scan.runs.toLocaleString('en-US')}</div>
        <div className="mt-1.5 text-[12px] text-ink-2">{data.scan.trades.toLocaleString('en-US')} trades recorded</div>
      </Tile>
    </div>
  );
}
