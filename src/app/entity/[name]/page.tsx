import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Card, WaveLoading, Unavailable } from '@/components/Card';
import { BalancesCard, PnlCard, CounterpartiesCard, HoldingsTrendCard } from '@/components/wallet/ProfileCards';
import { balances, pnl, counterparties, holdingsTrend, type Subject } from '@/server/wallet/wallet-page';
import { resolveEntity } from '@/server/entity/entity-page';
import { isUnavailable } from '@/server/nansen/traced';
import { displayMode } from '@/server/mode';
import { redacted } from '@/server/redact';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ name: string }> };

const decode = (raw: string) => decodeURIComponent(raw).trim().slice(0, 120);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { name } = await params;
  return { title: `${decode(name)} — Peregrine entity` };
}

export default async function EntityRoute({ params }: Params) {
  const { name: raw } = await params;
  const name = decode(raw);
  const lookup = await resolveEntity(name);

  if (!lookup.found) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link href="/" className="text-[12.5px] text-ink-2 hover:text-ink">← Overview</Link>
        <h1 className="t-headline text-ink">No Nansen entity named “{name}”</h1>
        {lookup.error ? <Unavailable text={lookup.error} /> : lookup.suggestions.length ? (
          <div>
            <p className="text-sm text-ink-2">Nansen&apos;s entity search suggests:</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {lookup.suggestions.map((s) => (
                <li key={s}><Link href={`/entity/${encodeURIComponent(s)}`} className="rounded border border-border px-2 py-1 text-sm text-ink hover:bg-accent">{s}</Link></li>
              ))}
            </ul>
          </div>
        ) : <p className="text-sm text-ink-2">Nansen&apos;s entity search returned nothing for it.</p>}
      </div>
    );
  }

  const { entity } = lookup;
  const mode = await displayMode();
  const subject: Subject = { entity: entity.name };
  const balP = balances(subject);
  const mainChainP = balP.then((b) => (isUnavailable(b) ? null : b.byChain[0]?.chain ?? null));
  const trendP = balP.then((b) => (isUnavailable(b) ? b : holdingsTrend(subject, b.top)));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="text-[12.5px] text-ink-2 hover:text-ink">← Overview</Link>
        <h1 className="t-headline mt-1 text-ink">{entity.name}</h1>
        <p className="mt-1 text-[12.5px] text-ink-2">
          {entity.tags.length ? `${entity.tags.join(' · ')} · ` : ''}Nansen entity: every address Nansen attributes to it, aggregated by Nansen.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Suspense fallback={<Card id="bal-loading" title="Balances"><WaveLoading what="balances" height={300} /></Card>}>
          <BalancesCard p={redacted(mode, balP)} />
        </Suspense>
        <div className="lg:col-span-2">
          <Suspense fallback={<Card id="trend-loading" title="Holdings, 30 days"><WaveLoading what="30 days of balances" height={260} /></Card>}>
            <HoldingsTrendCard p={redacted(mode, trendP)} />
          </Suspense>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Suspense fallback={<Card id="pnl-loading" title="PnL, 30 days"><WaveLoading what="PnL" /></Card>}>
          <PnlCard p={redacted(mode, pnl(subject))} mode={mode} />
        </Suspense>
        <Suspense fallback={<Card id="cp-loading" title="Counterparties"><WaveLoading what="counterparties" /></Card>}>
          <CounterpartiesCard p={redacted(mode, mainChainP.then((c) => counterparties(subject, c)))} mode={mode} />
        </Suspense>
      </div>
    </div>
  );
}
