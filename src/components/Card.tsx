import type { ReactNode } from 'react';

/** The page section every dashboard card uses: an insight title (states
 *  the finding, not the chart type), a one-line how-to-read, then content. */
export function Card({ id, title, sub, children, className = '', action }: { id: string; title: string; sub?: ReactNode; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`glass liquid-panel rise min-w-0 rounded-2xl p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 id={id} className="text-[15px] font-semibold leading-snug text-ink">{title}</h2>
        {action}
      </div>
      {sub && <p className="mt-1 text-[12.5px] text-ink-2">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Placeholder while a wave is still streaming in from Nansen. */
export function WaveLoading({ what, height = 200 }: { what: string; height?: number }) {
  return (
    <div className="flex animate-pulse items-center justify-center rounded-lg bg-accent/40 text-[12.5px] text-ink-muted" style={{ height }}>
      Loading {what} from Nansen…
    </div>
  );
}

export function Unavailable({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-ink-2">{text}</p>;
}
