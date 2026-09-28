import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PageTitle } from '@/components/PageTitle';
import { MobileCopyLab } from '@/components/mobile/MobileCopyLab';
import { StatStrip } from '@/components/StatStrip';
import { AddressLink } from '@/components/entity/AddressLink';
import { TokenLogo } from '@/components/Logo';
import { TimeAgo } from '@/components/TimeAgo';
import { cachedCopyLab, refreshCopyLab, LAGS, type CopyLab } from '@/server/copy/followability';
import { copyLeaders, TIMEFRAMES, type Leader, type Leaders, type Timeframe, type TraderKind } from '@/server/copy/leaders';
import { pmLeaders, cachedPmLeaders, type PmLeaders } from '@/server/copy/predict-leaders';
import { copyTargets, type CopyTarget } from '@/server/copy/targets';
import { cohortFlows, cohortBoards, COHORTS, COHORT_LABEL, COHORT_NOTE, type Cohorts } from '@/server/copy/cohorts';
import { perpLeaders, type PerpLeaders } from '@/server/perps/detail';
import { predictBoard } from '@/server/predict/board';
import { displayMode } from '@/server/mode';
import { isPhone } from '@/server/device';
import { chainName, usd } from '@/lib/viz/format';
import { pageMeta } from '@/server/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = pageMeta({ title: 'Copy Lab: profitable traders to follow', description: 'Spot, perp and prediction-market traders ranked by a copy score, and whether copying them still works when you enter late.', path: '/copy' });

const LAG_LABEL = ['Same moment', '15 min late', '1 hour late', '6 hours late'];
const MARKETS = ['all', 'spot', 'perps', 'predict', 'cohorts'] as const;
type Market = (typeof MARKETS)[number];
const MARKET_LABEL: Record<Market, string> = { all: 'All', spot: 'Spot', perps: 'Perps', predict: 'Predictions', cohorts: 'KOLs & cohorts' };
const MARKET_COLOR: Record<'spot' | 'perps' | 'predict', string> = { spot: 'var(--mint)', perps: '#b18cff', predict: '#7cc8ff' };
const KIND_LABEL: Record<TraderKind, string> = { kol: 'KOL', fund: 'Fund', trader: 'Trader' };
const KIND_COLOR: Record<TraderKind, string> = { kol: 'var(--amber)', fund: '#7cc8ff', trader: 'var(--mint)' };
const WHO = ['all', 'trader', 'kol', 'fund'] as const;
type Who = (typeof WHO)[number];
const WHO_LABEL: Record<Who, string> = { all: 'All', trader: 'Traders', kol: 'KOLs', fund: 'Funds' };
type Un = { unavailable: string };
const un = (x: unknown): x is Un => !!x && typeof x === 'object' && 'unavailable' in x;

const p = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;
const tone = (x: number) => ({ color: x >= 0 ? 'var(--mint)' : 'var(--flare)' });
const scoreColor = (s: number) => (s >= 65 ? 'var(--mint)' : s >= 50 ? 'var(--amber)' : 'var(--flare)');
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const href = (m: Market, tf: Timeframe, who: Who) => `/copy?${new URLSearchParams({ ...(m !== 'all' ? { m } : {}), ...(tf !== 30 ? { tf: String(tf) } : {}), ...(who !== 'all' ? { who } : {}) })}`.replace(/\?$/, '');
const settle = async <T,>(p: Promise<T>): Promise<T | Un> => { try { return await p; } catch (e) { return { unavailable: (e as Error)?.message ?? 'Nansen could not be read.' }; } };

