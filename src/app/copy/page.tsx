import Link from 'next/link';
import type { Metadata } from 'next';
import { PageTitle } from '@/components/PageTitle';
import { MobileCopyLab } from '@/components/mobile/MobileCopyLab';
import { StatStrip } from '@/components/StatStrip';
import { AddressLink } from '@/components/entity/AddressLink';
import { TokenLogo } from '@/components/Logo';
import { TimeAgo } from '@/components/TimeAgo';
import { cachedCopyLab, refreshCopyLab, LAGS } from '@/server/copy/followability';
import { displayMode } from '@/server/mode';
import { chainName, usd } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Copy Lab · Peregrine' };

const LAG_LABEL = ['Same moment', '15 min late', '1 hour late', '6 hours late'];
const p = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;
const tone = (x: number) => ({ color: x >= 0 ? 'var(--mint)' : 'var(--flare)' });
const scoreColor = (s: number) => (s >= 65 ? 'var(--mint)' : s >= 50 ? 'var(--amber)' : 'var(--flare)');

/** Copy Lab: which Smart Money wallets can you actually follow, given you see their trade late? */
export default async function CopyLabPage() {
  const mode = await displayMode();
  void refreshCopyLab(); // keeps the study fresh in the background; the page reads the stored result
  const lab = cachedCopyLab();

  if (mode !== 'owner') return (<div className="space-y-5"><PageTitle title="Copy Lab" /><p className="material p-5 text-[13px] text-ink-2">Copy Lab is built on Smart Money trades, shown only on this instance&apos;s owner view.</p></div>);
  if (!lab) return (<div className="space-y-5"><PageTitle title="Copy Lab" pill="Can you copy Smart Money?" /><p className="material p-5 text-[13px] text-ink-2">Measuring every stored Smart Money buy against Nansen price candles. The first study takes about two minutes; refresh shortly.</p></div>);

  const d = lab.decay;
  const lost15 = d.mean[0] > 0 ? 1 - d.mean[1] / d.mean[0] : null;
  const followable = lab.wallets.filter((w) => w.score >= 65);
  const maxAbs = Math.max(0.001, ...d.mean.map(Math.abs), ...d.median.map(Math.abs));
  const fresh = followable.flatMap((w) => w.recent.map((r) => ({ ...r, w }))).sort((a, b) => b.at - a.at).slice(0, 12);

  return (
    <>
    <div className="lg:hidden"><MobileCopyLab lab={lab} /></div>
    <div className="space-y-5 max-lg:hidden">
      <PageTitle title="Copy Lab" pill="Can you copy Smart Money when you see the trade late?" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        <StatStrip className="xl:col-span-12" stats={[
          { label: 'Smart Money buys in profit 24h later', value: `${Math.round(d.win[0] * 100)}%`, note: `of ${lab.buysMeasured.toLocaleString('en-US')} buys, copied at the same moment`, tone: d.win[0] >= 0.5 ? 'in' : 'out' },
          { label: 'Median Smart Money buy, 24h later', value: p(d.median[0]), note: `average ${p(d.mean[0])}: a few runners carry it`, tone: d.median[0] >= 0 ? 'in' : 'out' },
          { label: 'Edge lost in the first 15 minutes', value: lost15 != null ? `${Math.round(lost15 * 100)}%` : 'n/a', note: `${p(d.mean[0])} falls to ${p(d.mean[1])}`, tone: 'out' },
          { label: 'Wallets you can follow', value: String(followable.length), note: `Followability 65+ of ${lab.walletsScored} scored` , tone: 'in' },
          { label: 'Nansen price candles read', value: lab.tokensPriced.toLocaleString('en-US'), note: 'tokens priced from 15-minute candles' },
        ]} />

        <section className="material p-4 sm:p-5 xl:col-span-5" aria-labelledby="decay">
          <h2 id="decay" className="t-section">How fast the edge decays</h2>
          <p className="mb-4 text-[12px] text-ink-muted">24-hour return of copying every Smart Money buy, by how late you enter</p>
          <ol className="space-y-3">
            {LAGS.map((_, i) => (
              <li key={i}>
                <div className="flex items-baseline justify-between text-[12.5px]"><span className="font-semibold text-ink">{LAG_LABEL[i]}</span><span className="num"><span className="font-bold" style={tone(d.mean[i])}>{p(d.mean[i])}</span><span className="ml-2 text-ink-muted">win {Math.round(d.win[i] * 100)}%</span></span></div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${(Math.abs(d.mean[i]) / maxAbs) * 100}%`, background: d.mean[i] >= 0 ? 'var(--mint)' : 'var(--flare)', opacity: 1 - i * 0.18 }} /></div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[11.5px] leading-relaxed text-ink-muted">Averages are pulled up by a few large winners: most buys lose, a handful of runners pay for them. That is why wallet choice matters more than following everyone.</p>
        </section>

        <section className="material p-4 sm:p-5 xl:col-span-7" aria-labelledby="fresh-buys">
          <h2 id="fresh-buys" className="t-section">Latest buys from followable wallets</h2>
          <p className="mb-3 text-[12px] text-ink-muted">Wallets with Followability 65+: their most recent Smart Money buys. Open a token for its risk verdict before following.</p>
          <ol className="divide-y divide-[var(--hair)]">
            {fresh.map((r) => (
              <li key={`${r.w.wallet}:${r.token}:${r.at}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-[12.5px]">
                <span className="min-w-0">
                  <Link href={`/token/${r.chain}/${encodeURIComponent(r.token)}`} className="flex min-w-0 items-center gap-2 font-semibold text-ink hover:underline"><TokenLogo symbol={r.symbol} chain={r.chain} address={r.token} size={18} /><span className="truncate">{r.symbol ?? r.token.slice(0, 6)}</span><span className="text-[11px] font-normal text-ink-muted">{chainName(r.chain)}</span></Link>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-muted">bought by <AddressLink address={r.w.wallet} label={r.w.label} compact /><span className="num font-semibold" style={{ color: scoreColor(r.w.score) }}>· {r.w.score}</span></span>
                </span>
                <span className="text-right"><span className="num block font-bold text-ink">{usd(r.usd)}</span><span className="num block text-[11px] text-ink-muted"><TimeAgo ts={r.at} /></span></span>
              </li>
            ))}
            {!fresh.length && <li className="py-4 text-[12.5px] text-ink-muted">No recent buys from wallets scoring 65+.</li>}
          </ol>
        </section>

        <section className="material p-4 sm:p-5 xl:col-span-12" aria-labelledby="board">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="board" className="t-section">Followability, every scored wallet</h2>
            <span className="text-[12px] text-ink-muted">One return per token (its buys averaged), 24h hold · score from win rate and median return when 1 hour late</span>
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Followability leaderboard">
            <table data-sortable className="w-full min-w-[900px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 font-normal">Wallet</th><th className="font-normal">Followability</th><th className="text-right font-normal">Tokens</th><th className="text-right font-normal">Same moment</th><th className="text-right font-normal">15 min late</th><th className="text-right font-normal">1 hour late</th><th className="text-right font-normal">6 hours late</th><th className="text-right font-normal">Win, 1h late</th><th className="text-right font-normal">Edge kept</th></tr></thead>
              <tbody>
                {lab.wallets.map((w) => (
                  <tr key={w.wallet} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                    <td className="max-w-[260px] py-1.5 pr-3"><AddressLink address={w.wallet} label={w.label} compact /></td>
                    <td className="pr-3"><span className="flex items-center gap-2"><span className="num w-7 font-bold" style={{ color: scoreColor(w.score) }}>{w.score}</span><span className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${w.score}%`, background: scoreColor(w.score) }} /></span></span></td>
                    <td className="num text-right text-ink-2">{w.tokens}</td>
                    {w.median.map((x, i) => <td key={i} className="num text-right" style={tone(x)}>{p(x)}</td>)}
                    <td className="num text-right text-ink">{Math.round(w.win[2] * 100)}%</td>
                    <td className="num text-right text-ink-2">{w.kept == null ? 'n/a' : `${Math.round(Math.max(-1, Math.min(2, w.kept)) * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="material p-4 sm:p-5 xl:col-span-12" aria-labelledby="method">
          <h2 id="method" className="t-section">Method</h2>
          <ul className="mt-2 grid gap-1.5 text-[12.5px] leading-relaxed text-ink-2 sm:grid-cols-2">
            <li>Every Smart Money DEX buy of $1,000+ from Nansen&apos;s Smart Money trade feed, at least 24 hours old.</li>
            <li>Prices from Nansen&apos;s 15-minute token candles (tgm/token-ohlcv): entry is the first candle open at or after the delay; exit 24 hours after the buy.</li>
            <li>Returns capped at −95% and +500% so a single broken candle cannot dominate.</li>
            <li>Followability shrinks toward 50 for wallets with few tokens: three tokens is the minimum, and more tokens earn more trust.</li>
            <li className="sm:col-span-2 text-ink-muted">Window {new Date(lab.window.from).toISOString().slice(0, 10)} to {new Date(lab.window.to).toISOString().slice(0, 10)} · {lab.calls} candle reads · recomputed every 6 hours. Past followability is evidence, not a promise.</li>
          </ul>
        </section>
      </div>
    </div>
    </>
  );
}
