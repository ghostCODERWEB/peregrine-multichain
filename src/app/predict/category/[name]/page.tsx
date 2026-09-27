import Link from 'next/link';
import type { Metadata } from 'next';
import { categoryMarkets, type PmMarket } from '@/server/predict/board';
import { contextScope, requestContext } from '@/server/context';
import { PageTitle } from '@/components/PageTitle';
import { StatStrip } from '@/components/StatStrip';
import { MoodWord } from '@/components/viz/MoodRing';
import { heatLabel, impliedPct } from '@/lib/models/predict';
import { num, usd } from '@/lib/viz/format';
import { Back, Go } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  return { title: `${decodeURIComponent((await params).name)} markets · Peregrine` };
}

const pts = (v: number | null) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} pts`);
const tone = (v: number | null) => ({ color: v == null ? undefined : v >= 0 ? 'var(--mint)' : 'var(--flare)' });
const daysLeft = (d: string | null) => { if (!d) return null; const t = Date.parse(d); return Number.isFinite(t) ? (t - Date.now()) / 86_400_000 : null; };
const when = (d: string | null) => { const x = daysLeft(d); return x == null ? 'n/a' : x < 1 ? `${Math.max(1, Math.round(x * 24))}h` : `${Math.round(x)}d`; };

function Bars({ rows, value, fmt, label }: { rows: PmMarket[]; value: (m: PmMarket) => number; fmt: (m: PmMarket) => string; label: string }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <ol className="space-y-1.5" aria-label={label}>
      {rows.map((m) => (
        <li key={m.id}>
          <Link prefetch={false} href={`/predict/${encodeURIComponent(m.id)}`} className="group grid grid-cols-[minmax(0,1fr)_minmax(80px,32%)_76px] items-center gap-3 text-[12.5px]">
            <span className="truncate text-ink group-hover:underline">{m.question}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full bg-[var(--mint)]" style={{ width: `${(value(m) / max) * 100}%` }} /></span>
            <span className="num text-right text-ink-2">{fmt(m)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** One prediction category: its pace, where the money is, what repriced, what closes soon, and every active market. */
export default async function CategoryPage({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const ctx = await requestContext();
  const { category: c, markets, unavailable } = await contextScope.run(ctx, () => categoryMarkets(name));
  const title = c?.category ?? name;
  const byVol = [...markets].sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0));
  const movers = markets.filter((m) => m.change1d != null && (m.volume24h ?? 0) >= 10_000 && (m.price ?? 0) > 0.02 && (m.price ?? 1) < 0.98).sort((a, b) => Math.abs(b.change1d!) - Math.abs(a.change1d!)).slice(0, 8);
  const closing = markets.filter((m) => { const d = daysLeft(m.endDate); return d != null && d > 0 && d <= 7; }).sort((a, b) => Date.parse(a.endDate!) - Date.parse(b.endDate!)).slice(0, 8);
  const buckets = Array.from({ length: 10 }, (_, i) => markets.filter((m) => m.price != null && Math.min(9, Math.floor(m.price * 10)) === i).length);
  const maxB = Math.max(1, ...buckets);
  const vol = markets.reduce((s, m) => s + (m.volume24h ?? 0), 0);
  const oi = markets.reduce((s, m) => s + (m.openInterest ?? 0), 0);
  const top = byVol[0];

  return (
    <div className="space-y-5">
      <Link prefetch={false} href="/predict" className="text-[12.5px] text-ink-2 hover:text-ink"><Back /> Predictions</Link>
      <PageTitle title={title} pill={c?.weather != null ? <MoodWord mood={c.weather >= 70 ? 'hot' : c.weather <= 30 ? 'quiet' : 'normal'} word={heatLabel(c.weather)} className="text-[13px]" /> : 'Polymarket category'} />
      {unavailable && !markets.length ? <p className="material p-5 text-[13px] text-ink-2">{unavailable}</p> : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
          <StatStrip className="xl:col-span-12" stats={[
            { label: 'Volume, 24h', value: usd(c?.volume24h ?? vol), note: c?.heat != null ? `${num(c.heat, 1)}× its daily pace this week` : undefined },
            { label: 'Open interest', value: usd(c?.openInterest ?? oi), note: 'across the category' },
            { label: 'Active markets', value: (c?.activeMarkets ?? markets.length).toLocaleString('en-US'), note: `${markets.length} listed here` },
            { label: 'Traders, 24h', value: (c?.traders24h ?? 0).toLocaleString('en-US'), note: 'unique wallets' },
            { label: 'Busiest market', value: top ? usd(top.volume24h) : 'n/a', note: top?.question, href: top && `/predict/${encodeURIComponent(top.id)}` },
          ]} />

          <section className="material p-4 sm:p-5 xl:col-span-7">
            <h2 className="t-section mb-1">Where the money is</h2>
            <p className="mb-3 text-[12px] text-ink-muted">Top markets by 24h volume</p>
            <Bars rows={byVol.slice(0, 10)} value={(m) => m.volume24h ?? 0} fmt={(m) => usd(m.volume24h)} label="Markets by 24h volume" />
          </section>

          <section className="material p-4 sm:p-5 xl:col-span-5">
            <h2 className="t-section mb-1">How the category is priced</h2>
            <p className="mb-3 text-[12px] text-ink-muted">Markets by YES probability</p>
            <div className="flex h-[150px] items-end gap-1.5" role="img" aria-label="Number of markets in each 10-point probability band">
              {buckets.map((n, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="num text-[10.5px] text-ink-muted">{n || ''}</span>
                  <span className="w-full rounded-t-[4px]" style={{ height: `${(n / maxB) * 100}%`, minHeight: n ? 3 : 0, background: i >= 5 ? 'var(--mint)' : 'color-mix(in srgb, var(--mint) 45%, var(--surface-2))' }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10.5px] text-ink-muted"><span>0%</span><span>50%</span><span>100%</span></div>
          </section>

          <section className="material p-4 sm:p-5 xl:col-span-6">
            <h2 className="t-section mb-1">Biggest repricing, 24h</h2>
            <p className="mb-3 text-[12px] text-ink-muted">YES price change · $10K+ traded, priced 2% to 98%</p>
            {movers.length ? (
              <ol className="divide-y divide-[var(--hair)]">
                {movers.map((m) => (
                  <li key={m.id}><Link prefetch={false} href={`/predict/${encodeURIComponent(m.id)}`} className="grid grid-cols-[minmax(0,1fr)_56px_72px] items-center gap-3 py-2 text-[12.5px] hover:underline">
                    <span className="truncate text-ink">{m.question}</span><span className="num text-right text-ink-2">{impliedPct(m.price)}</span><span className="num text-right font-semibold" style={tone(m.change1d)}>{pts(m.change1d)}</span>
                  </Link></li>
                ))}
              </ol>
            ) : <p className="text-[12.5px] text-ink-muted">No market moved on meaningful volume today.</p>}
          </section>

          <section className="material p-4 sm:p-5 xl:col-span-6">
            <h2 className="t-section mb-1">Closing within 7 days</h2>
            <p className="mb-3 text-[12px] text-ink-muted">Soonest first</p>
            {closing.length ? (
              <ol className="divide-y divide-[var(--hair)]">
                {closing.map((m) => (
                  <li key={m.id}><Link prefetch={false} href={`/predict/${encodeURIComponent(m.id)}`} className="grid grid-cols-[minmax(0,1fr)_56px_72px_44px] items-center gap-3 py-2 text-[12.5px] hover:underline">
                    <span className="truncate text-ink">{m.question}</span><span className="num text-right text-ink-2">{impliedPct(m.price)}</span><span className="num text-right text-ink-2">{usd(m.volume24h)}</span><span className="num text-right text-ink-muted">{when(m.endDate)}</span>
                  </Link></li>
                ))}
              </ol>
            ) : <p className="text-[12.5px] text-ink-muted">Nothing in this category closes within a week.</p>}
          </section>

          <section aria-labelledby="all-markets" className="material p-4 sm:p-5 xl:col-span-12">
            <h2 id="all-markets" className="t-section mb-2">All active markets · {markets.length}</h2>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="All markets in this category">
              <table data-sortable className="w-full min-w-[900px] text-left text-[12.5px]">
                <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 font-normal">Market</th><th className="text-right font-normal">YES</th><th className="text-right font-normal">24h change</th><th className="text-right font-normal">Volume, 24h</th><th className="text-right font-normal">Open interest</th><th className="text-right font-normal">Liquidity</th><th className="text-right font-normal">Traders</th><th className="text-right font-normal">Ends in</th><th className="text-right font-normal"><span className="sr-only">Open</span></th></tr></thead>
                <tbody>
                  {byVol.map((m) => (
                    <tr key={m.id} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                      <td className="max-w-[420px] py-2 pr-3"><Link prefetch={false} href={`/predict/${encodeURIComponent(m.id)}`} className="block truncate font-semibold text-ink hover:underline" title={m.question}>{m.question}</Link>{m.eventTitle && m.eventTitle !== m.question && <span className="block truncate text-[11px] text-ink-muted">{m.eventTitle}</span>}</td>
                      <td className="num text-right text-ink">{impliedPct(m.price)}</td>
                      <td className="num text-right" style={tone(m.change1d)}>{pts(m.change1d)}</td>
                      <td className="num text-right text-ink">{usd(m.volume24h)}</td>
                      <td className="num text-right text-ink-2">{usd(m.openInterest)}</td>
                      <td className="num text-right text-ink-2">{usd(m.liquidity)}</td>
                      <td className="num text-right text-ink-2">{m.traders24h?.toLocaleString('en-US') ?? 'n/a'}</td>
                      <td className="num text-right text-ink-muted">{when(m.endDate)}</td>
                      <td className="text-right"><Link prefetch={false} href={`/predict/${encodeURIComponent(m.id)}`} className="text-[11.5px] font-semibold text-[var(--mint)]" aria-label={`Open ${m.question}`}>Open <Go /></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
