import Link from 'next/link';
import { TokenLogo } from '@/components/Logo';
import type { RankRow } from '@/components/charts/IntelCharts';

const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(Math.abs(v) < 10 ? 1 : 0)}%`;

/**
 * Ranked signed values as a paged list: a bar each way from a centre line, on one scale across every page, so
 * page two's bars read against page one's. Same row as the Smart Money book beside it, so the cards line up
 * page for page. The site's pager splits it (data-paged).
 */
export function RankList({ rows, label, coins = false }: { rows: RankRow[]; label: string; coins?: boolean }) {
  if (!rows.length) return <p className="text-[13px] text-ink-muted">No readings yet.</p>;
  const max = Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul data-paged aria-label={label} className="space-y-2">
      {rows.map((r) => {
        const w = (Math.abs(r.value) / max) * 50;
        const up = r.value >= 0;
        return (
          <li key={r.label}>
            <Link prefetch={false} href={r.href} title={r.sub ? `${r.label} · ${r.sub}` : r.label} className="group grid grid-cols-[96px_minmax(0,1fr)_56px] items-center gap-2 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink group-hover:underline">
                {coins && <TokenLogo symbol={r.label} coin={r.label} size={16} />}
                <span className="truncate">{r.label}</span>
              </span>
              <span className="relative h-2.5">
                <span aria-hidden className="absolute inset-y-[-3px] left-1/2 w-px bg-[var(--hair)]" />
                <span
                  className="absolute inset-y-0"
                  style={{ [up ? 'left' : 'right']: '50%', width: `${Math.max(w, 0.8)}%`, background: up ? 'var(--mint)' : 'var(--flare)', borderRadius: up ? '0 999px 999px 0' : '999px 0 0 999px' }}
                />
              </span>
              <span className={`num whitespace-nowrap text-right text-[11.5px] ${up ? 'text-[var(--mint)]' : 'text-[var(--flare)]'}`}>{pct(r.value)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
