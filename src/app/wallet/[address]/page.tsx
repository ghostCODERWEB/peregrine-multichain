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
import { WalletDesk } from '@/components/wallet/WalletDesk';
import { TraderPanel } from '@/components/perps/TraderPanel';
import { WalletQuickRead } from '@/components/wallet/WalletQuickRead';
import { PredictionTraderPanel } from '@/components/predict/PredictionTraderPanel';
import { WalletTimeMachine } from '@/components/history/PointInTime';
import { seenInSnapshots } from '@/server/perps/trader';
import { WalletLabels } from '@/components/wallet/WalletLabels';
import { WalletWeather } from '@/components/wallet/WalletWeather';
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { detectAddress } from '@/lib/address-family';
import { balances, pnl, origins, counterparties, transactions, migrationTrail } from '@/server/wallet/wallet-page';
import { isUnavailable } from '@/server/nansen/traced';
import { displayMode, type DisplayMode } from '@/server/mode';
import { forMode, redacted } from '@/server/redact';
import { chainName, shortAddress, usd, walletName } from '@/lib/viz/format';
import { AskNansen } from '@/components/agent/AskNansen';
import { walletWeatherReading } from '@/server/wallet/weather';
import { walletRotations } from '@/server/weather/queries';
import { ChainLogo } from '@/components/Logo';
import { Go, Back } from '@/components/ui/Icons';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { address } = await params;
  return { title: `${shortAddress(decodeURIComponent(address))} · Peregrine wallet` };
}

// Every address family Nansen profiles is some run of letters, digits and
// a few separators; anything else is not an address.
const ADDRESS = /^[A-Za-z0-9:._-]{20,120}$/;

export default async function WalletRoute({ params }: Params) {
  const { address: raw } = await params;
  const address = decodeURIComponent(raw).trim();
  if (!ADDRESS.test(address) && !detectAddress(address).some((m) => m.profiled && !m.tokenOnly)) notFound();

  const mode = await displayMode();
  // Public views: labels stripped from every section. The trail is built
  // from the scanner's smart-money DEX trades (the operator's key): the
  // owner's view only.
  const trail = forMode(mode, migrationTrail(address));
  const balP = balances(address);
  const pnlP = pnl(address);
  const mainChainP = balP.then((b) => (isUnavailable(b) ? null : (b.byChain[0]?.chain ?? null)));
  const weatherP = Promise.all([balP, pnlP]).then(([b, p]) => walletWeatherReading(b, p));
  const evm = /^0x[a-fA-F0-9]{40}$/.test(address);
  // Owner view: a label Peregrine's own perp position reads already carry (free).
  const perpLabel = mode === 'owner' && evm ? (seenInSnapshots(address).find((x) => x.label)?.label ?? null) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/" className="text-[12.5px] text-ink-2 hover:text-ink">
            <Back /> Overview
          </Link>
          <h1 className="t-headline mt-1 break-all text-ink">
            {mode === 'owner' && trail.label ? walletName(trail.label, address) : perpLabel?.replace(/\s*\[[^\]]*\]$/, '') ?? shortAddress(address)}
          </h1>
          <p className="num mt-1 break-all text-[12.5px] text-ink-2">{address}</p>
        </div>
        <AskNansen subject={{ kind: 'wallet', address, chain: null }} label={`the wallet ${shortAddress(address)}`} />
      </div>

      {mode === 'owner' && <WalletQuickRead address={address} />}
      {evm && <TraderPanel address={address} />}
      {evm && <PredictionTraderPanel address={address} />}
      <Suspense fallback={<WalletTimeMachine address={address} current={null} />}>
        <WalletTimeMachineNow address={address} p={balP} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense
          fallback={
            <Card id="bal-loading" title="Balances">
              <WaveLoading what="balances" height={300} />
            </Card>
          }
        >
          <BalancesCard p={redacted(mode, balP)} />
        </Suspense>
        <Card
          id="trail"
          className="lg:col-span-2"
          title={mode !== 'owner' ? 'Migration trail' : trailTitle(trail.steps, trail.chains)}
          sub="This wallet's smart-money DEX trades from Peregrine's scanner record, as a path over the radar (numbered in time order)."
          action={<InfoPopover p={trail.provenance} />}
        >
          {mode !== 'owner' ? (
            <Unavailable text="Shown only to the API key owner: the trail is built from Nansen smart-money DEX trades, which Nansen's redistribution rules keep out of public views." />
          ) : trail.steps.length ? (
            <TrailMap steps={trail.steps} />
          ) : (
            <Unavailable text="The scanner has not recorded a smart-money DEX trade by this wallet in the last 7 days. Only Nansen smart-money wallets appear in that feed." />
          )}
        </Card>
      </div>

      <RotationsCard address={address} mode={mode} />

      <Suspense
        fallback={
          <Card id="wallet-weather-loading" title="Wallet profile">
            <WaveLoading what="wallet profile" height={280} />
          </Card>
        }
      >
        <WalletWeather p={redacted(mode, weatherP)} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense
          fallback={
            <Card id="pnl-loading" title="PnL, 30 days">
              <WaveLoading what="PnL" />
            </Card>
          }
        >
          <PnlCard p={redacted(mode, pnlP)} mode={mode} />
        </Suspense>
        <Suspense
          fallback={
            <Card id="origins-loading" title="Origins">
              <WaveLoading what="first funder and related wallets" />
            </Card>
          }
        >
          <OriginsCard address={address} mainChain={mainChainP} mode={mode} />
        </Suspense>
        <Suspense
          fallback={
            <Card id="cp-loading" title="Counterparties">
              <WaveLoading what="counterparties" />
            </Card>
          }
        >
          <CounterpartiesCard
            p={redacted(
              mode,
              mainChainP.then((c) => counterparties(address, c)),
            )}
            mode={mode}
          />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <Card id="tx-loading" title="Recent transactions">
            <WaveLoading what="transactions" />
          </Card>
        }
      >
        <TransactionsCard address={address} mode={mode} />
      </Suspense>
      <Suspense
        fallback={
          <Card id="wallet-desk-loading" title="Wallet desk">
            <WaveLoading what="wallet chain" />
          </Card>
        }
      >
        <Desk address={address} mainChain={mainChainP} />
      </Suspense>
      <WalletLabels address={address} enabled={mode !== 'public'} />
    </div>
  );
}

