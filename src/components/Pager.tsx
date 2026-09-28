'use client';
import { useEffect } from 'react';
import { hydratedPast } from '@/lib/hydration';

/** Long tables and lists split into numbered pages, with a choice of rows per page. One listener for the app.
 *  Paged: sortable tables, tables with data-page, phone lists (.m-list) and any list marked data-paged.
 *  data-page="N" sets the default rows per page. Rows are hidden, never removed, so React's markup is untouched.
 *  Paging marks rows with data-paged-out; `hidden` stays FilterBox's, and only rows a search left visible are paged. */
const PHONE = '(max-width: 639px)';
const sizes = () => (matchMedia(PHONE).matches ? [10, 25, 50, 0] : [15, 30, 60, 0]); // 0 = all
const SELECTOR = 'main table[data-sortable], main table[data-page], main .m-list, main [data-paged]';

type State = { size: number; page: number; first: Element | null; count: number };
const state = new WeakMap<HTMLElement, State>();


const itemsOf = (host: HTMLElement): HTMLElement[] =>
  host instanceof HTMLTableElement ? [...(host.tBodies[0]?.rows ?? [])] : ([...host.children].filter((c) => c.tagName === 'LI') as HTMLElement[]);

/** Page numbers to show: first, last, and the neighbours of the current page, with gaps as null. */
function pageList(page: number, pages: number): Array<number | null> {
  const want = new Set([0, pages - 1, page - 1, page, page + 1]);
  if (page <= 2) [1, 2, 3].forEach((p) => want.add(p));
  if (page >= pages - 3) [pages - 2, pages - 3, pages - 4].forEach((p) => want.add(p));
  const list = [...want].filter((p) => p >= 0 && p < pages).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  list.forEach((p, i) => { if (i && p - list[i - 1] > 1) out.push(null); out.push(p); });
  return out;
}

function barFor(host: HTMLElement): HTMLElement | null {
  const next = host.nextElementSibling;
  if (next?.classList.contains('pager')) return next as HTMLElement;
  const outer = host.parentElement?.nextElementSibling;
  return outer?.classList.contains('pager') ? (outer as HTMLElement) : null;
}

const out = (r: HTMLElement, v: boolean) => r.toggleAttribute('data-paged-out', v);

/** Where the bar goes: below the table's scroll box when it has one, else right after the list. */
const boxOf = (host: HTMLElement): HTMLElement => (host.parentElement && host instanceof HTMLTableElement && getComputedStyle(host.parentElement).overflowX !== 'visible' ? host.parentElement : host);

function apply(host: HTMLElement, opts: { resetPage?: boolean; scroll?: boolean } = {}): boolean {
  // Streamed sections arrive as HTML before React hydrates them: wait until React is done with this one
  // (an early bar or changed row is a hydration error that re-renders the section on the client).
  if (!hydratedPast(boxOf(host))) return false;
  const all = itemsOf(host);
  all.forEach((r) => { if (r.hidden) out(r, false); });
  const items = all.filter((r) => !r.hidden);
  const choices = sizes();
  const fallback = Number(host.dataset.page) || choices[0];
  let s = state.get(host);
  // A new set of rows (another selection, a refresh) starts again from page 1.
  if (!s || s.first !== (items[0] ?? null) || s.count !== items.length || opts.resetPage) s = { size: s?.size ?? fallback, page: 0, first: items[0] ?? null, count: items.length };
  state.set(host, s);

  let bar = barFor(host);
  if (items.length <= choices[0] && items.length <= fallback) { items.forEach((r) => out(r, false)); bar?.remove(); return true; }

  const size = s.size || items.length;
  const pages = Math.max(1, Math.ceil(items.length / size));
  s.page = Math.min(s.page, pages - 1);
  const from = s.page * size, to = Math.min(items.length, from + size);
  items.forEach((r, i) => out(r, i < from || i >= to));

  if (!bar) {
    bar = document.createElement('nav');
    bar.className = 'pager';
    // Below the element's scroll box when it has one, so the bar never scrolls away with the rows.
    boxOf(host).after(bar);
  }
  const label = host.getAttribute('aria-label') ?? host.closest('section')?.querySelector('h2, h3')?.textContent ?? 'list';
  bar.setAttribute('aria-label', `Pages: ${label}`);
  const btn = (p: number, text: string, extra = '') => `<button type="button" data-go="${p}" ${extra}>${text}</button>`;
  bar.innerHTML =
    `<span class="pager-count">${from + 1}–${to} of ${items.length}</span>` +
    (pages > 1
      ? `<span class="pager-pages">${btn(s.page - 1, '‹', `aria-label="Previous page" ${s.page === 0 ? 'disabled' : ''}`)}${pageList(s.page, pages)
          .map((p) => (p == null ? '<span class="pager-gap" aria-hidden="true">…</span>' : btn(p, String(p + 1), `aria-label="Page ${p + 1}" ${p === s!.page ? 'aria-current="page"' : ''}`)))
          .join('')}${btn(s.page + 1, '›', `aria-label="Next page" ${s.page >= pages - 1 ? 'disabled' : ''}`)}</span>`
      : '') +
    `<span class="pager-sizes" role="group" aria-label="Rows per page">${choices.map((c) => `<button type="button" data-size="${c}" aria-pressed="${c === s!.size}">${c || 'All'}</button>`).join('')}</span>`;
  bar.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    const cur = state.get(host)!;
    if (b.dataset.go != null) cur.page = Number(b.dataset.go);
    else { const first = cur.page * (cur.size || items.length); cur.size = Number(b.dataset.size); cur.page = cur.size ? Math.floor(first / cur.size) : 0; }
    apply(host, { scroll: true });
  };
  // Keep the reader at the top of the rows they asked for.
  if (opts.scroll) {
    if (host.scrollHeight > host.clientHeight) host.scrollTop = 0;
    if (host.getBoundingClientRect().top < 0) host.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  return true;
}

export function Pager() {
  useEffect(() => {
    let queued = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      queued = false;
      let pending = false;
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => { if (!apply(el)) pending = true; });
      clearTimeout(retry);
      if (pending) retry = setTimeout(run, 250);
    };
    const schedule = () => { if (!queued) { queued = true; setTimeout(run, 16); } }; // a timer, not a frame: background tabs stay in step
    run();
    const mo = new MutationObserver((muts) => { if (muts.some((m) => !(m.target as HTMLElement).closest?.('.pager'))) schedule(); });
    // A search (FilterBox) toggles `hidden` on rows: re-page what it leaves.
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    // Sorting reorders rows: show the new first page.
    const onClick = (e: MouseEvent) => {
      const th = (e.target as HTMLElement).closest('table th');
      const table = th?.closest('table');
      if (table) setTimeout(() => apply(table, { resetPage: true }), 0);
    };
    document.addEventListener('click', onClick);
    // Crossing the phone breakpoint changes the page sizes.
    const mq = matchMedia(PHONE);
    const onBreak = () => document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => { state.delete(el); apply(el); });
    mq.addEventListener('change', onBreak);
    return () => { clearTimeout(retry); mo.disconnect(); document.removeEventListener('click', onClick); mq.removeEventListener('change', onBreak); };
  }, []);
  return null;
}
