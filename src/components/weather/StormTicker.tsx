'use client';
import Link from 'next/link';
import { STORM_CLASS, STORM_LABEL } from '@/lib/viz/scales';
import { chainName, num, pct } from '@/lib/viz/format';
import { TimeAgo } from '@/components/TimeAgo';
import type { StormTick } from '@/server/weather/queries';

/** Storm warnings: the highest Storm Scores TIDE has computed in the last
 *  48 hours, across every chain. A scrollable row, not an auto-scrolling
 *  marquee — nothing on this page moves unless the data does. */
export function StormTicker({ storms }: { storms: StormTick[] }) {
  if (!storms.length) {
    return (
      <p className="text-sm text-ink-2">
        No Storm Scores yet. The scanner sweeps the tokens smart money is dumping hardest every 12 hours, and every token page opened adds one.
      </p>
    );
  }
  return (
    <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Highest Storm Scores, last 48 hours">
      {storms.map((s) => {
        const cls = STORM_CLASS[s.band];
        return (
          <li key={`${s.chain}:${s.tokenAddress}`} className="shrink-0">
            <Link href={`/token/${s.chain}/${encodeURIComponent(s.tokenAddress)}`} className="block w-[168px] rounded-lg border border-border bg-surface px-3 py-2 hover:border-axis">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-ink">{s.symbol ?? s.tokenAddress.slice(0, 8)}</span>
                <span className="num text-[15px] font-semibold text-ink">{num(s.score, 0)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="rounded-full px-2 py-px text-[10.5px] font-medium" style={{ background: `var(--${cls})`, color: `var(--on-${cls})` }}>{STORM_LABEL[s.band]}</span>
                <span className="truncate text-[11px] text-ink-muted">{chainName(s.chain)}</span>
              </div>
              <div className="num mt-1 text-[10.5px] text-ink-muted">
                conf {pct(s.confidence, 0)} · <TimeAgo ts={s.computedAt} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
