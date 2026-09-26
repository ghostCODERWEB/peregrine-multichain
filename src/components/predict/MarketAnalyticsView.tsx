import Link from 'next/link';
import { AddressLink } from '@/components/entity/AddressLink';
import { InsightPanel } from '@/components/pulse/MarketPulse';
import type { MarketAnalytics } from '@/server/predict/market';
import type { DisplayMode } from '@/server/mode';
import { pct, usd } from '@/lib/viz/format';

const prob = (v: number | null | undefined) => (v == null ? 'n/a' : `${Math.round(v * 100)}%`);
const pts = (v: number | null | undefined) => (v == null ? 'n/a' : `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v * 100))} pts`);
const tone = (v: number | null | undefined) => ({ color: (v ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' });

function Split({ a, b, labelA, labelB }: { a: number; b: number; labelA: string; labelB: string }) {
  const t = a + b;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--hair)]"><span style={{ width: `${t ? (a / t) * 100 : 50}%`, background: 'var(--mint)' }} /><span className="flex-1" style={{ background: 'var(--flare)' }} /></div>
      <div className="num mt-1 flex justify-between text-[11.5px] text-ink-2"><span>{labelA} {usd(a)} · {pct(t ? a / t : null, 0)}</span><span>{labelB} {usd(b)}</span></div>
    </div>
  );
}

/** One market's dedicated analytics: insights with a Nansen AI brief, statistics, flow, top traders and related markets. */
export function MarketAnalyticsView({ id, a, mode }: { id: string; a: MarketAnalytics; mode: DisplayMode }) {
  const s = a.stats;
  const tiles: Array<[string, string, string?, number?]> = [
    ['7-day change', pts(s.change7d), `24h ${pts(s.change24h)}`, s.change7d ?? undefined],
    ['7-day range', s.low7d != null ? `${prob(s.low7d)} to ${prob(s.high7d)}` : 'n/a', s.high7d != null && s.low7d != null ? `${Math.round((s.high7d - s.low7d) * 100)} pts wide` : undefined],
    ['Hourly volatility', s.volatility != null ? `±${(s.volatility * 100).toFixed(1)} pts` : 'n/a', 'typical move per hour'],
    ['Volume, 7 days', usd(s.volume7d), s.avgDailyVolume != null ? `${usd(s.avgDailyVolume)} a day` : undefined],
    ['Book imbalance', a.book.imbalance != null ? `${a.book.imbalance >= 0 ? '+' : '−'}${Math.abs(Math.round(a.book.imbalance * 100))}%` : 'n/a', `bids ${usd(a.book.bidDepth)} · asks ${usd(a.book.askDepth)}`, a.book.imbalance ?? undefined],
    ['Holder concentration', pct(a.holders.top10Share, 0), 'top 10 of the largest holders'],
    ['Recent traders', String(a.flow.takers), a.flow.avgUsd != null ? `avg trade ${usd(a.flow.avgUsd)}` : undefined],
    ['Resolves in', s.hoursToEnd == null ? 'n/a' : s.hoursToEnd < 48 ? `${Math.round(s.hoursToEnd)}h` : `${Math.round(s.hoursToEnd / 24)} days`],
  ];
  return (
    <div className="space-y-4">
      <InsightPanel id="market-pulse" title="Market pulse" items={a.insights} briefKey={`pm-${id}`} mode={mode} />
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] md:grid-cols-4 2xl:grid-cols-8">
        {tiles.map(([k, v, note, sign]) => (
          <li key={k} className="bg-[var(--surface-1)] px-3.5 py-2.5">
            <span className="block text-[11.5px] font-semibold text-ink-muted">{k}</span>
            <span className="num mt-0.5 block truncate text-[16px] font-bold text-ink" style={sign != null ? tone(sign) : undefined}>{v}</span>
            {note && <span className="block truncate text-[11px] text-ink-2">{note}</span>}
          </li>
        ))}
      </ul>
      <div className="grid gap-4 xl:grid-cols-3">
        <section aria-labelledby="flow" className="material min-w-0 p-4 sm:p-5">
          <h2 id="flow" className="t-section mb-3">Trade flow</h2>
          <div className="space-y-3">
            <Split a={a.flow.yesUsd} b={a.flow.noUsd} labelA="YES shares" labelB="NO shares" />
            <Split a={a.flow.buyUsd} b={a.flow.sellUsd} labelA="Bought" labelB="Sold" />
            <Split a={a.holders.yesUsd} b={a.holders.noUsd} labelA="Held on YES" labelB="on NO" />
          </div>
          {a.flow.largest?.usd ? <p className="num mt-3 text-[12px] text-ink-2">Largest recent trade {usd(a.flow.largest.usd)}: {[a.flow.largest.action, a.flow.largest.side].filter(Boolean).join(' ')} at {prob(a.flow.largest.price)}</p> : null}
          <p className="mt-1 text-[11px] text-ink-muted">From the latest {a.flow.trades} trades and the largest holders Nansen returns.</p>
        </section>
        <section aria-labelledby="top-traders" className="material min-w-0 p-4 sm:p-5 xl:col-span-2">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="top-traders" className="t-section">Top traders in this market</h2>
            <span className="text-[12px] text-ink-muted">By total PnL · Nansen pnl-by-market</span>
          </div>
          {a.topTraders.length ? (
            <div className="max-h-[360px] overflow-auto" tabIndex={0} role="region" aria-label="Top traders">
              <table data-sortable className="w-full min-w-[640px] text-left text-[12.5px]">
                <thead className="sticky top-0 bg-[var(--surface-1)] text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 font-normal">Trader</th><th className="font-normal">Side</th><th className="text-right font-normal">Bought for</th><th className="text-right font-normal">Sold for</th><th className="text-right font-normal">Held value</th><th className="text-right font-normal">PnL</th></tr></thead>
                <tbody>
                  {a.topTraders.map((t, i) => (
                    <tr key={`${t.address}:${t.side}:${i}`} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                      <td className="py-1.5"><AddressLink address={t.address} /></td>
                      <td className="font-semibold" style={{ color: /^yes$/i.test(t.side ?? '') ? 'var(--mint)' : 'var(--flare)' }}>{t.side ?? 'n/a'}</td>
                      <td className="num text-right text-ink-2">{usd(t.buyCostUsd)}</td>
                      <td className="num text-right text-ink-2">{usd(t.sellProceedsUsd)}</td>
                      <td className="num text-right text-ink-2">{usd(t.unrealizedUsd)}</td>
                      <td className="num text-right font-semibold" style={tone(t.pnlUsd)}>{usd(t.pnlUsd, { signed: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-[13px] text-ink-muted">Nansen returned no trader PnL for this market yet.</p>}
        </section>
      </div>
      {a.related.length > 0 && (
        <section aria-labelledby="related" className="material p-4 sm:p-5">
          <h2 id="related" className="t-section mb-2">Related markets</h2>
          <ol className="grid gap-x-6 gap-y-1 md:grid-cols-2">
            {a.related.map((m) => (
              <li key={m.id}>
                <Link href={`/predict/${m.id}`} className="grid grid-cols-[minmax(0,1fr)_90px_48px_64px] items-center gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px] hover:bg-ink/5">
                  <span className="truncate text-ink">{m.question}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-ink/8"><span className="block h-full rounded-full bg-[var(--signal)]" style={{ width: `${Math.round((m.price ?? 0) * 100)}%` }} /></span>
                  <span className="num text-right font-semibold text-ink">{prob(m.price)}</span>
                  <span className="num text-right" style={tone(m.change1d)}>{pts(m.change1d)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
