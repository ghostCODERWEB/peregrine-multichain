import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@/components/Card';
import { ChainLogo } from '@/components/Logo';
import { FlowsView } from '@/components/weather/FlowsView';
import { capitalFlows, flowHistory } from '@/server/weather/bulletin';
import { weatherMap } from '@/server/weather/queries';
import { displayMode, viewOf } from '@/server/mode';
import { chainName, usd } from '@/lib/viz/format';
import { PageTitle } from '@/components/PageTitle';
import { Go } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Capital Flows · Peregrine' };

// P4: Capital Flows as its own page — the animated chain-to-chain map with
// room, a 7-day rotation timeline and a chain leaderboard. All of it is read
// from the owner's stored smart-money trades: no Nansen call, owner view only.
export default async function FlowsPage() {
  const view = viewOf(await displayMode());
  const now = Date.now();
  const flows = capitalFlows(view, 24, now);
  const history = flowHistory(view, 7, now);
  const weather = weatherMap(now, view);
  const chains = weather.map((c) => ({ chain: c.chain, cpi: c.cpi }));
  // Public view: measured per-chain net flow, the only flow data Nansen lets a public page show.
  const netChains = weather.map((c) => ({ chain: c.chain, cpi: c.cpi, windows: c.windows.map((w) => ({ window: w.window, netFlowUsd: w.netFlowUsd })) }));
  const maxDay = Math.max(1, ...(history?.days ?? []).map((d) => d.netUsd));
  const maxChain = Math.max(1, ...(history?.chains ?? []).map((c) => Math.abs(c.net)));
  const weekTotal = (history?.days ?? []).reduce((s, d) => s + d.netUsd, 0);

  return (
    <div className="space-y-5">
      <PageTitle title="Capital Flows" pill={flows ? 'Owner view · wallet rotations' : 'All traders · last 24 hours'} />

      <FlowsView initial={{fronts:flows?.fronts ?? [],chains,withheld:flows == null ? ['fronts'] : []}} netChains={netChains} />

      {history && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card id="flow-days" title={weekTotal ? `${usd(weekTotal)} rotated between chains in 7 days` : 'No capital rotations in 7 days'}
            sub="Each UTC day's own rotations, net USD; the label is that day's largest flow.">
            {/* One column per UTC day. Days before the scanner's first trade are
                hatched and say so: missing is never drawn as zero. */}
            <ol className="flex items-end gap-1.5 sm:gap-2" aria-label="Rotations by day">
              {history.days.map((d, i) => {
                const last = i === history.days.length - 1;
                const h = d.flows ? Math.max(14, Math.round((d.netUsd / maxDay) * 150)) : 0;
                return (
                  <li key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
                    <div className="flex h-[176px] w-full flex-col items-center justify-end gap-1.5">
                      {d.flows ? <>
                        <span className="num text-[12px] font-extrabold text-ink sm:text-[14px]">{usd(d.netUsd)}</span>
                        <span className="w-full max-w-11 rounded-[12px]" style={{ height: h, background: 'linear-gradient(180deg, var(--mint), color-mix(in srgb, var(--mint-2) 25%, transparent))', boxShadow: d.netUsd === maxDay ? 'inset 0 1px 0 rgb(255 255 255 / .5), 0 0 24px color-mix(in srgb, var(--mint) 35%, transparent)' : 'inset 0 1px 0 rgb(255 255 255 / .4)' }} />
                      </> : d.recorded
                        ? <><span className="text-[11px] text-ink-muted">no flows</span><span className="h-1.5 w-full max-w-11 rounded-full bg-raised" /></>
                        : <span className="h-full w-full max-w-11 rounded-[12px] border border-dashed border-[var(--hair-2)]" style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 6px, var(--hair) 6px 12px)' }} />}
                    </div>
                    <span className={`num text-[11.5px] font-bold ${last ? 'text-ink' : 'text-ink-2'}`}>{last ? 'Today' : d.day.slice(5)}</span>
                    {d.top
                      ? <span className="flex items-center gap-0.5" title={`${chainName(d.top.from)} to ${chainName(d.top.to)}`}><ChainLogo chain={d.top.from} size={14} /><span className="text-[10px] text-ink-muted"><Go /></span><ChainLogo chain={d.top.to} size={14} /></span>
                      : <span className="text-[10.5px] leading-tight text-ink-muted">{d.recorded ? 'n/a' : 'not recorded'}</span>}
                  </li>
                );
              })}
            </ol>
            {history.days.some((d) => !d.recorded) && (
              <p className="inset-well mt-4 px-3 py-2 text-[12px] text-ink-2">Hatched days came before the scanner&apos;s first recorded trade: not recorded, never zero.</p>
            )}
          </Card>

          <Card id="flow-chains" title={history.chains[0] ? `${chainName(history.chains[0].chain)} drew the most rotated capital this week` : 'Chains by rotated capital'}
            sub="Net USD rotated in minus out over 7 days, from every flow above.">
            {history.chains.length ? (
              <ul className="divide-y divide-[var(--hair)]" aria-label="Chains by net rotated capital">
                {history.chains.map((c, i) => (
                  <li key={c.chain} className="grid h-12 grid-cols-[18px_minmax(0,130px)_minmax(0,1fr)_84px] items-center gap-3 text-[14px]">
                    <span className="num text-[12.5px] font-bold text-ink-muted">{i + 1}</span>
                    <Link href={`/chain/${c.chain}`} className="flex min-w-0 items-center gap-2.5 truncate font-bold text-ink hover:underline"><ChainLogo chain={c.chain} size={24} />{chainName(c.chain)}</Link>
                    <span className="relative h-2.5 rounded bg-raised" aria-hidden>
                      <span className="absolute inset-y-0 left-1/2 w-px bg-axis" />
                      <span className="absolute inset-y-0 rounded" style={c.net >= 0
                        ? { left: '50%', width: `${(c.net / maxChain) * 50}%`, background: 'var(--in-3)' }
                        : { right: '50%', width: `${(-c.net / maxChain) * 50}%`, background: 'var(--out-3)' }} />
                    </span>
                    <span className="num text-right font-extrabold" style={{ color: c.net >= 0 ? 'var(--in-3)' : 'var(--out-3)' }}>{c.net >= 0 ? '▲ +' : '▼ −'}{usd(Math.abs(c.net))}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-ink-2">No chain took part in a rotation this week.</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
