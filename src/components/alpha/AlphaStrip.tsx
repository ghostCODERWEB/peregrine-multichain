import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { ScoreRing } from '@/components/viz/ScoreRing';
import { FlowSpark } from '@/components/viz/FlowSpark';
import type { AlphaRow } from '@/server/alpha/board';
import { chainName, pct } from '@/lib/viz/format';

/** The home page's teaser for the Alpha board: the five best-scored tokens (ten on wide screens). */
export function AlphaStrip({ rows }: { rows: AlphaRow[] }) {
  if (!rows.length) return null;
  return (
    <section aria-labelledby="alpha-strip" className="material rise p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="alpha-strip" className="flex items-center gap-2 t-section text-ink">
          <Sparkles className="h-4 w-4 text-brand" aria-hidden />Highest Alpha scores
        </h2>
        <Link prefetch={false} href="/alpha" className="inline-flex items-center gap-1 text-[12.5px] text-ink-2 hover:text-ink">All tokens <ArrowRight className="h-3.5 w-3.5" /></Link>
      </div>
      <ul className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {rows.slice(0, 10).map((r, i) => (
          <li key={`${r.chain}:${r.tokenAddress}`} className={i >= 5 ? 'hidden 3xl:block' : undefined}>
            <Link prefetch={false} href={`/token/${r.chain}/${encodeURIComponent(r.tokenAddress)}`} className="flex items-center gap-3 rounded-xl border border-border bg-background/30 p-2.5 hover:border-brand/30 hover:bg-accent/40">
              <ScoreRing score={r.score} size={44} stroke={4} color={r.score >= 65 ? 'var(--brand)' : 'var(--ink-2)'} label={`${r.symbol ?? 'Token'} alpha score`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium text-ink">{r.symbol ?? 'Token'}</span>
                <span className="block truncate text-[11px] text-ink-muted">{chainName(r.chain)} · {r.flowShare != null ? `${pct(r.flowShare, 0)} net buying` : 'n/a'}</span>
                <span className="mt-1 block"><FlowSpark values={r.hourly} width={110} height={16} label={`${r.symbol ?? 'Token'} hourly net-flow share`} /></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