function Segmented<T extends string | number>({ label, items, value, name, link }: { label: string; items: readonly T[]; value: T; name: (x: T) => string; link: (x: T) => string }) {
  return (
    <nav aria-label={label} className="segmented" style={{ '--segments': items.length, '--selected': items.indexOf(value) } as React.CSSProperties}>
      <span className="segmented-thumb" aria-hidden />
      {items.map((x) => <Link prefetch={false} key={String(x)} href={link(x)} aria-current={x === value ? 'page' : undefined} className="relative z-[1] px-3 py-1 text-center text-[12px] font-bold">{name(x)}</Link>)}
    </nav>
  );
}
const ScoreBar = ({ score, title }: { score: number; title?: string }) => (
  <span className="flex items-center gap-2" title={title}><span className="num w-7 font-bold" style={{ color: scoreColor(score) }}>{score}</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${score}%`, background: scoreColor(score) }} /></span></span>
);
const Chip = ({ text, color }: { text: string; color: string }) => <span className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{text}</span>;
const Section = ({ id, title, sub, className = '', children }: { id: string; title: string; sub?: ReactNode; className?: string; children: ReactNode }) => (
  <section className={`material p-4 sm:p-5 ${className}`} aria-labelledby={id}>
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h2 id={id} className="t-section">{title}</h2>{sub && <span className="text-[12px] text-ink-muted">{sub}</span>}</div>
    {children}
  </section>
);
const Unavailable = ({ what, u }: { what: string; u: Un }) => <p className="py-3 text-[12.5px] text-ink-muted">{what} could not be read: {u.unavailable}</p>;

/** What the owner's Copy Lab holds, for the public view's explainer. */
const COPY_PANELS: Array<[string, string]> = [
  ['Best to follow, every market', "Each market's own copy score, 0 to 100, for spot, perp and prediction traders side by side."],
  ['Spot traders to follow', 'Nansen Smart Money PnL over 7, 30 or 90 days, ranked by copy score, with what the leaders are buying and where they agree.'],
  ['Perp and prediction traders', 'Hyperliquid leaders over 30 days, and Polymarket winners rated by their lifetime record, not one market.'],
  ['Followability', 'Whether copying a wallet works in practice: its buys replayed 15 minutes, 1 hour and 6 hours late, as a follower would enter.'],
];

/** Copy Lab: the profitable traders worth following, in spot, perps and prediction markets. */
export default async function CopyLabPage({ searchParams }: { searchParams: Promise<{ m?: string; tf?: string; who?: string }> }) {
  const mode = await displayMode();
  if (mode !== 'owner') return (
    <div className="space-y-4">
      <PageTitle title="Copy Lab" />
      <section aria-labelledby="copy-private" className="material rise p-5 sm:p-6">
        <h2 id="copy-private" className="t-section text-ink">Copy Lab is private</h2>
        <p className="mt-2 max-w-[68ch] text-[13px] text-ink-2">
          It ranks the traders worth following from Nansen Smart Money data, which Nansen&apos;s redistribution rules keep out of public
          views: it is shown only on this instance&apos;s owner view.
        </p>
      </section>
      <section aria-labelledby="copy-what" className="material rise p-5 sm:p-6">
        <h2 id="copy-what" className="text-[15px] font-semibold text-ink">What Copy Lab shows</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {COPY_PANELS.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border/70 bg-raised/50 p-3">
              <dt className="text-[13px] font-medium text-ink">{k}</dt>
              <dd className="mt-0.5 text-[12.5px] text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );

  const q = await searchParams;
  const m: Market = (MARKETS as readonly string[]).includes(q.m ?? '') ? (q.m as Market) : 'all';
  const tf = (TIMEFRAMES as readonly number[]).includes(Number(q.tf)) ? (Number(q.tf) as Timeframe) : 30;
  const who: Who = (WHO as readonly string[]).includes(q.who ?? '') ? (q.who as Who) : 'all';

  void refreshCopyLab(); // the late-entry study refreshes in the background; the page reads the stored result
  const want = (x: Market) => m === 'all' || m === x;
  const [spot, perps, predict] = await Promise.all([
    want('spot') || m === 'cohorts' ? copyLeaders(tf) : Promise.resolve(null),
    want('perps') ? settle(perpLeaders()) : Promise.resolve(null),
    want('predict') ? settle(Promise.resolve(cachedPmLeaders()).then((hit) => hit ?? predictBoard().then((b) => (b.markets.length ? pmLeaders(b.markets) : { unavailable: b.unavailable ?? 'No Polymarket markets were read.' })))) : Promise.resolve(null),
  ]);
  const targets = copyTargets({ spot: un(spot) ? null : spot, perps: un(perps) ? null : perps, predict: un(predict) ? null : predict }, tf);
  const phone = <MobileCopyLab targets={targets} spot={un(spot) ? null : spot} tf={tf} market={m} />;
  if (await isPhone()) return phone;
  const lab = cachedCopyLab();
  const cohorts = want('cohorts') ? await settle(cohortFlows(spot && !un(spot) ? spot.consensus.filter((c) => c.chain && c.token).slice(0, 4) : [])) : null;

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Market" items={MARKETS} value={m} name={(x) => MARKET_LABEL[x]} link={(x) => href(x, tf, who)} />
      {m === 'spot' && <Segmented label="Trader type" items={WHO} value={who} name={(x) => WHO_LABEL[x]} link={(x) => href(m, tf, x)} />}
      {(m === 'spot' || m === 'all') && <Segmented label="Timeframe" items={TIMEFRAMES} value={tf} name={(x) => `${x}D`} link={(x) => href(m, x, who)} />}
    </div>
  );

  return (
    <>
    <div className="lg:hidden">{phone}</div>
    <div className="space-y-5 max-lg:hidden">
      <PageTitle title="Copy Lab" pill="Profitable traders worth following: spot, perps, predictions" action={controls} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        {m === 'all' && <AllView targets={targets} spot={spot} perps={perps} predict={predict} tf={tf} />}
        {cohorts && <CohortView cohorts={cohorts} compact={m === 'all'} />}
        {m === 'spot' && spot && (un(spot) ? <Section id="spot" title="Spot traders" className="xl:col-span-12"><Unavailable what="Nansen's Smart Money leaderboard" u={spot} /></Section> : <SpotView board={spot} tf={tf} who={who} lab={lab} />)}
        {m === 'perps' && perps && <PerpsView perps={perps} />}
        {m === 'predict' && predict && <PredictView predict={predict} />}
        {want('spot') && m !== 'cohorts' && lab && <LateEntry lab={lab} className="xl:col-span-12" />}
        <Method m={m} spot={spot} perps={perps} predict={predict} cohorts={cohorts} />
      </div>
    </div>
    </>
  );
}

function AllView({ targets, spot, perps, predict, tf }: { targets: CopyTarget[]; spot: Leaders | Un | null; perps: PerpLeaders | Un | null; predict: PmLeaders | Un | null; tf: Timeframe }) {
  const count = (x: CopyTarget['market']) => targets.filter((t) => t.market === x).length;
  const strong = targets.filter((t) => t.score >= 65);
  const top = targets.slice(0, 30);
  const board = spot && !un(spot) ? spot : null;
  return (
    <>
      <StatStrip className="xl:col-span-12" stats={[
        { label: 'Traders scored', value: targets.length.toLocaleString('en-US'), note: `${count('spot')} spot · ${count('perps')} perps · ${count('predict')} predictions` },
        { label: 'Copy score 65+', value: String(strong.length), note: 'profit that is repeated, banked and broad', tone: 'in' },
        { label: `Best spot trader, ${tf}D`, value: board?.leaders[0] ? usd(board.leaders[0].windows[tf]!.pnl, { signed: true }) : 'n/a', note: board?.leaders[0] ? `copy score ${board.leaders[0].score}` : un(spot) ? 'leaderboard unavailable' : undefined, tone: 'in', href: '/copy?m=spot' },
        { label: 'Best perp trader, 30D', value: perps && !un(perps) && perps.rows[0] ? usd(perps.rows[0].pnl30, { signed: true }) : 'n/a', note: perps && !un(perps) && perps.rows[0] ? `copy score ${perps.rows[0].score}` : 'Hyperliquid leaderboard unavailable', tone: 'in', href: '/copy?m=perps' },
        { label: 'Best prediction trader', value: predict && !un(predict) && predict.leaders[0] ? usd(predict.leaders[0].totalPnl, { signed: true }) : 'n/a', note: predict && !un(predict) && predict.leaders[0] ? `lifetime · copy score ${predict.leaders[0].score}` : 'Polymarket records unavailable', tone: 'in', href: '/copy?m=predict' },
      ]} />

      <Section id="best" title="Best to follow, every market" sub="Each market's own copy score, 0 to 100 · open a tab for the full board" className="xl:col-span-12">
        {top.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Best traders to follow">
            <table data-sortable className="w-full min-w-[900px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr>
                <th className="py-2 pr-2 font-normal">#</th><th className="font-normal">Market</th><th className="font-normal">Trader</th><th className="font-normal">Copy score</th>
                <th className="text-right font-normal">Profit</th><th className="pl-4 font-normal">Record</th><th className="font-normal">Now</th>
              </tr></thead>
              <tbody>
                {top.map((t, i) => (
                  <tr key={`${t.market}:${t.address}`} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                    <td className="num py-1.5 pr-2 text-ink-muted">{i + 1}</td>
                    <td className="pr-3"><Chip text={MARKET_LABEL[t.market]} color={MARKET_COLOR[t.market]} /></td>
                    <td className="max-w-[260px] pr-3"><span className="flex min-w-0 items-center gap-2"><AddressLink address={t.address} label={t.label} compact />{t.kind && t.kind !== 'trader' && <Chip text={KIND_LABEL[t.kind]} color={KIND_COLOR[t.kind]} />}</span></td>
                    <td className="pr-3"><ScoreBar score={t.score} /></td>
                    <td className="num text-right font-bold" style={t.pnl == null ? undefined : tone(t.pnl)}>{usd(t.pnl, { signed: true })}<span className="ml-1 text-[11px] font-normal text-ink-muted">{t.pnlLabel}</span></td>
                    <td className="pl-4 text-ink-2">{t.record}</td>
                    <td className="max-w-[260px] truncate text-ink-2">{t.now ?? '·'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="py-3 text-[12.5px] text-ink-muted">No leaderboard could be read right now. Each tab says why.</p>}
      </Section>

      {board && <BuyingNow board={board} tf={tf} who="all" className="xl:col-span-7" />}
      {board && <Consensus board={board} className="xl:col-span-5" />}
    </>
  );
}

function SpotView({ board, tf, who, lab }: { board: Leaders; tf: Timeframe; who: Who; lab: CopyLab | null }) {
  const all = board.leaders;
  const leaders = who === 'all' ? all : all.filter((l) => l.kind === who);
  const shown = leaders.slice(0, 50);
  const w = (l: Leader) => l.windows[tf]!;
  const steady = all.filter((l) => TIMEFRAMES.filter((t) => l.windows[t]).length >= 2 && TIMEFRAMES.every((t) => !l.windows[t] || l.windows[t]!.pnl > 0));
  const winMed = median(all.map((l) => w(l).winRate).filter((x): x is number => x != null));
  const buyingNow = new Set(board.buying.filter((b) => b.at >= board.at - 86_400_000).map((b) => b.leader.address)).size;
  const late = new Map((lab?.wallets ?? []).map((x) => [x.wallet.toLowerCase(), x.score]));
  const counts = { kol: all.filter((l) => l.kind === 'kol').length, fund: all.filter((l) => l.kind === 'fund').length };
  return (
    <>
      <StatStrip className="xl:col-span-12" stats={[
        { label: `Smart Money traders ranked, ${tf}D`, value: all.length.toLocaleString('en-US'), note: `${counts.kol} KOLs · ${counts.fund} funds · by Nansen PnL` },
        { label: 'Copy score 65+', value: String(all.filter((l) => l.score >= 65).length), note: 'profit that is banked, repeated and broad', tone: 'in' },
        { label: 'Profitable in every window', value: String(steady.length), note: `in profit over ${TIMEFRAMES.map((t) => `${t}D`).join(', ')}`, tone: 'in' },
        { label: `Median win rate, ${tf}D`, value: winMed == null ? 'n/a' : `${Math.round(winMed * 100)}%`, note: 'across the ranked traders' },
        { label: 'Buying in the last 24h', value: String(buyingNow), note: 'leaders seen on the Smart Money tape', tone: buyingNow ? 'in' : undefined },
      ]} />

      <Section id="leaders" title="Spot traders to follow" sub={`Nansen Smart Money PnL, ${tf} days, ranked by copy score · ${shown.length} of ${leaders.length} shown`} className="xl:col-span-12">
        {shown.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Spot traders to follow">
            <table data-sortable className="w-full min-w-[1080px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr>
                <th className="py-2 pr-2 font-normal">#</th><th className="font-normal">Trader</th><th className="font-normal">Copy score</th>
                <th className="text-right font-normal">PnL {tf}D</th><th className="text-right font-normal">Realized</th><th className="text-right font-normal">Win rate</th><th className="text-right font-normal">Avg ROI</th>
                <th className="text-right font-normal">Trades</th><th className="text-right font-normal">Tokens</th><th className="pl-4 font-normal">7D · 30D · 90D</th><th className="font-normal">Holding</th><th className="text-right font-normal">Last buy</th><th className="text-right font-normal" title="Followability from the late-entry test, when scored">Late entry</th>
              </tr></thead>
              <tbody>
                {shown.map((l, i) => {
                  const x = w(l), lt = late.get(l.address.toLowerCase()) ?? null, last = l.recent[0];
                  return (
                    <tr key={l.address} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                      <td className="num py-1.5 pr-2 text-ink-muted">{i + 1}</td>
                      <td className="max-w-[260px] pr-3"><span className="flex min-w-0 items-center gap-2"><AddressLink address={l.address} label={l.label} compact /><Chip text={KIND_LABEL[l.kind]} color={KIND_COLOR[l.kind]} /></span></td>
                      <td className="pr-3"><ScoreBar score={l.score} title={Object.entries(l.parts).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(' · ')} /></td>
                      <td className="num text-right font-bold" style={tone(x.pnl)}>{usd(x.pnl, { signed: true })}</td>
                      <td className="num text-right text-ink-2">{usd(x.realized, { signed: true })}</td>
                      <td className="num text-right text-ink">{x.winRate == null ? 'n/a' : `${Math.round(x.winRate * 100)}%`}</td>
                      <td className="num text-right" style={x.avgRoi == null ? undefined : tone(x.avgRoi)}>{x.avgRoi == null ? 'n/a' : p(x.avgRoi)}</td>
                      <td className="num text-right text-ink-2">{x.trades.toLocaleString('en-US')}</td>
                      <td className="num text-right text-ink-2">{x.tokens}</td>
                      <td className="pl-4"><span className="flex gap-1.5">{TIMEFRAMES.map((t) => { const v = l.windows[t]; return <span key={t} title={v ? `${t}D ${usd(v.pnl, { signed: true })}` : `Not in the ${t}D top 100`} className="h-2.5 w-2.5 rounded-full" style={{ background: v ? (v.pnl > 0 ? 'var(--mint)' : 'var(--flare)') : 'var(--hair-2)' }} />; })}</span></td>
                      <td><span className="flex items-center gap-1">{l.holdings.slice(0, 4).map((h, j) => <span key={j} title={`${h.symbol ?? h.address}${h.usd != null ? ` · ${usd(h.usd)}` : ''}`}><TokenLogo symbol={h.symbol} chain={h.chain ?? undefined} address={h.address ?? undefined} size={18} /></span>)}{!l.holdings.length && <span className="text-ink-muted">n/a</span>}</span></td>
                      <td className="num text-right text-ink-2">{last ? <Link prefetch={false} href={`/token/${last.chain}/${encodeURIComponent(last.token)}`} className="hover:underline">{last.symbol ?? last.token.slice(0, 6)} · <TimeAgo ts={last.at} /></Link> : '·'}</td>
                      <td className="num text-right font-semibold" style={lt == null ? undefined : { color: scoreColor(lt) }}>{lt ?? '·'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="py-3 text-[12.5px] text-ink-muted">No {WHO_LABEL[who].toLowerCase()} on Nansen&apos;s {tf}-day Smart Money leaderboard right now. Try another timeframe or All.</p>}
      </Section>

      <BuyingNow board={board} tf={tf} who={who} className="xl:col-span-7" />
      <Consensus board={board} className="xl:col-span-5" />
    </>
  );
}

function BuyingNow({ board, tf, who, className }: { board: Leaders; tf: Timeframe; who: Who; className: string }) {
  const feed = (who === 'all' ? board.buying : board.buying.filter((b) => b.leader.kind === who)).slice(0, 14);
  return (
    <Section id="buying" title="What the spot leaders are buying" sub="Stored Smart Money tape, last 3 days" className={className}>
      <ol className="divide-y divide-[var(--hair)]">
        {feed.map((r) => (
          <li key={`${r.leader.address}:${r.chain}:${r.token}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-[12.5px]">
            <span className="min-w-0">
              <Link prefetch={false} href={`/token/${r.chain}/${encodeURIComponent(r.token)}`} className="flex min-w-0 items-center gap-2 font-semibold text-ink hover:underline"><TokenLogo symbol={r.symbol} chain={r.chain} address={r.token} size={18} /><span className="truncate">{r.symbol ?? r.token.slice(0, 6)}</span><span className="text-[11px] font-normal text-ink-muted">{chainName(r.chain)}</span></Link>
              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-muted">bought by <AddressLink address={r.leader.address} label={r.leader.label} compact /><span className="num font-semibold" style={{ color: scoreColor(r.leader.score) }}>· {r.leader.score}</span><span className="num">· {usd(r.leader.windows[tf]!.pnl, { signed: true })} {tf}D</span></span>
            </span>
            <span className="text-right"><span className="num block font-bold text-ink">{usd(r.usd)}</span><span className="num block text-[11px] text-ink-muted"><TimeAgo ts={r.at} /></span></span>
          </li>
        ))}
        {!feed.length && <li className="py-4 text-[12.5px] text-ink-muted">No buys recorded in the last 3 days.</li>}
      </ol>
      
    </Section>
  );
}

