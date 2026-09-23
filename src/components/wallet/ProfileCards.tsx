// Profiler sections shared by the wallet page and the entity page: each
// takes its section's promise, so the page streams them independently.
import Link from 'next/link';
import { Card, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { BalanceDonut } from '@/components/wallet/BalanceDonut';
import { HoldingsTrendChart } from '@/components/wallet/HoldingsTrendChart';
import type { Balances, PnlSummary, Counterparties, HoldingsTrend } from '@/server/wallet/wallet-page';
import { isUnavailable, type Wave } from '@/server/nansen/traced';
import type { DisplayMode } from '@/server/mode';
import { forMode } from '@/server/redact';
import { chainName, pct, usd, walletName } from '@/lib/viz/format';

export async function BalancesCard({ p, what = 'Balances' }: { p: Promise<Wave<Balances>>; what?: string }) {
  const b = await p;
  if (isUnavailable(b)) return <Card id="bal" title={what}><Unavailable text={b.unavailable} /></Card>;
  const top = b.byChain[0];
  const share = top.valueUsd / b.totalUsd;
  // 99.6% would round to "100% on X" beside "9 chains"; say it plainly.
  const where = b.byChain.length === 1 ? `all on ${chainName(top.chain)}` : share >= 0.995 ? `nearly all on ${chainName(top.chain)}` : `${pct(share, 0)} on ${chainName(top.chain)}`;
  return (
    <Card id="bal" title={`${usd(b.totalUsd)} across ${b.byChain.length} chain${b.byChain.length === 1 ? '' : 's'} — ${where}`}
      sub="Current token balances Nansen can price, by chain." action={<InfoPopover p={b.provenance} />}>
      <BalanceDonut byChain={b.byChain} total={b.totalUsd} />
      <ul className="mt-2 space-y-1 text-[12.5px]">
        {b.top.slice(0, 6).map((t) => (
          <li key={`${t.chain}:${t.tokenAddress}`} className="flex justify-between gap-2 border-b border-border/50 py-0.5">
            <Link href={`/token/${t.chain}/${encodeURIComponent(t.tokenAddress)}`} className="truncate text-ink hover:underline">{t.symbol} <span className="text-ink-muted">· {chainName(t.chain)}</span></Link>
            <span className="num text-ink">{usd(t.valueUsd)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export async function PnlCard({ p, mode }: { p: Promise<Wave<PnlSummary>>; mode: DisplayMode }) {
  const r = forMode(mode, await p);
  if (isUnavailable(r)) return <Card id="pnl" title="PnL, 30 days"><Unavailable text={r.unavailable} /></Card>;
  const title = `${r.realizedUsd >= 0 ? 'Up' : 'Down'} ${usd(Math.abs(r.realizedUsd))} realized in 30 days, winning ${pct(r.winRate, 0)} of exits`;
  const max = Math.max(1, ...r.top.map((t) => Math.abs(t.pnlUsd ?? 0)));
  return (
    <Card id="pnl" title={title} sub="Realized only, as Nansen reports it; open positions are not marked." action={<InfoPopover p={r.provenance} />}>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[['Return', pct(r.realizedPct)], ['Tokens', String(r.tokens)], ['Sales', String(r.sales)]].map(([k, v]) => (
          <div key={k} className="rounded-md bg-accent/50 px-2 py-1.5"><dt className="text-[10.5px] text-ink-muted">{k}</dt><dd className="num text-sm text-ink">{v}</dd></div>
        ))}
      </dl>
      <div className="mt-3 text-[12px] text-ink-2">Best tokens by realized PnL</div>
      <ul className="mt-1 space-y-1">
        {r.top.map((t) => (
          <li key={`${t.chain}:${t.tokenAddress}`} className="grid grid-cols-[5rem_1fr_4.5rem] items-center gap-2 text-[12px]">
            <Link href={`/token/${t.chain}/${encodeURIComponent(t.tokenAddress)}`} className="truncate text-ink hover:underline">{t.symbol}</Link>
            <span className="h-2 rounded-full bg-accent"><span className="block h-2 rounded-full" style={{ width: `${(Math.abs(t.pnlUsd ?? 0) / max) * 100}%`, background: (t.pnlUsd ?? 0) >= 0 ? 'var(--in-3)' : 'var(--out-3)' }} /></span>
            <span className="num text-right text-ink">{usd(t.pnlUsd, { signed: true })}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export async function CounterpartiesCard({ p, mode }: { p: Promise<Wave<Counterparties>>; mode: DisplayMode }) {
  const r = forMode(mode, await p);
  if (isUnavailable(r)) return <Card id="cp" title="Counterparties"><Unavailable text={r.unavailable} /></Card>;
  const top = r.rows[0];
  const max = Math.max(1, ...r.rows.map((x) => Math.max(x.inUsd, x.outUsd)));
  return (
    <Card id="cp" title={`Trades most with ${walletName(top.label, top.address)} on ${chainName(r.chain)}`} sub="Top 10 counterparties by volume, 30 days: sent to this subject (right) and sent by it (left)." action={<InfoPopover p={r.provenance} />}>
      <ul className="space-y-1">
        {r.rows.map((x) => (
          <li key={x.address} className="grid grid-cols-[6.5rem_1fr] items-center gap-2 text-[12px]">
            <Link href={`/wallet/${x.address}`} className="block truncate text-ink-2 hover:text-ink hover:underline" title={x.label ?? x.address}>{walletName(x.label, x.address)}</Link>
            <div className="relative h-4">
              <div className="absolute inset-y-0 left-1/2 w-px bg-axis" aria-hidden />
              <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-l" style={{ right: '50%', width: `${(x.outUsd / max) * 48}%`, background: 'var(--out-3)' }} title={`sent ${usd(x.outUsd)}`} />
              <div className="absolute top-1/2 h-3 -translate-y-1/2 rounded-r" style={{ left: '50%', width: `${(x.inUsd / max) * 48}%`, background: 'var(--in-3)' }} title={`received ${usd(x.inUsd)}`} />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between text-[11px] text-ink-muted"><span>← sent</span><span>received →</span></div>
    </Card>
  );
}

export async function HoldingsTrendCard({ p }: { p: Promise<Wave<HoldingsTrend>> }) {
  const r = await p;
  if (isUnavailable(r)) return <Card id="trend" title="Holdings, 30 days"><Unavailable text={r.unavailable} /></Card>;
  const first = r.days[0].valueUsd, last = r.days.at(-1)!.valueUsd;
  const change = first > 0 ? last / first - 1 : null;
  const title = change == null
    ? `Today's top holdings on ${chainName(r.chain)}: ${usd(last)}`
    : `Today's top ${r.symbols.length} holdings on ${chainName(r.chain)} ${change >= 0 ? 'rose' : 'fell'} ${pct(Math.abs(change), 0)} in 30 days, to ${usd(last)}`;
  return (
    <Card id="trend" title={title} sub={`Daily value of ${r.symbols.join(', ')}: the tokens held today. Positions closed during the month are not in this line.`} action={<InfoPopover p={r.provenance} />}>
      <HoldingsTrendChart days={r.days} symbols={r.symbols} />
    </Card>
  );
}
