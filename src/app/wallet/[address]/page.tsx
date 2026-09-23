import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, WaveLoading, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { BalanceDonut } from '@/components/wallet/BalanceDonut';
import { TrailMap } from '@/components/wallet/TrailMap';
import { trailTitle } from '@/lib/insights';
import { TimeAgo } from '@/components/TimeAgo';
import { balances, pnl, origins, counterparties, transactions, migrationTrail, type Balances } from '@/server/wallet/wallet-page';
import { isUnavailable, type Wave } from '@/server/nansen/traced';
import { chainName, pct, shortAddress, usd, walletName } from '@/lib/viz/format';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { address } = await params;
  return { title: `${shortAddress(decodeURIComponent(address))} — TIDE wallet` };
}

// Every address family Nansen profiles is some run of letters, digits and
// a few separators; anything else is not an address.
const ADDRESS = /^[A-Za-z0-9:._-]{20,120}$/;

export default async function WalletRoute({ params }: Params) {
  const { address: raw } = await params;
  const address = decodeURIComponent(raw).trim();
  if (!ADDRESS.test(address)) notFound();

  const trail = migrationTrail(address);
  const balP = balances(address);
  const mainChainP = balP.then((b) => (isUnavailable(b) ? null : b.byChain[0]?.chain ?? null));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-[12.5px] text-ink-2 hover:text-ink">← Weather map</Link>
        <h1 className="mt-1 break-all text-xl font-semibold text-ink sm:text-2xl">{trail.label ? walletName(trail.label, address) : shortAddress(address)}</h1>
        <p className="num mt-1 break-all text-[12.5px] text-ink-2">{address}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<Card id="bal" title="Balances"><WaveLoading what="balances" height={300} /></Card>}>
          <BalancesCard p={balP} />
        </Suspense>
        <Card id="trail" className="lg:col-span-2" title={trailTitle(trail.steps, trail.chains)}
          sub="This wallet's smart-money DEX trades from TIDE's scanner record, as a path over the weather map (numbered in time order)."
          action={<InfoPopover p={trail.provenance} />}
        >
          {trail.steps.length ? <TrailMap steps={trail.steps} /> : <Unavailable text="The scanner has not recorded a smart-money DEX trade by this wallet in the last 7 days. Only Nansen smart-money wallets appear in that feed." />}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<Card id="pnl" title="PnL, 30 days"><WaveLoading what="PnL" /></Card>}>
          <PnlCard address={address} />
        </Suspense>
        <Suspense fallback={<Card id="origins" title="Origins"><WaveLoading what="first funder and related wallets" /></Card>}>
          <OriginsCard address={address} mainChain={mainChainP} />
        </Suspense>
        <Suspense fallback={<Card id="cp" title="Counterparties"><WaveLoading what="counterparties" /></Card>}>
          <CounterpartiesCard address={address} mainChain={mainChainP} />
        </Suspense>
      </div>

      <Suspense fallback={<Card id="tx" title="Recent transactions"><WaveLoading what="transactions" /></Card>}>
        <TransactionsCard address={address} />
      </Suspense>
    </div>
  );
}

async function BalancesCard({ p }: { p: Promise<Wave<Balances>> }) {
  const b = await p;
  if (isUnavailable(b)) return <Card id="bal" title="Balances"><Unavailable text={b.unavailable} /></Card>;
  const top = b.byChain[0];
  return (
    <Card id="bal" title={`${usd(b.totalUsd)} across ${b.byChain.length} chain${b.byChain.length === 1 ? '' : 's'} — ${pct(top.valueUsd / b.totalUsd, 0)} on ${chainName(top.chain)}`}
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

async function PnlCard({ address }: { address: string }) {
  const r = await pnl(address);
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

async function OriginsCard({ address, mainChain }: { address: string; mainChain: Promise<string | null> }) {
  const r = await origins(address, await mainChain);
  if (isUnavailable(r)) return <Card id="origins" title="Origins"><Unavailable text={r.unavailable} /></Card>;
  const f = r.firstFunder;
  const title = f ? `First funded by ${walletName(f.name, f.address)} on ${chainName(f.chain)}` : 'Origins';
  return (
    <Card id="origins" title={title} sub="Who sent this wallet its first gas, and the wallets Nansen relates to it." action={<InfoPopover p={r.provenance} />}>
      {f ? (
        <p className="text-[12.5px] text-ink-2">
          <Link href={`/wallet/${f.address}`} className="num text-ink hover:underline">{shortAddress(f.address)}</Link> on {chainName(f.chain)}, {f.at.slice(0, 10)}
        </p>
      ) : <p className="text-[12.5px] text-ink-muted">{r.firstFunderNote}</p>}
      <div className="mt-3 text-[12px] text-ink-2">Related wallets{r.relatedChain ? ` on ${chainName(r.relatedChain)}` : ''}</div>
      {r.related.length ? (
        <ul className="mt-1 max-h-[220px] space-y-1 overflow-y-auto text-[12px]">
          {r.related.map((x, i) => (
            <li key={`${x.address}-${i}`} className="flex justify-between gap-2 border-b border-border/50 py-0.5">
              <Link href={`/wallet/${x.address}`} className="truncate text-ink hover:underline">{walletName(x.label, x.address)}</Link>
              <span className="shrink-0 text-ink-muted">{x.relation}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-[12px] text-ink-muted">None in Nansen.</p>}
    </Card>
  );
}

async function CounterpartiesCard({ address, mainChain }: { address: string; mainChain: Promise<string | null> }) {
  const r = await counterparties(address, await mainChain);
  if (isUnavailable(r)) return <Card id="cp" title="Counterparties"><Unavailable text={r.unavailable} /></Card>;
  const top = r.rows[0];
  const max = Math.max(1, ...r.rows.map((x) => Math.max(x.inUsd, x.outUsd)));
  return (
    <Card id="cp" title={`Trades most with ${walletName(top.label, top.address)} on ${chainName(r.chain)}`} sub="Top 10 counterparties by volume, 30 days: sent to this wallet (right) and sent by it (left)." action={<InfoPopover p={r.provenance} />}>
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

async function TransactionsCard({ address }: { address: string }) {
  const r = await transactions(address);
  if (isUnavailable(r)) return <Card id="tx" title="Recent transactions"><Unavailable text={r.unavailable} /></Card>;
  return (
    <Card id="tx" title={`${r.rows.length} transactions in the last 7 days`} sub="Newest first, across chains; spam tokens hidden." action={<InfoPopover p={r.provenance} />}>
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
              <th className="py-1.5 font-normal">When</th><th className="py-1.5 font-normal">Chain</th><th className="py-1.5 font-normal">Sent</th><th className="py-1.5 font-normal">Received</th><th className="py-1.5 text-right font-normal">USD</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((t) => (
              <tr key={t.hash + t.at} className="border-b border-border/50 align-top">
                <td className="num py-1.5 text-ink-muted"><TimeAgo ts={Date.parse(t.at)} /></td>
                <td className="py-1.5 text-ink-2">{chainName(t.chain)}</td>
                <td className="py-1.5 text-ink">{t.sent.join(', ') || '—'}</td>
                <td className="py-1.5 text-ink">{t.received.join(', ') || '—'}</td>
                <td className="num py-1.5 text-right text-ink">{usd(t.volumeUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
