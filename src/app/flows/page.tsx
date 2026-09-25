import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@/components/Card';
import { ChainLogo } from '@/components/Logo';
import { CapitalFlows } from '@/components/weather/CapitalFlows';
import { capitalFlows, flowHistory } from '@/server/weather/bulletin';
import { weatherMap } from '@/server/weather/queries';
import { displayMode, viewOf } from '@/server/mode';
import { chainName, usd } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Capital Flows — Peregrine' };

// P4: Capital Flows as its own page — the animated chain-to-chain map with
// room, a 7-day rotation timeline and a chain leaderboard. All of it is read
// from the owner's stored smart-money trades: no Nansen call, owner view only.
export default async function FlowsPage() {
  const view = viewOf(await displayMode());
  const now = Date.now();
  const flows = capitalFlows(view, 24, now);
  const history = flowHistory(view, 7, now);
  const chains = weatherMap(now, view).map((c) => ({ chain: c.chain, cpi: c.cpi }));
  const maxDay = Math.max(1, ...(history?.days ?? []).map((d) => d.netUsd));
  const maxChain = Math.max(1, ...(history?.chains ?? []).map((c) => Math.abs(c.net)));
  const weekTotal = (history?.days ?? []).reduce((s, d) => s + d.netUsd, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Capital Flows</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-ink-2">Where smart money moves between chains: the same wallets selling on one chain and buying on another within 12h.</p>
      </div>

      <CapitalFlows initial={flows?.fronts ?? []} chains={chains} withheld={flows == null} />

      {history && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card id="flow-days" title={weekTotal ? `${usd(weekTotal)} rotated between chains in 7 days` : 'No capital rotations in 7 days'}
            sub="Each UTC day's own rotations, net USD; the label is that day's largest flow.">
            <ol className="space-y-1.5" aria-label="Rotations by day">
              {history.days.map((d) => (
                <li key={d.day} className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,170px)] items-center gap-3 text-[12px]">
                  <span className="num text-ink-muted">{d.day.slice(5)}</span>
                  <span className="relative h-5 overflow-hidden rounded bg-raised">
                    <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(d.netUsd / maxDay) * 100}%`, background: 'linear-gradient(90deg, var(--out-3), var(--in-3))' }} />
                    <span className={`num relative px-2 leading-5 ${d.recorded ? 'text-ink' : 'text-ink-muted'}`}>{d.flows ? usd(d.netUsd) : d.recorded ? '—' : 'not recorded'}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1 truncate text-ink-2">
                    {d.top ? <><ChainLogo chain={d.top.from} size={12} />{chainName(d.top.from)} → <ChainLogo chain={d.top.to} size={12} />{chainName(d.top.to)}</> : <span className="text-ink-muted">{d.recorded ? 'no flows' : 'scanner not running yet'}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <Card id="flow-chains" title={history.chains[0] ? `${chainName(history.chains[0].chain)} drew the most rotated capital this week` : 'Chains by rotated capital'}
            sub="Net USD rotated in minus out over 7 days, from every flow above.">
            {history.chains.length ? (
              <ul className="space-y-1.5" aria-label="Chains by net rotated capital">
                {history.chains.map((c) => (
                  <li key={c.chain} className="grid grid-cols-[130px_minmax(0,1fr)_90px] items-center gap-3 text-[12.5px]">
                    <Link href={`/chain/${c.chain}`} className="flex min-w-0 items-center gap-1.5 truncate text-ink hover:underline"><ChainLogo chain={c.chain} size={16} />{chainName(c.chain)}</Link>
                    <span className="relative h-2.5 rounded bg-raised" aria-hidden>
                      <span className="absolute inset-y-0 left-1/2 w-px bg-axis" />
                      <span className="absolute inset-y-0 rounded" style={c.net >= 0
                        ? { left: '50%', width: `${(c.net / maxChain) * 50}%`, background: 'var(--in-3)' }
                        : { right: '50%', width: `${(-c.net / maxChain) * 50}%`, background: 'var(--out-3)' }} />
                    </span>
                    <span className="num text-right" style={{ color: c.net >= 0 ? 'var(--in-3)' : 'var(--out-3)' }}>{c.net >= 0 ? '▲ +' : '▼ −'}{usd(Math.abs(c.net))}</span>
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