function Consensus({ board, className }: { board: Leaders; className: string }) {
  return (
    <Section id="consensus" title="Where the spot leaders agree" sub="2+ traders buying or holding" className={className}>
      <ol className="divide-y divide-[var(--hair)]">
        {board.consensus.map((c) => {
          const body = <><TokenLogo symbol={c.symbol} chain={c.chain || undefined} address={c.token || undefined} size={18} /><span className="truncate font-semibold text-ink">{c.symbol ?? c.token.slice(0, 6)}</span>{c.chain && <span className="text-[11px] text-ink-muted">{chainName(c.chain)}</span>}</>;
          return (
            <li key={`${c.source}:${c.chain}:${c.token}:${c.symbol}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 text-[12.5px]">
              {c.chain && c.token ? <Link prefetch={false} href={`/token/${c.chain}/${encodeURIComponent(c.token)}`} className="flex min-w-0 items-center gap-2 hover:underline">{body}</Link> : <span className="flex min-w-0 items-center gap-2">{body}</span>}
              <span className="text-right"><span className="num block font-bold" style={{ color: c.source === 'buying' ? 'var(--mint)' : 'var(--ink-1)' }}>{c.wallets} {c.source}</span><span className="num block text-[11px] text-ink-muted">{c.usd ? usd(c.usd) : ''}{c.last ? <> · <TimeAgo ts={c.last} /></> : ''}</span></span>
            </li>
          );
        })}
        {!board.consensus.length && <li className="py-4 text-[12.5px] text-ink-muted">No token is shared by two or more ranked traders right now.</li>}
      </ol>
      
    </Section>
  );
}

function PerpsView({ perps }: { perps: PerpLeaders | Un }) {
  if (un(perps)) return <Section id="perps" title="Perp traders to follow" className="xl:col-span-12"><Unavailable what="Nansen's Hyperliquid leaderboard" u={perps} /></Section>;
  const rows = perps.rows.slice(0, 50);
  const both = perps.rows.filter((r) => (r.pnl30 ?? 0) > 0 && (r.pnl7 ?? 0) > 0).length;
  const roiMed = median(perps.rows.map((r) => r.roi30).filter((x): x is number => x != null));
  return (
    <>
      <StatStrip className="xl:col-span-12" stats={[
        { label: 'Hyperliquid traders ranked, 30D', value: String(perps.rows.length), note: 'Nansen perp leaderboard, top 100 by PnL' },
        { label: 'Copy score 65+', value: String(perps.rows.filter((r) => r.score >= 65).length), note: 'consistent, banked, sane leverage', tone: 'in' },
        { label: 'Profitable over 7 and 30 days', value: String(both), tone: 'in' },
        { label: 'Median 30-day ROI', value: roiMed == null ? 'n/a' : p(roiMed), tone: roiMed != null && roiMed >= 0 ? 'in' : 'out' },
      ]} />
      <Section id="perps" title="Perp traders to follow" sub="Hyperliquid, 30 days, ranked by copy score" className="xl:col-span-12">
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Perp traders to follow">
          <table data-sortable className="w-full min-w-[1000px] text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr>
              <th className="py-2 pr-2 font-normal">#</th><th className="font-normal">Trader</th><th className="font-normal">Copy score</th><th className="text-right font-normal">PnL 30D</th><th className="text-right font-normal">ROI 30D</th><th className="text-right font-normal">PnL 7D</th><th className="text-right font-normal">Account</th><th className="text-right font-normal">Trades</th><th className="pl-4 font-normal">Open now</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.address} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                  <td className="num py-1.5 pr-2 text-ink-muted">{i + 1}</td>
                  <td className="max-w-[240px] pr-3"><AddressLink address={r.address} label={r.label} compact /></td>
                  <td className="pr-3"><ScoreBar score={r.score} title={r.parts.map((x) => `${x.label} ${x.points >= 0 ? '+' : ''}${x.points}: ${x.detail}`).join('\n')} /></td>
                  <td className="num text-right font-bold" style={tone(r.pnl30 ?? 0)}>{usd(r.pnl30, { signed: true })}</td>
                  <td className="num text-right" style={r.roi30 == null ? undefined : tone(r.roi30)}>{r.roi30 == null ? 'n/a' : p(r.roi30)}</td>
                  <td className="num text-right" style={r.pnl7 == null ? undefined : tone(r.pnl7)}>{r.pnl7 == null ? '·' : usd(r.pnl7, { signed: true })}</td>
                  <td className="num text-right text-ink-2">{usd(r.accountValue)}</td>
                  <td className="num text-right text-ink-2">{r.trades30?.toLocaleString('en-US') ?? 'n/a'}</td>
                  <td className="pl-4"><span className="flex flex-wrap gap-1">{r.positions.slice(0, 3).map((x) => <Link prefetch={false} key={`${x.coin}:${x.side}`} href={`/perps/${encodeURIComponent(x.coin)}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-1.5 py-px text-[11px] hover:underline"><TokenLogo symbol={x.coin} coin={x.coin} size={14} />{x.coin}<span style={{ color: /short/i.test(x.side) ? 'var(--flare)' : 'var(--mint)' }}>{/short/i.test(x.side) ? 'S' : 'L'}</span></Link>)}{!r.positions.length && <span className="text-ink-muted">none</span>}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

function PredictView({ predict }: { predict: PmLeaders | Un }) {
  if (un(predict)) return <Section id="predict" title="Prediction traders to follow" className="xl:col-span-12"><Unavailable what="Polymarket trader records" u={predict} /></Section>;
  const ls = predict.leaders;
  const skilled = ls.filter((l) => (l.marketsTraded ?? 0) >= 10 && (l.totalPnl ?? 0) > 0 && (l.winRate ?? 0) >= 0.55).length;
  return (
    <>
      <StatStrip className="xl:col-span-12" stats={[
        { label: 'Polymarket winners checked', value: String(ls.length), note: `biggest winners in the ${predict.marketsRead} busiest markets` },
        { label: 'Copy score 65+', value: String(ls.filter((l) => l.score >= 65).length), tone: 'in' },
        { label: 'Proven record', value: String(skilled), note: '10+ markets, 55%+ won, in profit', tone: 'in' },
      ]} />
      <Section id="predict" title="Prediction traders to follow" sub="Lifetime Polymarket record, via Nansen · ranked by copy score" className="xl:col-span-12">
        {ls.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Prediction traders to follow">
            <table data-sortable className="w-full min-w-[960px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr>
                <th className="py-2 pr-2 font-normal">#</th><th className="font-normal">Trader</th><th className="font-normal">Copy score</th><th className="text-right font-normal">Lifetime PnL</th><th className="text-right font-normal">Win rate</th><th className="text-right font-normal">Markets</th><th className="pl-4 font-normal">Winning now in</th>
              </tr></thead>
              <tbody>
                {ls.map((l, i) => (
                  <tr key={l.address} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                    <td className="num py-1.5 pr-2 text-ink-muted">{i + 1}</td>
                    <td className="max-w-[240px] pr-3"><AddressLink address={l.address} compact /></td>
                    <td className="pr-3"><ScoreBar score={l.score} title={Object.entries(l.parts).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v}`).join(' · ')} /></td>
                    <td className="num text-right font-bold" style={l.totalPnl == null ? undefined : tone(l.totalPnl)}>{usd(l.totalPnl, { signed: true })}</td>
                    <td className="num text-right text-ink">{l.winRate == null ? 'n/a' : `${Math.round(l.winRate * 100)}%`}</td>
                    <td className="num text-right text-ink-2">{l.marketsTraded ?? 'n/a'}</td>
                    <td className="max-w-[420px] pl-4">{l.wins.slice(0, 2).map((x) => <Link prefetch={false} key={x.id} href={`/predict/${encodeURIComponent(x.id)}`} className="block truncate text-ink-2 hover:underline"><span className="num font-semibold" style={tone(x.pnlUsd)}>{usd(x.pnlUsd, { signed: true })}</span> {x.side ? `${x.side} · ` : ''}{x.question}</Link>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="py-3 text-[12.5px] text-ink-muted">No winners found in the busiest markets right now.</p>}
      </Section>
    </>
  );
}

function CohortView({ cohorts, compact }: { cohorts: Cohorts | Un; compact: boolean }) {
  if (un(cohorts)) return <Section id="cohorts" title="What KOLs, whales and top traders are buying" className="xl:col-span-12"><Unavailable what="Nansen cohort flows" u={cohorts} /></Section>;
  const boards = cohortBoards(cohorts, compact ? 3 : 6);
  const shown = compact ? COHORTS.filter((c) => c !== 'fresh_wallets') : COHORTS;
  const row = (r: (typeof boards)[keyof typeof boards]['buying'][number]) => (
    <li key={`${r.chain}:${r.token}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1.5 text-[12.5px]">
      <Link prefetch={false} href={`/token/${r.chain}/${encodeURIComponent(r.token)}`} className="flex min-w-0 items-center gap-2 hover:underline"><TokenLogo symbol={r.symbol} chain={r.chain} address={r.token} size={16} /><span className="truncate font-semibold text-ink">{r.symbol ?? r.token.slice(0, 6)}</span><span className="text-[11px] text-ink-muted">{chainName(r.chain)}</span></Link>
      <span className="num text-right"><span className="font-bold" style={tone(r.cell.netUsd)}>{usd(r.cell.netUsd, { signed: true })}</span>{r.cell.wallets != null && <span className="ml-1.5 text-[11px] text-ink-muted">{r.cell.wallets}w</span>}</span>
    </li>
  );
  return (
    <Section id="cohorts" title="What KOLs, whales and top traders are buying" sub={`Nansen cohort net flow, 24h · ${cohorts.tokens.length} busy tokens read`} className="xl:col-span-12">
      <div className={`grid gap-4 ${compact ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
        {shown.map((c) => (
          <div key={c} className="min-w-0 rounded-[var(--r-inner)] border border-[var(--hair)] p-3">
            <h3 className="text-[13px] font-bold text-ink">{COHORT_LABEL[c]}</h3>
            <p className="mb-1.5 text-[11.5px] text-ink-muted">{COHORT_NOTE[c]}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--mint)]">Buying</p>
            <ol className="divide-y divide-[var(--hair)]">{boards[c].buying.map(row)}{!boards[c].buying.length && <li className="py-1.5 text-[12px] text-ink-muted">No net buying among these tokens.</li>}</ol>
            {!compact && <>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--flare)]">Selling</p>
              <ol className="divide-y divide-[var(--hair)]">{boards[c].selling.map(row)}{!boards[c].selling.length && <li className="py-1.5 text-[12px] text-ink-muted">No net selling among these tokens.</li>}</ol>
            </>}
          </div>
        ))}
      </div>
      {compact && <p className="mt-3 text-[11.5px] text-ink-muted"><Link prefetch={false} href="/copy?m=cohorts" className="font-semibold text-[var(--mint)] hover:underline">All cohorts, buying and selling →</Link></p>}
    </Section>
  );
}

/** The late-entry test: how much of the spot edge is left when you see the trade late. */
function LateEntry({ lab, className = '' }: { lab: CopyLab; className?: string }) {
  const d = lab.decay;
  const maxAbs = Math.max(0.001, ...d.mean.map(Math.abs));
  return (
    <Section id="decay" title="If you see the trade late" sub="24h return of Smart Money buys ($1K+) by entry delay" className={className}>
      {lab.buysMeasured ? (
        <ol className="grid gap-4 sm:grid-cols-4">
          {LAGS.map((_, i) => (
            <li key={i}>
              <div className="flex items-baseline justify-between text-[12.5px]"><span className="font-semibold text-ink">{LAG_LABEL[i]}</span><span className="num"><span className="font-bold" style={tone(d.mean[i])}>{p(d.mean[i])}</span><span className="ml-2 text-ink-muted">win {Math.round(d.win[i] * 100)}%</span></span></div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${(Math.abs(d.mean[i]) / maxAbs) * 100}%`, background: d.mean[i] >= 0 ? 'var(--mint)' : 'var(--flare)', opacity: 1 - i * 0.18 }} /></div>
            </li>
          ))}
          <li className="num text-[11.5px] text-ink-muted sm:col-span-4">{lab.buysMeasured.toLocaleString('en-US')} buys · {lab.walletsScored} wallets</li>
        </ol>
      ) : (
        <p className="text-[12.5px] text-ink-muted">Collecting data · first results 24h after {new Date(lab.window.from).toISOString().slice(0, 10)}.</p>
      )}
    </Section>
  );
}

function Method({ m, spot, perps, predict, cohorts }: { m: Market; spot: Leaders | Un | null; perps: PerpLeaders | Un | null; predict: PmLeaders | Un | null; cohorts: Cohorts | Un | null }) {
  const reads = (spot && !un(spot) ? spot.calls.length : 0) + (perps && !un(perps) ? perps.provenance.calls.length : 0) + (predict && !un(predict) ? predict.calls.length : 0) + (cohorts && !un(cohorts) ? cohorts.calls.length : 0);
  const src = [
    (m === 'all' || m === 'spot') && 'Smart Money PnL leaderboard (7/30/90D)',
    (m === 'all' || m === 'perps') && 'Hyperliquid leaderboard (30D)',
    (m === 'all' || m === 'predict') && 'Polymarket records',
    (m === 'all' || m === 'cohorts') && 'cohort flows (24h)',
  ].filter(Boolean).join(' · ');
  return (
    <p className="text-[11.5px] text-ink-muted xl:col-span-12">
      Source: Nansen {src} · {reads} reads, cached 30 min · Copy score 0–100 rewards repeated, realized, diversified profit and penalises one-trade luck, bots and high leverage. Past performance is not indicative of future results.
    </p>
  );
}