async function Desk({ address, mainChain }: { address: string; mainChain: Promise<string | null> }) {
  return <WalletDesk address={address} initialChain={(await mainChain) ?? 'ethereum'} chains={ALL_CHAIN_IDS} />;
}

async function OriginsCard({ address, mainChain, mode }: { address: string; mainChain: Promise<string | null>; mode: DisplayMode }) {
  const r = forMode(mode, await origins(address, await mainChain));
  if (isUnavailable(r))
    return (
      <Card id="origins" title="Origins">
        <Unavailable text={r.unavailable} />
      </Card>
    );
  const f = r.firstFunder;
  const title = f ? `First funded by ${walletName(f.funderName, f.address)} on ${chainName(f.chain)}` : 'Origins';
  return (
    <Card
      id="origins"
      title={title}
      sub="Who sent this wallet its first gas, and the wallets Nansen relates to it."
      action={<InfoPopover p={r.provenance} />}
    >
      {f ? (
        <p className="text-[12.5px] text-ink-2">
          <Link href={`/wallet/${f.address}`} className="num text-ink underline underline-offset-2">
            {shortAddress(f.address)}
          </Link>{' '}
          on {chainName(f.chain)}, {f.at.slice(0, 10)}
        </p>
      ) : (
        <p className="text-[12.5px] text-ink-muted">{r.firstFunderNote}</p>
      )}
      <div className="mt-3 text-[12px] text-ink-2">Related wallets{r.relatedChain ? ` on ${chainName(r.relatedChain)}` : ''}</div>
      {r.related.length ? (
        <ul tabIndex={0} aria-label="Scrollable list" className="mt-1 max-h-[220px] space-y-1 overflow-y-auto text-[12px]">
          {r.related.map((x, i) => (
            <li key={`${x.address}-${i}`} className="flex justify-between gap-2 border-b border-border/50 py-0.5">
              <Link href={`/wallet/${x.address}`} className="truncate text-ink hover:underline">
                {walletName(x.label, x.address)}
              </Link>
              <span className="shrink-0 text-ink-muted">{x.relation}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[12px] text-ink-muted">None in Nansen.</p>
      )}
    </Card>
  );
}

async function TransactionsCard({ address, mode }: { address: string; mode: DisplayMode }) {
  const r = forMode(mode, await transactions(address));
  if (isUnavailable(r))
    return (
      <Card id="tx" title="Recent transactions">
        <Unavailable text={r.unavailable} />
      </Card>
    );
  return (
    <Card
      id="tx"
      title={`${r.rows.length} transactions in the last 7 days`}
      sub="Newest first, across chains; spam tokens hidden."
      action={<InfoPopover p={r.provenance} />}
    >
      <div tabIndex={0} role="region" aria-label="Scrollable list" className="max-h-[360px] overflow-auto">
        <table data-sortable className="w-full min-w-[560px] text-[12.5px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
              <th className="py-1.5 font-normal">When</th>
              <th className="py-1.5 font-normal">Chain</th>
              <th className="py-1.5 font-normal">Sent</th>
              <th className="py-1.5 font-normal">Received</th>
              <th className="py-1.5 text-right font-normal">USD</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((t) => (
              <tr key={t.hash + t.at} className="border-b border-border/50 align-top">
                <td className="num py-1.5 text-ink-muted">
                  <TimeAgo ts={Date.parse(t.at)} />
                </td>
                <td className="py-1.5 text-ink-2">{chainName(t.chain)}</td>
                <td className="py-1.5 text-ink">{t.sent.join(', ') || 'n/a'}</td>
                <td className="py-1.5 text-ink">{t.received.join(', ') || 'n/a'}</td>
                <td className="num py-1.5 text-right text-ink">{usd(t.volumeUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** P4: this wallet's part in chain-to-chain capital rotations (owner view:
 *  built from the scanner's smart-money trades). */
function RotationsCard({ address, mode }: { address: string; mode: DisplayMode }) {
  if (mode !== 'owner') return null;
  const rows = walletRotations(address, 168);
  if (!rows.length) return null;
  return (
    <Card
      id="rotations"
      title={`Rotated capital across ${rows.length} chain pair${rows.length === 1 ? '' : 's'} in 7 days`}
      sub="This wallet's part in chain-to-chain rotations: sold on one chain, bought on another within 12h."
      action={
        <Link href="/#fronts-title" className="text-[12px] text-brand hover:underline">
          Capital Flows <Go />
        </Link>
      }
    >
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li
            key={`${r.from}>${r.to}`}
            className="grid gap-2 py-2.5 text-[12.5px] sm:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_200px] sm:items-center"
          >
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <ChainLogo chain={r.from} size={16} />
              {chainName(r.from)}
              <span className="text-ink-muted"><Go /></span>
              <ChainLogo chain={r.to} size={16} />
              {chainName(r.to)}
            </span>
            <span className="min-w-0 truncate text-ink-2">
              <span className="num" style={{ color: 'var(--out-3)' }}>
                −{usd(r.soldUsd)}
              </span>{' '}
              sold {r.soldTokens.slice(0, 3).join(', ')}
            </span>
            <span className="min-w-0 truncate text-ink-2">
              <span className="num" style={{ color: 'var(--in-3)' }}>
                +{usd(r.boughtUsd)}
              </span>{' '}
              bought {r.boughtTokens.slice(0, 3).join(', ')}
            </span>
            <span className="num whitespace-nowrap text-right text-ink-muted">
              in a {usd(r.flowNetUsd)} flow · {r.flowWallets} wallets
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Today's balances (already loaded for this page) as the NOW side of the Time Machine. */
async function WalletTimeMachineNow({ address, p }: { address: string; p: ReturnType<typeof balances> }) {
  const b = await p.catch(() => null);
  const current = b && !isUnavailable(b) ? { totalUsd: b.totalUsd, positions: b.positions.slice(0, 200).map((x) => ({ chain: x.chain, symbol: x.symbol ?? null, tokenAddress: x.tokenAddress, valueUsd: x.valueUsd })) } : null;
  return <WalletTimeMachine address={address} current={current} />;
}
