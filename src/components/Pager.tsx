'use client';
import { useEffect } from 'react';
import { afterHydration, hydratedPast } from '@/lib/hydration';

/** Long tables and lists split into numbered pages, with a choice of rows per page. One listener for the app.
 *  Paged: sortable tables, tables with data-page, phone lists (.m-list) and any list marked data-paged.
 *  data-page="N" sets the default rows per page. Rows are hidden, never removed, so React's markup is untouched.
 *  Paging marks rows with data-paged-out; `hidden` stays FilterBox's, and only rows a search left visible are paged. */
const PHONE = '(max-width: 639px)';
const sizes = () => (matchMedia(PHONE).matches ? [10, 25, 50, 0] : [15, 30, 60, 0]); // 0 = all
const SELECTOR = 'main table[data-sortable], main table[data-page], main .m-list, main [data-paged]';

type State = { size: number; page: number; first: Element | null; count: number };
const state = new WeakMap<HTMLElement, State>();
const written = new WeakMap<HTMLElement, string>();


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

/** The current page's green lens, one per bar, kept across rewrites of the bar so it can travel: it slides from
 *  the page it was on to the new one with the phone tab bar's spring, stretching along the way and settling
 *  back into shape as it lands (TabBar's lens). */
const lenses = new WeakMap<HTMLElement, { el: HTMLSpanElement; x: number }>();
function placeLens(bar: HTMLElement, travel = true) {
  const pages = bar.querySelector<HTMLElement>('.pager-pages');
  const cur = pages?.querySelector<HTMLElement>('button[aria-current="page"]');
  let lens = lenses.get(bar);
  // Nothing to sit under, or not laid out (a hidden tab): no lens, and the button shows its own green bubble.
  if (!pages || !cur || !cur.offsetWidth) { lens?.el.remove(); if (lens) lens.x = NaN; return; }
  if (!lens) {
    const el = document.createElement('span');
    el.className = 'pager-lens';
    el.setAttribute('aria-hidden', 'true');
    lens = { el, x: NaN };
    lenses.set(bar, lens);
  }
  if (lens.el.parentElement !== pages) pages.prepend(lens.el);
  const x = cur.offsetLeft, from = lens.x;
  Object.assign(lens.el.style, { top: `${cur.offsetTop}px`, width: `${cur.offsetWidth}px`, height: `${cur.offsetHeight}px`, translate: `${x}px 0` });
  lens.x = x;
  if (!travel || !Number.isFinite(from) || from === x || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const far = Math.min(3, Math.abs(x - from) / Math.max(1, cur.offsetWidth));
  lens.el.animate([{ translate: `${from}px 0` }, { translate: `${x}px 0` }], { duration: 420, easing: 'cubic-bezier(.3,1.25,.4,1)' });
  lens.el.animate(
    [{ scale: '1 1' }, { scale: `${1 + 0.16 * far} ${1 - 0.06 * far}`, offset: 0.35 }, { scale: '0.96 1.04', offset: 0.7 }, { scale: '1 1' }],
    { duration: 460, easing: 'cubic-bezier(.3,.7,.4,1)' },
  );
}

/** Where the bar goes: below the table's scroll box when it has one, else right after the list.
 *  Kept per list (while its parent stays the same): reading computed style between the pager's own
 *  changes made the browser restyle the page once per list. */
const boxes = new WeakMap<HTMLElement, { parent: Element | null; box: HTMLElement }>();
function boxOf(host: HTMLElement): HTMLElement {
  const known = boxes.get(host);
  if (known && known.parent === host.parentElement) return known.box;
  const box = host.parentElement && host instanceof HTMLTableElement && getComputedStyle(host.parentElement).overflowX !== 'visible' ? host.parentElement : host;
  boxes.set(host, { parent: host.parentElement, box });
  return box;
}

/** `width` is the list box's width when the caller measured it already (all lists are measured before any is changed). */
function apply(host: HTMLElement, opts: { resetPage?: boolean; scroll?: boolean; width?: number } = {}): boolean {
  // Streamed sections arrive as HTML before React hydrates them: wait until React is done with this one
  // (an early bar or changed row is a hydration error that re-renders the section on the client).
  const all = itemsOf(host);
  if (!hydratedPast(boxOf(host), host, all.at(-1))) return false;
  // From here the pager owns paging for this list: the CSS first-page rule steps aside.
  if (!host.hasAttribute('data-pager-live')) host.setAttribute('data-pager-live', '');
  all.forEach((r) => { if (r.hidden) out(r, false); });
  const items = all.filter((r) => !r.hidden);
  // A long table holds only its first rows until someone uses it (LaterBody): count the rows still to come,
  // so every page shows. Any use of the table renders them before the click that pages it.
  const body = host instanceof HTMLTableElement ? host.tBodies[0] : null;
  const later = body?.hasAttribute('data-rows-pending') && items.length === all.length ? Math.max(0, Number(body.dataset.rowsTotal) - all.length) : 0;
  const count = items.length + later;
  const choices = sizes();
  const fallback = Number(host.dataset.page) || choices[0];
  const old = state.get(host);
  // A new set of rows (another selection, a refresh) starts again from page 1.
  const fresh = !old || old.first !== (items[0] ?? null) || old.count !== count || !!opts.resetPage;
  const s: State = fresh ? { size: old?.size ?? fallback, page: 0, first: items[0] ?? null, count } : old;
  state.set(host, s);

  let bar = barFor(host);
  if (count <= choices[0] && count <= fallback) { items.forEach((r) => out(r, false)); bar?.remove(); return true; }

  const size = s.size || count;
  const pages = Math.max(1, Math.ceil(count / size));
  s.page = Math.min(s.page, pages - 1);
  const from = s.page * size, to = Math.min(count, from + size);
  items.forEach((r, i) => out(r, i < from || i >= to));

  if (!bar) {
    bar = document.createElement('nav');
    bar.className = 'pager';
    // Below the element's scroll box when it has one, so the bar never scrolls away with the rows.
    boxOf(host).after(bar);
  }
  const label = host.getAttribute('aria-label') ?? host.closest('section')?.querySelector('h2, h3')?.textContent ?? 'list';
  bar.setAttribute('aria-label', `Pages: ${label}`);
  // A narrow column (a side panel) gets ‹ 3 / 16 › instead of a row of page numbers.
  // Measured on the list's own box: 0 means not laid out (a hidden tab), which is not narrow.
  // Phones give the numbers a row of their own: they show whenever the widest row (‹ 1 2 3 4 … 22 ›, 36px
  // buttons, 5px apart) fits the list's width, so a phone keeps its page numbers and their green lens.
  const boxWidth = opts.width ?? boxOf(host).getBoundingClientRect().width;
  const shownNums = Math.min(pages, 6), gaps = pages > 6 ? 1 : 0;
  const phoneRow = (shownNums + 2) * 36 + gaps * 14 + (shownNums + gaps + 1) * 5;
  const narrow = boxWidth > 0 && (matchMedia(PHONE).matches ? phoneRow > boxWidth : boxWidth < 360);
  const btn = (p: number, text: string, extra = '') => `<button type="button" data-go="${p}" ${extra}>${text}</button>`;
  const numbers = narrow
    ? `<span class="pager-of" aria-current="page">${s.page + 1} / ${pages}</span>`
    : pageList(s.page, pages).map((p) => (p == null ? '<span class="pager-gap" aria-hidden="true">…</span>' : btn(p, String(p + 1), `aria-label="Page ${p + 1}" ${p === s!.page ? 'aria-current="page"' : ''}`))).join('');
  const html =
    `<span class="pager-count">${from + 1}–${to} of ${count}</span>` +
    (pages > 1
      ? `<span class="pager-pages">${btn(s.page - 1, '‹', `aria-label="Previous page" ${s.page === 0 ? 'disabled' : ''}`)}${numbers}${btn(s.page + 1, '›', `aria-label="Next page" ${s.page >= pages - 1 ? 'disabled' : ''}`)}</span>`
      : '') +
    `<span class="pager-sizes" role="group" aria-label="Rows per page">${choices.map((c) => `<button type="button" data-size="${c}" aria-pressed="${c === s!.size}">${c || 'All'}</button>`).join('')}</span>`;
  // Rewritten only when something on it changed: the pager re-runs on every DOM change the page makes.
  if (written.get(bar) !== html) {
    // Keyboard focus stays on the same control through the rewrite (it used to drop to the page).
    const had = bar.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
    const key = had?.getAttribute('aria-label') ?? (had?.dataset.size != null ? `size:${had.dataset.size}` : null);
    bar.innerHTML = html;
    written.set(bar, html);
    placeLens(bar);
    if (key) {
      const again = key.startsWith('size:') ? bar.querySelector<HTMLElement>(`[data-size="${key.slice(5)}"]`) : [...bar.querySelectorAll<HTMLElement>('button')].find((b) => b.getAttribute('aria-label') === key);
      (again && !(again as HTMLButtonElement).disabled ? again : bar.querySelector<HTMLElement>('button[aria-current="page"], button:not(:disabled)'))?.focus({ preventScroll: true });
    }
  }
  // A new set of rows (a search, another selection) lays out from scratch: no spacer kept from paging.
  if (fresh) bar.style.removeProperty('margin-top');
  const here = bar;
  // The bar stays under the finger that pressed it: paging to a shorter page leaves the space the rows took
  // (a spacer above the bar, removed as longer pages come back), and changing rows per page scrolls the page
  // by exactly what the list grew or shrank. Pages used to jump when a short last page pulled the bar up.
  here.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || b.disabled) return;
    const cur = state.get(host)!;
    const box = boxOf(host);
    const before = box.offsetHeight, barTop = here.getBoundingClientRect().top;
    if (b.dataset.go != null) {
      // Whether this page change scrolls up to the list's start (a list that begins far above the screen).
      const toStart = host.getBoundingClientRect().top < -innerHeight * 0.6;
      cur.page = Number(b.dataset.go);
      apply(host, { scroll: true });
      const spacer = Math.max(0, (parseFloat(here.style.marginTop) || 0) + before - box.offsetHeight);
      if (spacer) here.style.marginTop = `${spacer}px`; else here.style.removeProperty('margin-top');
      // Near the page's end the shorter page shortened the document for a moment and the browser pulled the
      // scroll up to fit, before the spacer gave the height back; put the bar back under the finger.
      if (!toStart) {
        const drift = here.getBoundingClientRect().top - barTop;
        if (Math.abs(drift) > 1) window.scrollBy({ top: drift, behavior: 'instant' });
      }
    } else {
      const first = cur.page * (cur.size || count);
      cur.size = Number(b.dataset.size);
      cur.page = cur.size ? Math.floor(first / cur.size) : 0;
      here.style.removeProperty('margin-top');
      apply(host);
      const drift = here.getBoundingClientRect().top - barTop;
      if (Math.abs(drift) > 1) window.scrollBy({ top: drift, behavior: 'instant' });
    }
  };
  // New page: its first rows in view. A scroll box goes back to its top; the page itself scrolls only when the
  // list starts far above the screen (a long page), never for a list that is already in view.
  if (opts.scroll) {
    if (host.scrollHeight > host.clientHeight) host.scrollTop = 0;
    if (host.getBoundingClientRect().top < -innerHeight * 0.6) host.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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
      // Every measurement first, then every change: one layout for the whole pass, not one per list.
      const hosts = [...document.querySelectorAll<HTMLElement>(SELECTOR)];
      const widths = hosts.map((el) => boxOf(el).getBoundingClientRect().width);
      hosts.forEach((el, i) => { if (!apply(el, { width: widths[i] })) pending = true; });
      clearTimeout(retry);
      if (pending) retry = setTimeout(run, 250);
    };
    // Until the first load has hydrated, CSS shows each list's first page (globals.css, "Before the pager
    // takes over"): changing rows or adding a bar while React still hydrates them was a hydration error.
    let ready = false;
    const schedule = () => { if (ready && !queued) { queued = true; setTimeout(run, 16); } }; // a timer, not a frame: background tabs stay in step
    const stopWaiting = afterHydration(() => { ready = true; run(); });
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
    // A long table's later rows just arrived (LaterBody): page them before the browser paints.
    const onRowsIn = (e: Event) => { const table = (e.target as Element).closest('table'); if (ready && table) apply(table); };
    document.addEventListener('peregrine:rows-in', onRowsIn);
    // A resize (a phone turned) moves the numbers without rewriting the bar: the lenses follow at once, a shown tab gets one.
    let frame = 0;
    const onResize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => document.querySelectorAll<HTMLElement>('.pager').forEach((b) => placeLens(b, false))); };
    addEventListener('resize', onResize);
    document.addEventListener('click', onResize);
    // Crossing the phone breakpoint changes the page sizes.
    const mq = matchMedia(PHONE);
    const onBreak = () => document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => { state.delete(el); apply(el); });
    mq.addEventListener('change', onBreak);
    return () => { stopWaiting(); clearTimeout(retry); mo.disconnect(); document.removeEventListener('click', onClick); document.removeEventListener('peregrine:rows-in', onRowsIn); removeEventListener('resize', onResize); document.removeEventListener('click', onResize); cancelAnimationFrame(frame); mq.removeEventListener('change', onBreak); };
  }, []);
  return null;
}
