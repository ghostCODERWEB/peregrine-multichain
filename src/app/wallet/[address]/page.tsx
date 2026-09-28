import { NansenButton } from '@/components/shell/GetNansen';
import Link from 'next/link';
import { WalletPortfolio } from '@/components/research/WalletPortfolio';
import { WalletScorecard } from '@/components/wallet/WalletScorecard';
import { FollowabilityCard } from '@/components/wallet/FollowabilityCard';
import { CascadeRole } from '@/components/wallet/CascadeRole';
import { nansenWallet } from '@/config/external';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { ensAddress, ensName, ENS_NAME_RE } from '@/server/ens';
import type { Metadata } from 'next';
import { Card, WaveLoading, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { PnlCard, CounterpartiesCard } from '@/components/wallet/ProfileCards';
import { TrailMap } from '@/components/wallet/TrailMap';
import { trailTitle } from '@/lib/insights';
import { TimeAgo } from '@/components/TimeAgo';
import { WalletDesk } from '@/components/wallet/WalletDesk';
import { HyperliquidWorkspace } from '@/components/research/HyperliquidWorkspace';
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
  const input = decodeURIComponent(raw).trim();
  // /wallet/vitalik.eth opens the address the name points to.
  if (ENS_NAME_RE.test(input)) {
    const resolved = await ensAddress(input);
    if (!resolved) notFound();
    redirect(`/wallet/${resolved}`);
  }
  const address = input;
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
  // The wallet's ENS name, if it has one (bounded wait so a slow RPC never holds the page).
  const ens = evm ? await Promise.race([ensName(address), new Promise<null>((r) => setTimeout(() => r(null), 2500))]) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link prefetch={false} href="/" className="text-[12.5px] text-ink-2 hover:text-ink">
            <Back /> Overview
          </Link>
          <h1 className="t-headline mt-1 break-all text-ink">
            {mode === 'owner' && trail.label ? walletName(trail.label, address) : perpLabel?.replace(/\s*\[[^\]]*\]$/, '') ?? ens ?? shortAddress(address)}
          </h1>
          <p className="num mt-1 break-all text-[12.5px] text-ink-2">{ens && <span className="mr-2 font-sans font-semibold text-[var(--mint)]">{ens}</span>}{address}</p>
        </div>
        <span className="flex items-center gap-2">
          <NansenButton href={nansenWallet(address)} label="Open in Nansen Profiler" size="sm" logo={false} />
        </span>
      </div>

      {/* One tile grid, ordered like a research session: who and what it holds, how it trades, who it deals with, then its history. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
        {/* Placeholder sized like the scorecard it stands in for (580px stacked, 330px wide) so nothing below jumps. */}
        <Suspense fallback={<div className="h-[580px] animate-pulse rounded-[var(--r-card)] bg-ink/5 xl:col-span-12 xl:h-[330px]" />}>
          <WalletScorecard address={address} balP={balP} pnlP={pnlP} />
        </Suspense>
        {mode === 'owner' && <div className="xl:col-span-12"><WalletQuickRead address={address} /></div>}
        <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[var(--r-card)] bg-ink/5 xl:col-span-12" />}>
          <WalletPortfolio balP={balP} pnlP={pnlP} />
        </Suspense>
        {mode === 'owner' && <div className="xl:col-span-12 empty:hidden"><CascadeRole address={address} /></div>}
        {mode === 'owner' && <div className="xl:col-span-12 empty:hidden"><FollowabilityCard address={address} /></div>}
        {evm && <div id="hyperliquid" className="scroll-mt-20 xl:col-span-12"><HyperliquidWorkspace address={address} /></div>}
        <Tile span="xl:col-span-12">
          <Suspense fallback={<Card id="wallet-weather-loading" title="Wallet profile"><WaveLoading what="wallet profile" height={280} /></Card>}>
            <WalletWeather p={redacted(mode, weatherP)} />
          </Suspense>
        </Tile>
        <Tile span="xl:col-span-4">
          <Suspense fallback={<Card id="pnl-loading" title="PnL, 30 days"><WaveLoading what="PnL" /></Card>}>
            <PnlCard p={redacted(mode, pnlP)} mode={mode} />
          </Suspense>
        </Tile>
        <Tile span="xl:col-span-4">
          <Suspense fallback={<Card id="cp-loading" title="Counterparties"><WaveLoading what="counterparties" /></Card>}>
            <CounterpartiesCard p={redacted(mode, mainChainP.then((c) => counterparties(address, c)))} mode={mode} />
          </Suspense>
        </Tile>
        <Tile span="xl:col-span-4">
          <Suspense fallback={<Card id="origins-loading" title="Origins"><WaveLoading what="first funder and related wallets" /></Card>}>
            <OriginsCard address={address} mainChain={mainChainP} mode={mode} />
          </Suspense>
        </Tile>
        <Tile span="xl:col-span-5"><WalletLabels address={address} enabled={mode !== 'public'} /></Tile>
        <Tile span="xl:col-span-7">
          <Suspense fallback={<Card id="tx-loading" title="Recent transactions"><WaveLoading what="transactions" /></Card>}>
            <TransactionsCard address={address} mode={mode} />
          </Suspense>
        </Tile>
        {mode === 'owner' && trail.steps.length > 0 && (
          <Card id="trail" className="xl:col-span-12" title="Smart Money trail" sub={`${trailTitle(trail.steps, trail.chains)} · DEX trades as a path over the chains, in time order`} action={<InfoPopover p={trail.provenance} />}>
            <TrailMap steps={trail.steps} />
          </Card>
        )}
        <div className="xl:col-span-12">
          <Suspense fallback={<WalletTimeMachine address={address} current={null} />}>
            <WalletTimeMachineNow address={address} p={balP} />
          </Suspense>
        </div>
        <Tile span="xl:col-span-6"><RotationsCard address={address} mode={mode} /></Tile>
        {evm && <div id="pm-trader" className="scroll-mt-20 min-w-0 xl:col-span-6 [&>*]:h-full"><PredictionTraderPanel address={address} /></div>}
        <div className="xl:col-span-12">
          <Suspense fallback={<Card id="wallet-desk-loading" title="Wallet desk"><WaveLoading what="wallet chain" /></Card>}>
            <Desk address={address} mainChain={mainChainP} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/** A grid tile whose card fills the tile height, so tiles in one row line up. */
function Tile({ span, children }: { span: string; children: React.ReactNode }) {
  return <div className={`${span} min-w-0 [&>*]:h-full`}>{children}</div>;
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
  return (
    <Card
      id="origins"
      title="Origins"
      sub={f ? `First funded by ${walletName(f.funderName, f.address)} on ${chainName(f.chain)}` : 'First funder and related wallets'}
      action={<InfoPopover p={r.provenance} />}
    >
      {f ? (
        <p className="text-[12.5px] text-ink-2">
          <Link prefetch={false} href={`/wallet/${f.address}`} className="num text-ink underline underline-offset-2">
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
              <Link prefetch={false} href={`/wallet/${x.address}`} className="truncate text-ink hover:underline">
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
      title="Recent transactions"
      sub={`${r.rows.length} in the last 7 days, newest first, across chains`}
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
      title="Chain rotations"
      sub={`${rows.length} chain pair${rows.length === 1 ? '' : 's'} in 7 days: sold on one chain, bought on another within 12h`}
      action={
        <Link prefetch={false} href="/#fronts-title" className="text-[12px] text-brand hover:underline">
          Chain flows <Go />
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
              <span className="num" style={{ color: 'var(--flare)' }}>
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
