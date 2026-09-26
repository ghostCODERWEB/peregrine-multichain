import Link from 'next/link';
import { MiniBars, MiniLines } from '@/components/charts/Mini';
import { marketPulse, type PulseItem } from '@/server/pulse';
import { cachedBrief } from '@/server/pulse-brief';
import type { DisplayMode } from '@/server/mode';
import { PulseBrief } from './PulseBrief';

const TONE: Record<PulseItem['tone'], string> = { up: 'var(--mint)', down: 'var(--flare)', alert: 'var(--amber)', flat: 'var(--signal)' };

/** Market Pulse: what is happening now, as short derived statements, each with its series and a link to the records. */
export function MarketPulse({ mode }: { mode: DisplayMode }) {
  const items = marketPulse(mode);
  if (!items.length) return null;
  return (
    <section aria-labelledby="pulse-title" className="material p-3.5 sm:p-4 xl:col-span-12">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pulse-title" className="flex items-center gap-2 text-[13.5px] font-bold text-ink">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--mint)] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--mint)]" /></span>
          Market Pulse
        </h2>
        <span className="num text-[11px] text-ink-muted">Last 24h · {items.length} signals</span>
      </div>
      <div className={`grid gap-3 ${mode === 'owner' ? 'xl:grid-cols-[minmax(0,1fr)_320px] 3xl:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
        <ol className="stagger grid gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] md:grid-cols-2 md:[&>li:last-child:nth-child(odd)]:col-span-2 2xl:grid-cols-3 2xl:[&>li:last-child:nth-child(odd)]:col-span-1 2xl:[&>li:last-child:nth-child(3n+1)]:col-span-3 2xl:[&>li:last-child:nth-child(3n+2)]:col-span-2">
          {items.map((it) => (
            <li key={it.id} className="bg-[var(--surface-1)]">
              <Link href={it.href} data-analyze={JSON.stringify({ kind: 'card', label: it.kind, href: it.href, signal: it.text, detail: it.detail, series: it.spark?.values })} className="group grid h-full grid-cols-[minmax(0,1fr)_84px] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]">
                <span className="min-w-0">
                  <span className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.07em]" style={{ color: TONE[it.tone] }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONE[it.tone] }} />{it.kind}
                  </span>
                  <span className="block text-[12.5px] font-semibold leading-snug text-ink group-hover:underline group-hover:decoration-[var(--hair-2)] group-hover:underline-offset-2">{it.text}</span>
                  <span className="num mt-0.5 block truncate text-[11px] text-ink-muted">{it.detail}</span>
                </span>
                <span className="block">
                  {it.spark?.type === 'bars' && <MiniBars height={30} values={it.spark.values} label={`${it.kind} series`} />}
                  {it.spark?.type === 'line' && <MiniLines height={30} min={it.spark.min} max={it.spark.max} baseline={it.spark.baseline} label={`${it.kind} series`} series={[{ values: it.spark.values, color: TONE[it.tone], area: true }]} />}
                </span>
              </Link>
            </li>
          ))}
        </ol>
        {mode === 'owner' && <div className="order-first flex xl:order-none"><PulseBrief initial={cachedBrief()} /></div>}
      </div>
    </section>
  );
}
