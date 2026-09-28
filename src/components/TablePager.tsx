'use client';
import { useEffect } from 'react';
import { hydratedPast } from '@/lib/hydration';

const SIZES = [10, 25, 50, 0]; // 0 = all
const phone = () => window.innerWidth < 640;
const state = new WeakMap<HTMLElement, { page: number; size: number }>();


/** Rows the pager controls: a table's body rows, or a list's direct children. */
const rowsOf = (el: HTMLElement): HTMLElement[] => (el instanceof HTMLTableElement ? [...(el.tBodies[0]?.rows ?? [])] : [...el.children].filter((c) => !c.matches('p, .pager')) as HTMLElement[]);

/** Page numbers to show: first, last, and a window around the current page, with gaps as null. */
function pageList(cur: number, total: number): Array<number | null> {
  const span = phone() ? 1 : 2;
  const out: Array<number | null> = [];
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - cur) <= span) out.push(p);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}

function barOf(el: HTMLElement): HTMLElement | null {
  const next = el.nextElementSibling ?? el.parentElement?.nextElementSibling;
  return next?.classList.contains('pager') ? (next as HTMLElement) : null;
}

/** Where the bar goes: below the table's scroll box when it has one, else right after the list. */
const hostOf = (el: HTMLElement): HTMLElement => (el.parentElement && el instanceof HTMLTableElement && getComputedStyle(el.parentElement).overflowX !== 'visible' ? el.parentElement : el);

function apply(el: HTMLElement): boolean {
  // Streamed sections arrive as HTML before React hydrates them: wait until React is done with this one.
  if (!hydratedPast(hostOf(el))) return false;
  const rows = rowsOf(el);
  // Rows a table filter hid (data-filtered) are not paged.
  const live = rows.filter((r) => !r.hasAttribute('data-filtered'));
  const base = Number(el.dataset.page) || (phone() ? 10 : 15);
  const st = state.get(el) ?? { page: 1, size: base };
  let bar = barOf(el);
  if (live.length <= Math.min(base, SIZES[0] + 2)) {
    rows.forEach((r) => { r.hidden = r.hasAttribute('data-filtered'); });
    bar?.remove();
    return true;
  }
  const size = st.size || live.length;
  const pages = Math.max(1, Math.ceil(live.length / size));
  st.page = Math.min(Math.max(1, st.page), pages);
  state.set(el, st);
  const from = (st.page - 1) * size, to = Math.min(live.length, from + size);
  const onPage = new Set(live.slice(from, to));
  rows.forEach((r) => { r.hidden = !onPage.has(r); });

  if (!bar) {
    bar = document.createElement('nav');
    bar.className = 'pager';
    bar.setAttribute('aria-label', 'Pages');
    hostOf(el).after(bar);
  }
  const sizes = [...new Set([base, ...SIZES])].sort((a, b) => (a || 1e9) - (b || 1e9)).filter((s) => s === 0 || s < live.length);
  const btn = (p: number | null, label?: string, attrs = '') => p === null
    ? '<span class="pager-gap" aria-hidden="true">…</span>'
    : `<button type="button" data-p="${p}" ${attrs}${p === st.page && !label ? ' aria-current="page"' : ''}>${label ?? p}</button>`;
  bar.innerHTML =
    `<span class="pager-count num">${from + 1}–${to} of ${live.length}</span>` +
    (pages > 1
      ? `<span class="pager-pages">${btn(st.page - 1, '‹', `aria-label="Previous page"${st.page === 1 ? ' disabled' : ''}`)}${pageList(st.page, pages).map((p) => btn(p)).join('')}${btn(st.page + 1, '›', `aria-label="Next page"${st.page === pages ? ' disabled' : ''}`)}</span>`
      : '') +
    `<label class="pager-size">Per page <select aria-label="Rows per page">${sizes.map((s) => `<option value="${s}"${s === st.size ? ' selected' : ''}>${s || 'All'}</option>`).join('')}</select></label>`;
  bar.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-p]');
    if (!b || b.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    st.page = Number(b.dataset.p);
    apply(el);
    // Keep the list in view when a short page pulls the bar up the screen.
    const top = el.getBoundingClientRect().top;
    if (top < 0) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  bar.onchange = (e) => {
    const s = e.target as HTMLSelectElement;
    st.size = Number(s.value);
    st.page = 1;
    apply(el);
  };
  return true;
}

/** Splits long tables (sortable tables or data-page) and long lists (data-page) into numbered pages with a
 *  rows-per-page choice. One listener for the app. */
export function TablePager() {
  useEffect(() => {
    let queued = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      queued = false;
      let pending = false;
      document.querySelectorAll<HTMLElement>('main table[data-sortable], main [data-page]').forEach((t) => { if (!apply(t)) pending = true; });
      clearTimeout(retry);
      if (pending) retry = setTimeout(run, 250);
    };
    const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
    run();
    const mo = new MutationObserver((muts) => { if (muts.some((m) => !(m.target as HTMLElement).closest?.('.pager'))) schedule(); });
    // A search filter marks rows with data-filtered: re-page on that too.
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-filtered'] });
    // Sorting reorders rows: re-apply afterwards.
    const onClick = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('table th')) setTimeout(run, 0); };
    document.addEventListener('click', onClick);
    return () => { clearTimeout(retry); mo.disconnect(); document.removeEventListener('click', onClick); };
  }, []);
  return null;
}
