import Link from 'next/link';
import type { Metadata } from 'next';
import { PageTitle } from '@/components/PageTitle';
import { SYMBOL_RE } from '@/server/perps/detail';
import { perpChanges, perpTerminal } from '@/server/perps/terminal';
import { contextScope, requestContext } from '@/server/context';
import { displayMode } from '@/server/mode';
import { forMode } from '@/server/redact';
import { cohortMatrix, crowding, liquidationBands, totalUsd } from '@/lib/perps/liquidation';
import { DIRECTION_TEXT } from '@/lib/perps/changes';
import { num, pct, price, usd } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Compare perps · Peregrine' };

/** Compare mode: two coins side by side on the same observed-position measures. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const q = await searchParams;
  const a = (q.a ?? 'BTC').toUpperCase(), b = (q.b ?? 'ETH').toUpperCase();
  if (!SYMBOL_RE.test(a) || !SYMBOL_RE.test(b)) return <p className="text-[13px] text-ink-2">Choose two coin symbols, for example /perps/compare?a=BTC&amp;b=ETH.</p>;
  const mode = await displayMode();
  const ctx = await requestContext();
  const priv = mode !== 'public';
  const load = async (sym: string) => {
    const d = forMode(mode, await contextScope.run(ctx, () => perpTerminal(sym, priv)));
    const mark = d.mark ?? 0;
    const matrix = cohortMatrix(d.positions, mark, ['all', ...d.cohorts]);
    const { bands } = liquidationBands(d.positions, mark, 0.005, 0.15);
    const below = bands.filter((x) => x.hi <= mark).sort((p, r) => totalUsd(r) - totalUsd(p))[0];
    const above = bands.filter((x) => x.lo >= mark).sort((p, r) => totalUsd(r) - totalUsd(p))[0];
    const ch = perpChanges(sym, 4 * 3_600_000);
    return { sym, d, mark, all: matrix[0], sm: matrix.find((r) => r.cohort === 'smart_money'), whale: matrix.find((r) => r.cohort === 'whale'), crowd: crowding(d.positions), below, above, shift: 'unavailable' in ch ? null : ch.shift.smart_money ?? ch.shift.all };
  };
  // One coin's feed failing should not take the page down: say which one and why.
  const settled = await Promise.allSettled([load(a), load(b)]);
  const failed = settled.map((r, i) => (r.status === 'rejected' ? `${[a, b][i]}: ${String((r.reason as Error)?.message ?? r.reason).slice(0, 140)}` : null)).filter(Boolean);
  if (failed.length) return (
    <div className="space-y-4">
      <PageTitle title={`${a} vs ${b}`} pill="Compare observed perp positioning" />
      <p role="alert" className="material p-5 text-[13px] text-ink-2">Positions could not be read right now. {failed.join(' · ')}</p>
    </div>
  );
  const [A, B] = settled.map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof load>>>).value);
  const rows: Array<[string, (x: typeof A) => React.ReactNode]> = [
    ['Mark', (x) => price(x.mark)],
    ['Observed exposure', (x) => `${usd(x.crowd.totalUsd)} · ${x.crowd.traders} traders`],
    ['Long share (all)', (x) => pct(x.all.longShare, 0)],
    ['Smart Money long share', (x) => (x.sm ? `${pct(x.sm.longShare, 0)} · ${x.sm.traders} traders` : 'owner view')],
    ['Smart Money net', (x) => (x.sm ? usd(x.sm.longUsd - x.sm.shortUsd, { signed: true }) : 'owner view')],
    ['Whale long share', (x) => (x.whale ? `${pct(x.whale.longShare, 0)} · ${x.whale.traders} traders` : 'owner view')],
    ['Top 10 hold', (x) => pct(x.crowd.top10Share, 0)],
    ['Median leverage', (x) => (x.all.medianLeverage ? `${num(x.all.medianLeverage, 1)}x` : 'n/a')],
    ['Within 5% of liquidation', (x) => usd(x.all.nearLiqUsd)],
    ['Densest long liquidation band', (x) => (x.below ? <Link prefetch={false} href={`/perps/${x.sym}?band=${x.below.lo}_${x.below.hi}`} className="hover:underline">{usd(totalUsd(x.below))} at {price(x.below.lo)} ({pct(Math.abs(x.below.distance), 1)} below)</Link> : 'n/a')],
    ['Densest short liquidation band', (x) => (x.above ? <Link prefetch={false} href={`/perps/${x.sym}?band=${x.above.lo}_${x.above.hi}`} className="hover:underline">{usd(totalUsd(x.above))} at {price(x.above.lo)} ({pct(x.above.distance, 1)} above)</Link> : 'n/a')],
    ['Smart Money shift, 4h', (x) => (x.shift ? DIRECTION_TEXT[x.shift.direction] : 'needs history')],
    ['Data', (x) => `${new Date(x.d.at).toISOString().slice(11, 16)} UTC`],
  ];
  return (
    <div className="space-y-4">
      <PageTitle title={`${a} vs ${b}`} pill="Compare observed perp positioning" />
      <form className="flex flex-wrap items-center gap-2 text-[13px]" action="/perps/compare">
        <input name="a" defaultValue={a} aria-label="First coin" className="inset-well h-9 w-24 rounded-[8px] px-2 font-semibold uppercase" />
        <span className="text-ink-muted">vs</span>
        <input name="b" defaultValue={b} aria-label="Second coin" className="inset-well h-9 w-24 rounded-[8px] px-2 font-semibold uppercase" />
        <button type="submit" className="pill-button pill-secondary min-h-9 px-4 py-1 text-[12.5px]">Compare</button>
      </form>
      <div tabIndex={0} role="region" aria-label="Comparison" className="material overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead className="text-[12px] text-ink-muted"><tr><th className="px-4 py-3 text-left font-semibold">Measure</th>{[A, B].map((x) => <th key={x.sym} className="px-4 py-3 text-right"><Link prefetch={false} href={`/perps/${x.sym}`} className="text-[15px] font-bold text-ink hover:underline">{x.sym}</Link></th>)}</tr></thead>
          <tbody>{rows.map(([k, f]) => <tr key={k} className="border-t border-[var(--hair)]"><th scope="row" className="px-4 py-2 text-left font-medium text-ink-2">{k}</th><td className="num px-4 text-right text-ink">{f(A)}</td><td className="num px-4 text-right text-ink">{f(B)}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="text-[11.5px] text-ink-muted">Observed positions only: the largest Nansen returns per cohort. Descriptive, not advice.</p>
    </div>
  );
}
