import Link from 'next/link';
import type { ReactNode } from 'react';

export interface Stat { label: string; value: ReactNode; note?: ReactNode; href?: string; tone?: 'in' | 'out' }

/** A row of key figures: label above, figure below, hairline dividers. Two
 *  per row on phones, one row from tablets up. A stat with `href` opens its detail. */
export function StatStrip({ stats, className = '' }: { stats: Stat[]; className?: string }) {
  return (
    <ul className={`stagger grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1 ${className}`}>
      {stats.map((s) => {
        const body = (
          <>
            <span className="block text-[12px] font-semibold text-ink-muted">{s.label}</span>
            <span className="num mt-1 block truncate text-[clamp(17px,1.35vw,24px)] font-bold tracking-[-0.02em]" style={s.tone ? { color: s.tone === 'in' ? 'var(--mint)' : 'var(--flare)' } : undefined}>{s.value}</span>
            {s.note && <span className="mt-0.5 block truncate text-[12px] text-ink-2">{s.note}</span>}
          </>
        );
        return (
          <li key={s.label} className="min-w-0 bg-[var(--surface-1)]">
            {s.href ? <Link href={s.href} className="block h-full px-3.5 py-2.5 transition-colors sm:px-4 sm:py-3 duration-[var(--dur-fast)] hover:bg-[var(--surface-2)]">{body}</Link> : <div className="px-3.5 py-2.5 sm:px-4 sm:py-3">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
