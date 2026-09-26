import Link from 'next/link';
import { Card } from '@/components/Card';
import { AddressLink } from '@/components/entity/AddressLink';
import { MiniBars, MiniLines } from '@/components/charts/Mini';
import { RankBars } from '@/components/charts/IntelCharts';
import { InsightPanel } from '@/components/pulse/MarketPulse';
import type { PredictBoard, PmMarket } from '@/server/predict/board';
import type { PredictOverview } from '@/server/predict/overview';
import type { DisplayMode } from '@/server/mode';
import { usd } from '@/lib/viz/format';

const prob = (v: number | null) => (v == null ? 'n/a' : `${Math.round(v * 100)}%`);
const pts = (v: number | null) => (v == null ? '' : `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} pts`);
const ago = (iso: string) => { const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60_000)); return m < 60 ? `${m}m` : `${Math.round(m / 60)}h`; };

function MarketCard({ m, o }: { m: PmMarket; o: PredictOverview }) {
  const s = o.series[m.id];
  const up = (m.change1d ?? 0) >= 0;
  return (
    <li className="bg-[var(--surface-1)]">
      <Link href={`/predict/${m.id}`} data-analyze={JSON.stringify({ kind: 'market', label: m.question.slice(0, 50), href: `/predict/${m.id}`, market: { question: m.question, event: m.eventTitle, probability: m.price, change1dPts: m.change1d != null ? Math.round(m.change1d * 100) : null, volume24h: m.volume24h, volume1w: m.volume1w, openInterest: m.openInterest, liquidity: m.liquidity, traders24h: m.traders24h, endDate: m.endDate, tags: m.tags }, probability7dHourly: s?.prob.filter((_, i) => i % 3 === 0), volume7dHourly: s?.volume.filter((_, i) => i % 3 === 0) })}
        className="group flex h-full flex-col gap-2 p-3.5 transition-colors hover:bg-[var(--surface-2)]">
        <span className="flex items-center justify-between gap-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink-muted"><span className="truncate">{m.tags[0] ?? m.eventTitle ?? 'Market'}</span>{m.endDate && <span className="num shrink-0 font-semibold normal-case tracking-normal">ends {m.endDate.slice(5, 10)}</span>}</span>
        <span className="line-clamp-2 min-h-[2.6em] text-[12.5px] font-semibold leading-snug text-ink group-hover:underline group-hover:decoration-[var(--hair-2)] group-hover:underline-offset-2">{m.question}</span>
        <span className="flex items-baseline gap-2"><span className="num text-[22px] font-bold tracking-[-0.02em] text-ink">{prob(m.price)}</span><span className="num text-[12px] font-semibold" style={{ color: up ? 'var(--mint)' : 'var(--flare)' }}>{pts(m.change1d)}</span><span className="text-[11px] text-ink-muted">YES</span></span>
        {s ? (
          <span className="block space-y-0.5">
            <MiniLines height={34} min={0} max={100} baseline={50} label={`${m.question}: probability over 7 days`} series={[{ values: s.prob.map((x) => x * 100), color: up ? 'var(--mint)' : 'var(--flare)', area: true }]} />
            <MiniBars height={16} values={s.volume.map((v) => v)} label={`${m.question}: hourly volume over 7 days`} />
          </span>
        ) : null}
        <span className="num mt-auto grid grid-cols-3 gap-1 border-t border-[var(--hair)] pt-2 text-[11px]">
          <span><span className="block text-ink-muted">Vol 24h</span><span className="font-semibold text-ink">{usd(m.volume24h)}</span></span>
          <span><span className="block text-ink-muted">Liquidity</span><span className="font-semibold text-ink">{usd(m.liquidity)}</span></span>
          <span><span className="block text-ink-muted">Traders</span><span className="font-semibold text-ink">{m.traders24h?.toLocaleString('en-US') ?? 'n/a'}</span></span>
        </span>
      </Link>
    </li>
  );
}

