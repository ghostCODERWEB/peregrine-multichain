import Link from 'next/link';
import type { Metadata } from 'next';
import { PageTitle } from '@/components/PageTitle';
import { StatStrip } from '@/components/StatStrip';
import { CascadeExplorer } from '@/components/cascade/CascadeExplorer';
import { cascades, cascadeView } from '@/server/cascade/cascades';
import { displayMode } from '@/server/mode';
import { walletName } from '@/lib/viz/format';
import { WINDOW_MS } from '@/lib/models/cascade';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Cascades · Peregrine' };

const fmtMin = (m: number) => (m >= 1440 ? `${(m / 1440).toFixed(1)} days` : m >= 60 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);

/** Smart Money Cascades: who enters first among Smart Money, tested against random order, with every claim traceable to trades. */
export default async function CascadePage() {
  if ((await displayMode()) !== 'owner') return (<div className="space-y-5"><PageTitle title="Cascades" /><p className="material p-5 text-[13px] text-ink-2">Cascades are built on Smart Money trades, shown only on this instance&apos;s owner view.</p></div>);
  const c = cascades();
  const v = cascadeView(c, walletName);
  const name = new Map(v.nodes.map((n) => [n.wallet, n.name]));
  const leaders = v.nodes.filter((n) => n.role === 'leader');
  const followers = v.nodes.filter((n) => n.role === 'follower');
  return (
    <div className="space-y-4">
      <PageTitle title="Cascades" pill="Who moves Smart Money? Entry order, tested against chance" />
      <StatStrip stats={[
        { label: 'Smart Money buy episodes', value: c.episodes.length.toLocaleString('en-US'), note: `tokens with 3+ Smart Money wallets entering within ${WINDOW_MS / 3_600_000}h` },
        { label: 'Wallets tested', value: c.tested.toLocaleString('en-US'), note: `3+ episodes each · ${c.trades.toLocaleString('en-US')} buys` },
        { label: 'Consistent leaders', value: String(c.fdrLeaders), note: `survive a 10% false-discovery rate (${leaders.length} at p < 0.05)`, tone: 'in' },
        { label: 'Consistent followers', value: String(followers.length), note: 'enter later than chance, p < 0.05', tone: 'out' },
        { label: 'Precedence links', value: String(c.edges.length), note: 'wallet A enters before B, binomial p ≤ 0.1' },
      ]} />
      <CascadeExplorer nodes={v.nodes} edges={v.edges} evidence={v.evidence} replay={v.replay} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <section className="material p-4 sm:p-5 xl:col-span-7" aria-labelledby="links">
          <h2 id="links" className="t-section">Who enters before whom</h2>
          <p className="mb-2 text-[12px] text-ink-muted">Pairs that co-entered at least three tokens, where one entered first more often than a coin flip would</p>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Precedence links">
            <table data-sortable className="w-full min-w-[620px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 font-normal">Enters first</th><th className="font-normal">Then</th><th className="text-right font-normal">Record</th><th className="text-right font-normal">Typical gap</th><th className="text-right font-normal">p</th><th className="font-normal">Tokens</th></tr></thead>
              <tbody>
                {c.edges.map((e) => (
                  <tr key={`${e.from}>${e.to}`} className="border-t border-[var(--hair)]">
                    <td className="max-w-[170px] truncate py-1.5 pr-2"><Link href={`/wallet/${e.from}`} className="font-semibold text-[var(--mint)] hover:underline">{name.get(e.from) ?? walletName(null, e.from)}</Link></td>
                    <td className="max-w-[170px] truncate pr-2"><Link href={`/wallet/${e.to}`} className="text-ink-2 hover:underline">{name.get(e.to) ?? walletName(null, e.to)}</Link></td>
                    <td className="num text-right text-ink">{e.wins}/{e.n}</td>
                    <td className="num text-right text-ink-2">{fmtMin(e.medianGapMin)}</td>
                    <td className="num text-right text-ink-2">{e.p.toFixed(3)}</td>
                    <td className="max-w-[200px] truncate pl-3 text-ink-muted">{e.tokens.slice(0, 5).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="material hidden p-4 sm:block sm:p-5 xl:col-span-5" aria-labelledby="method">
          <h2 id="method" className="t-section">Method and limits</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-ink-2">
            <li><b className="text-ink">Data.</b> Smart Money DEX buys of ${c.minUsd}+ with Nansen labels: the live feed (smart-money/dex-trades, which only covers 24 hours) stored every scan, plus 30 days per token from Token God Mode (tgm/dex-trades, only_smart_money).</li>
            <li><b className="text-ink">Episodes.</b> Per token, each wallet&apos;s first buy within a {WINDOW_MS / 3_600_000}h window; a new episode starts after the window closes. At least three wallets.</li>
            <li><b className="text-ink">Leaders.</b> Entry rank scaled 0 (first) to 1 (last). If order were random its mean is 0.5; a z-test on the wallet&apos;s mean rank, corrected across all wallets (Benjamini-Hochberg, 10%).</li>
            <li><b className="text-ink">Links.</b> For each pair that co-entered 3+ tokens, an exact binomial test on how often each entered first. Entries within a minute count as ties.</li>
          </ol>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">Entering first is not causation: two wallets can share an information source rather than copy each other. Links are not corrected for multiple testing, so treat single links as leads for research, and leaders that survive FDR as the stronger finding. Window {new Date(c.window.from).toISOString().slice(0, 10)} to {new Date(c.window.to).toISOString().slice(0, 10)}.</p>
        </section>
      </div>
    </div>
  );
}
