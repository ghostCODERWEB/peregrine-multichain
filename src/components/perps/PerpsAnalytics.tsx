import { TokenLogo } from '@/components/Logo';
import Link from 'next/link';
import { Card } from '@/components/Card';
import { HistoryLines, RankBars } from '@/components/charts/IntelCharts';
import { InsightPanel } from '@/components/pulse/MarketPulse';
import { perpsAnalytics } from '@/server/insights';
import type { DisplayMode } from '@/server/mode';
import { usd } from '@/lib/viz/format';

/** The Perps page's analytical overview: insights with a Nansen brief, then OI, price and funding movers and the Smart Money book. */
export function PerpsAnalytics({ mode }: { mode: DisplayMode }) {
  const a = perpsAnalytics(mode);
  const maxBook = Math.max(1, ...a.smBook.map((b) => b.long + b.short));
  return (
    <div className="space-y-4">
      <InsightPanel id="perps-pulse" title="Perps pulse" items={a.insights} briefKey="perps" mode={mode} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card id="perps-oi-history" title="Hyperliquid open interest, 7 days" className="xl:col-span-2">
          <HistoryLines series={[{ name: 'Open interest', points: a.oiHistory }]} label="Hyperliquid total open interest over 7 days" height={250} />
        </Card>
        <Card id="perps-oi-movers" title="Open interest change, 24h" sub="Coins over $5M OI · select to open">
          <RankBars rows={a.oiMovers} format="pct" label="Largest 24h open interest changes" />
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card id="perps-price-movers" title="Price movers, 24h" sub="Coins over $5M OI">
          <RankBars rows={a.priceMovers} format="pct" label="Largest 24h price moves" />
        </Card>
        <Card id="perps-funding" title="Funding extremes, yearly" sub="Positive: longs pay · coins over $20M OI">
          <RankBars rows={a.funding} format="pct" label="Most extreme annualized funding" />
        </Card>
        {a.smBook.length > 0 ? (
          <Card id="perps-sm-book" title="Smart Money book by coin" sub="Observed long and short exposure">
            <ul className="space-y-2">
              {a.smBook.map((b) => (
                <li key={b.symbol} data-analyze={JSON.stringify({ kind: 'perp', label: `${b.symbol} Smart Money book`, href: `/perps/${b.symbol}`, longUsd: Math.round(b.long), shortUsd: Math.round(b.short) })}>
                  <Link prefetch={false} href={`/perps/${encodeURIComponent(b.symbol)}`} className="group grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-2 text-[12px]">
                    <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink group-hover:underline"><TokenLogo symbol={b.symbol} coin={b.symbol} size={16} /><span className="truncate">{b.symbol}</span></span>
                    <span className="flex h-2.5 overflow-hidden rounded-full bg-[var(--hair)]" style={{ width: `${Math.max(8, ((b.long + b.short) / maxBook) * 100)}%` }}>
                      <span style={{ width: `${(b.long / (b.long + b.short)) * 100}%`, background: 'var(--mint)' }} /><span className="flex-1" style={{ background: 'var(--flare)' }} />
                    </span>
                    <span className="num whitespace-nowrap text-right text-[11.5px] text-ink-2">{Math.round((b.long / (b.long + b.short)) * 100)}% L · {usd(b.long + b.short)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
