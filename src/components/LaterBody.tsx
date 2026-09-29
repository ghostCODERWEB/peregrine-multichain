'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Rows a long, paged table renders with the page: the largest first page (desktop, 15). Before the pager
 *  takes over, the CSS pre-paging shows no more than that anyway, with or without JavaScript. */
export const FIRST_ROWS = 15;

/** Asks every long table on the page for all of its rows (a search that arrives with the link, Analyze). */
export const wantAllRows = () => window.dispatchEvent(new Event('peregrine:rows'));

/**
 * A long table's body: the first FIRST_ROWS rows, and the rest only once the reader uses the table. On
 * /perps that was 205 rows (2,500 elements) parsed and hydrated on every load for pages most readers never
 * open; building them in the browser after load cost more than hydrating them, so they wait for a touch,
 * focus or key inside the table's section (its pages, headers, search, filters) and then render at once,
 * before that click lands. The body carries `data-rows-pending` and `data-rows-total` until then, so the
 * pager already shows every page.
 */
export function LaterBody<T>({ items, children }: { items: T[]; children: (item: T) => ReactNode }) {
  const body = useRef<HTMLTableSectionElement>(null);
  const [all, setAll] = useState(false);
  const pending = !all && items.length > FIRST_ROWS;
  useEffect(() => {
    if (!pending) return;
    const scope = body.current?.closest('section') ?? body.current?.parentElement;
    const now = () => setAll(true);
    const local = ['pointerdown', 'focusin', 'keydown'] as const;
    const global = ['peregrine:rows', 'peregrine:analyze', 'peregrine:analyze-toggle'] as const;
    local.forEach((t) => scope?.addEventListener(t, now, { passive: true }));
    global.forEach((t) => window.addEventListener(t, now));
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') now(); }; // Analyze
    window.addEventListener('keydown', onKey);
    return () => {
      local.forEach((t) => scope?.removeEventListener(t, now));
      global.forEach((t) => window.removeEventListener(t, now));
      window.removeEventListener('keydown', onKey);
    };
  }, [pending]);
  // The pager hides the new rows in this same frame: a table that grew for a moment moved its page buttons
  // out from under the press that asked for them.
  useLayoutEffect(() => { if (all) body.current?.dispatchEvent(new Event('peregrine:rows-in', { bubbles: true })); }, [all]);
  return (
    <tbody ref={body} data-rows-pending={pending ? '' : undefined} data-rows-total={pending ? items.length : undefined}>
      {(pending ? items.slice(0, FIRST_ROWS) : items).map(children)}
    </tbody>
  );
}
