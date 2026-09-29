'use client';
import Link from 'next/link';
import { ChainLogo, TokenLogo } from '@/components/Logo';
import { chainName, num } from '@/lib/viz/format';
import { TimeAgo } from '@/components/TimeAgo';
import type { StormTick } from '@/server/weather/queries';

/** Storm warnings: the highest Storm Scores TIDE has computed in the last
 *  48 hours, across every chain. A scrollable row, not an auto-scrolling
 *  marquee — nothing on this page moves unless the data does. */
export function StormTicker({ storms }: { storms: StormTick[] }) {
  if (!storms.length) {
    return (
      <p className="text-sm text-ink-2">
        No Risk Scores yet. The scanner sweeps the tokens smart money is dumping hardest every 12 hours, and every token page opened adds one.
      </p>
    );
  }
  return (
    <ul className="stagger grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2" aria-label="Highest Risk Score, last 48 hours">
      {storms.slice(0, 8).map((s) => {
        return (
          <li key={`${s.chain}:${s.tokenAddress}`}>
            <Link prefetch={false} href={`/token/${s.chain}/${encodeURIComponent(s.tokenAddress)}`} className="inset-well flex items-center gap-3 rounded-[14px] px-3 py-2 sm:px-3.5 sm:py-3 hover:border-[var(--hair-2)]">
              <TokenLogo symbol={s.symbol} logo={s.logo} chain={s.chain} address={s.tokenAddress} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold text-ink">{s.symbol ?? s.tokenAddress.slice(0, 6)}</span>
                <span className="flex items-center gap-1 truncate text-[12px] text-ink-muted"><ChainLogo chain={s.chain} size={12} />{chainName(s.chain)} · <TimeAgo ts={s.computedAt} /></span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="num text-[18px] font-extrabold leading-none text-ink">{num(s.score, 0)}</span>
                <span className="rounded-full px-2 py-px text-[10.5px] font-bold" style={{ color: s.score >= 55 ? 'var(--flare)' : s.score >= 35 ? 'var(--amber)' : 'var(--mint)', background: `color-mix(in srgb, ${s.score >= 55 ? 'var(--flare)' : s.score >= 35 ? 'var(--amber)' : 'var(--mint)'} 14%, transparent)` }}>{s.score >= 55 ? 'Danger' : s.score >= 35 ? 'Watch' : 'Low'}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}