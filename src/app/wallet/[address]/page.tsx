import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Card, WaveLoading, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { BalancesCard, PnlCard, CounterpartiesCard } from '@/components/wallet/ProfileCards';
import { TrailMap } from '@/components/wallet/TrailMap';
import { trailTitle } from '@/lib/insights';
import { TimeAgo } from '@/components/TimeAgo';
import { balances, pnl, origins, counterparties, transactions, migrationTrail } from '@/server/wallet/wallet-page';
import { isUnavailable } from '@/server/nansen/traced';
import { displayMode, type DisplayMode } from '@/server/mode';
import { forMode, redacted } from '@/server/redact';
import { chainName, shortAddress, usd, walletName } from '@/lib/viz/format';

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

  const mode = await displayMode();
  // Public views: labels stripped from every section. The trail is built
  // from the scanner's smart-money DEX trades (the operator's key): the
  // owner's view only.
  const trail = forMode(mode, migrationTrail(address));
  const balP = balances(address);
  const mainChainP = balP.then((b) => (isUnavailable(b) ? null : b.byChain[0]?.chain ?? null));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-[12.5px] text-ink-2 hover:text-ink">← Weather map</Link>
        <h1 className="mt-1 break-all text-xl font-semibold text-ink sm:text-2xl">{mode === 'owner' && trail.label ? walletName(trail.label, address) : shortAddress(address)}</h1>
        <p className="num mt-1 break-all text-[12.5px] text-ink-2">{address}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<Card id="bal" title="Balances"><WaveLoading what="balances" height={300} /></Card>}>
          <BalancesCard p={redacted(mode, balP)} />
        </Suspense>
        <Card id="trail" className="lg:col-span-2" title={mode !== 'owner' ? 'Migration trail' : trailTitle(trail.steps, trail.chains)}
          sub="This wallet's smart-money DEX trades from TIDE's scanner record, as a path over the weather map (numbered in time order)."
          action={<InfoPopover p={trail.provenance} />}
        >
          {mode !== 'owner'
            ? <Unavailable text="Shown only to the API key owner: the trail is built from Nansen smart-money DEX trades, which Nansen's redistribution rules keep out of public views." />
            : trail.steps.length ? <TrailMap steps={trail.steps} /> : <Unavailable text="The scanner has not recorded a smart-money DEX trade by this wallet in the last 7 days. Only Nansen smart-money wallets appear in that feed." />}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<Card id="pnl" title="PnL, 30 days"><WaveLoading what="PnL" /></Card>}>
          <PnlCard p={redacted(mode, pnl(address))} mode={mode} />
        </Suspense>
        <Suspense fallback={<Card id="origins" title="Origins"><WaveLoading what="first funder and related wallets" /></Card>}>
          <OriginsCard address={address} mainChain={mainChainP} mode={mode} />
        </Suspense>
        <Suspense fallback={<Card id="cp" title="Counterparties"><WaveLoading what="counterparties" /></Card>}>
          <CounterpartiesCard p={redacted(mode, mainChainP.then((c) => counterparties(address, c)))} mode={mode} />
        </Suspense>
      </div>

      <Suspense fallback={<Card id="tx" title="Recent transactions"><WaveLoading what="transactions" /></Card>}>
        <TransactionsCard address={address} mode={mode} />
      </Suspense>
    </div>
  );
}

async function OriginsCard({ address, mainChain, mode }: { address: string; mainChain: Promise<string | null>; mode: DisplayMode }) {
  const r = forMode(mode, await origins(address, await mainChain));
  if (isUnavailable(r)) return <Card id="origins" title="Origins"><Unavailable text={r.unavailable} /></Card>;
  const f = r.firstFunder;
  const title = f ? `First funded by ${walletName(f.funderName, f.address)} on ${chainName(f.chain)}` : 'Origins';
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

async function TransactionsCard({ address, mode }: { address: string; mode: DisplayMode }) {
  const r = forMode(mode, await transactions(address));
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