/** The Predictions page's analytical overview: insights with a Nansen AI brief, trending markets with 7-day probability and volume, rankings and a live trade feed. */
export function PredictAnalytics({ board, o, mode }: { board: PredictBoard; o: PredictOverview; mode: DisplayMode }) {
  const byOi = [...board.markets].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0)).slice(0, 12).map((m) => ({ label: m.question.length > 42 ? `${m.question.slice(0, 40)}…` : m.question, value: m.openInterest ?? 0, href: `/predict/${m.id}`, sub: `${prob(m.price)} YES · ${usd(m.volume24h)} 24h` }));
  const cats = [...board.categories].filter((c) => c.volume24h).sort((a, b) => b.volume24h! - a.volume24h!).slice(0, 12).map((c) => ({ label: c.category, value: c.volume24h!, href: `/predict?q=${encodeURIComponent(c.category)}`, sub: `${c.heat != null ? `${c.heat.toFixed(1)}× usual pace · ` : ''}OI ${usd(c.openInterest)}` }));
  const movers = o.movers.map((m) => ({ label: m.question.length > 42 ? `${m.question.slice(0, 40)}…` : m.question, value: (m.change1d ?? 0) * 100, href: `/predict/${m.id}`, sub: `now ${prob(m.price)} · ${usd(m.volume24h)} traded` }));
  return (
    <div className="space-y-4">
      <InsightPanel id="predict-pulse" title="Prediction pulse" items={o.insights} briefKey="predict" mode={mode} />
      <section aria-labelledby="trending" className="material p-3.5 sm:p-4">
        <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="trending" className="t-section">Trending markets</h2>
          <span className="text-[11.5px] text-ink-muted">Most traded in 24h · 7-day probability and hourly volume · select for detail</span>
        </div>
        <ol className="stagger grid gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-2 xl:grid-cols-4">
          {o.trending.map((m) => <MarketCard key={m.id} m={m} o={o} />)}
        </ol>
      </section>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card id="pm-movers" title="Biggest probability movers" sub="1-day change in YES price, points · $25K+ traded">
          <RankBars rows={movers} format="pts" label="Largest one-day probability changes" />
        </Card>
        <Card id="pm-largest" title="Largest markets by open interest">
          <RankBars rows={byOi} format="abs" label="Prediction markets with the most open interest" />
        </Card>
        <Card id="pm-cat-volume" title="Volume by category, 24h" sub="Select to filter the market list">
          <RankBars rows={cats} format="abs" label="24-hour volume per prediction category" />
        </Card>
      </div>
      {o.recent.length > 0 && (
        <Card id="pm-recent" title="Recent activity" sub="Latest trades across the busiest markets">
          <div className="max-h-[420px] overflow-auto" tabIndex={0} role="region" aria-label="Recent prediction trades">
            <table data-sortable className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead className="sticky top-0 bg-[var(--surface-1)] text-[11px] uppercase tracking-wider text-ink-muted">
                <tr><th className="py-2 font-normal">Age</th><th className="font-normal">Market</th><th className="font-normal">Trade</th><th className="font-normal">Price</th><th className="font-normal">Trader</th><th className="text-right font-normal">USDC</th></tr>
              </thead>
              <tbody>
                {o.recent.map((t, i) => (
                  <tr key={i} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                    <td className="num py-1.5 text-ink-muted">{ago(t.at)}</td>
                    <td className="max-w-[360px] truncate"><Link href={`/predict/${t.marketId}`} className="text-ink hover:underline">{t.question}</Link></td>
                    <td className="font-semibold" style={{ color: t.action === 'sell' ? 'var(--flare)' : 'var(--mint)' }}>{t.action ?? 'trade'} {t.side ?? ''}</td>
                    <td className="num text-ink-2">{t.price != null ? `${Math.round(t.price * 100)}¢` : 'n/a'}</td>
                    <td>{t.trader ? <AddressLink address={t.trader} compact /> : <span className="text-ink-muted">n/a</span>}</td>
                    <td className="num text-right font-semibold text-ink">{usd(t.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
