import Link from 'next/link';
import { AddressLink } from '@/components/entity/AddressLink';
import { CohortBadges } from '@/components/entity/CohortBadges';
import { walletOverlaps } from '@/server/graph/overlaps';
import { usd } from '@/lib/viz/format';

/** Wallets that appear in more than one stored Nansen dataset: the same traders across coins and across spot and perps. */
export function WalletOverlaps() {
  const { wallets, sources } = walletOverlaps();
  const both = wallets.filter((w) => w.presence.some((p) => p.kind === 'spot'));
  const multi = wallets.filter((w) => new Set(w.presence.filter((p) => p.kind === 'perp').map((p) => p.key)).size >= 2);
  return (
    <section aria-labelledby="overlaps" className="material p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="overlaps" className="t-section">Wallets that keep appearing</h2>
        <span className="text-[12px] text-ink-muted">Across {sources.join(', ')}</span>
      </div>
      <p className="mb-3 text-[12.5px] text-ink-2">
        <span className="font-semibold text-ink">{multi.length}</span> wallets hold positions in more than one perp; <span className="font-semibold text-ink">{both.length}</span> Smart Money wallets traded spot in the last 24h and also hold an observed perp position.
      </p>
      <ol data-page="10" className="divide-y divide-[var(--hair)]" aria-label="Wallet overlaps">
        {wallets.slice(0, 100).map((w) => (
          <li key={w.address} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[12.5px]">
            <span className="flex min-w-[220px] flex-1 items-center gap-1.5"><AddressLink address={w.address} label={w.label} /><CohortBadges cohorts={w.cohorts} /></span>
            <span className="flex flex-wrap gap-1">
              {w.presence.slice(0, 6).map((p, i) => {
                const [chain, token, sym] = p.key.split(':');
                const href = p.kind === 'perp' ? `/perps/${p.key}` : `/token/${chain}/${encodeURIComponent(token)}`;
                const tone = p.side === 'long' || p.side === 'bought' ? 'var(--mint)' : 'var(--flare)';
                return (
                  <Link prefetch={false} key={i} href={href} className="rounded-full border border-[var(--hair)] px-2 py-0.5 hover:border-[var(--hair-2)]">
                    <span className="text-ink-muted">{p.kind === 'perp' ? 'perp' : 'spot'}</span> <span className="font-semibold text-ink">{p.kind === 'perp' ? p.key : sym}</span> <span style={{ color: tone }}>{p.side}</span> <span className="num text-ink-2">{usd(p.usd)}</span>
                  </Link>
                );
              })}
            </span>
          </li>
        ))}
        {!wallets.length && <li className="py-4 text-[12.5px] text-ink-muted">No wallet appears in two datasets yet; overlaps grow as the scanner stores perp snapshots and Smart Money trades.</li>}
      </ol>
    </section>
  );
}
