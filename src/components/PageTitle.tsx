import type { ReactNode } from 'react';

/** The page's name on one line, with an optional short context pill: the
 *  sidebar already says where you are, so pages don't repeat an intro. */
export function PageTitle({ title, pill, id, action }: { title: ReactNode; pill?: ReactNode; id?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1 id={id} className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
        {pill && <span className="inline-flex max-w-full items-center gap-2 truncate rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">{pill}</span>}
      </div>
      {action}
    </div>
  );
}
