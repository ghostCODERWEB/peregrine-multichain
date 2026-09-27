import Link from 'next/link';
import { Card } from '@/components/Card';
import { TokenLogo } from '@/components/Logo';
import { HistoryLines, RankBars } from '@/components/charts/IntelCharts';
import { InsightPanel } from '@/components/pulse/MarketPulse';
import { sectorsAnalytics } from '@/server/insights';
import type { DisplayMode } from '@/server/mode';
import { chainName, usd } from '@/lib/viz/format';

/** The Sectors page's analytical overview: insights with a Nansen brief, net flow ranking, 24h swings, flow history and the tokens driving it. */
export function SectorsAnalytics({ mode }: { mode: DisplayMode }) {
  const a = sectorsAnalytics(mode);
  const maxTok = Math.max(1, ...a.tokens.map((t) => Math.abs(t.net)));
  return (
    <div className="space-y-4">
      <InsightPanel id="sectors-pulse" title="Sector pulse" items={a.insights} briefKey="sectors" mode={mode} />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card id="sector-ranking" title="Net flow by sector, 24h" sub="Select a bar to open the sector">
          <RankBars rows={a.ranking} label="Net flow per sector in 24 hours" />
        </Card>
        <Card id="sector-history" title="Net flow over 7 days, most active sectors" sub="Rolling 24h net flow at each scan · select a line" className="xl:col-span-2">
          <HistoryLines series={a.history.map((h) => ({ ...h, href: `/sectors/${encodeURIComponent(h.name)}` }))} zeroLine label="Rolling 24-hour net flow for the most active sectors over 7 days" height={300} />
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card id="sector-swings" title="Biggest swings against a day ago" sub="Change in 24h net flow">
          <RankBars rows={a.change} label="Largest changes in sector net flow against a day ago" />
        </Card>
        <Card id="sector-drivers" title="Tokens driving sector flow" sub="Largest single-token flows across all sectors" className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table data-sortable className="w-full min-w-[560px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
                <tr><th className="py-2 font-normal">Token</th><th className="font-normal">Sector</th><th className="font-normal">Chain</th><th className="font-normal">Share</th><th className="text-right font-normal">Net flow 24h</th></tr>
              </thead>
              <tbody>
                {a.tokens.map((t) => (
                  <tr key={`${t.chain}:${t.address}`} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                    <td className="py-1.5"><Link href={`/token/${t.chain}/${encodeURIComponent(t.address)}`} className="flex items-center gap-2 font-semibold text-ink hover:underline"><TokenLogo symbol={t.symbol} chain={t.chain} address={t.address} size={18} />{t.symbol}</Link></td>
                    <td><Link href={`/sectors/${encodeURIComponent(t.sector)}`} className="text-ink-2 hover:text-ink hover:underline">{t.sector}</Link></td>
                    <td className="text-ink-2">{chainName(t.chain)}</td>
                    <td className="w-[140px]"><span className="block h-1.5 w-full overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${(Math.abs(t.net) / maxTok) * 100}%`, background: t.net >= 0 ? 'var(--mint)' : 'var(--flare)' }} /></span></td>
                    <td className="num text-right font-semibold" style={{ color: t.net >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{usd(t.net, { signed: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
