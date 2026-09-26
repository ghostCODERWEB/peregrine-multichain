'use client';
import { useEffect } from 'react';

const SIZES = [15, 30, 60, 0]; // 0 = all
const state = new WeakMap<HTMLTableElement, number>();

function apply(table: HTMLTableElement) {
  const body = table.tBodies[0];
  if (!body) return;
  const rows = [...body.rows];
  let bar = table.nextElementSibling?.classList.contains('table-pager') ? (table.nextElementSibling as HTMLElement) : (table.parentElement?.nextElementSibling?.classList.contains('table-pager') ? (table.parentElement.nextElementSibling as HTMLElement) : null);
  const size = state.get(table) ?? Number(table.dataset.page || 15);
  if (rows.length <= 15) { rows.forEach((r) => { r.hidden = false; }); bar?.remove(); return; }
  const limit = size || rows.length;
  rows.forEach((r, i) => { r.hidden = i >= limit; });
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'table-pager';
    // Place the bar below the table's scroll box when it has one.
    const host = table.parentElement && getComputedStyle(table.parentElement).overflowY !== 'visible' ? table.parentElement : table;
    host.after(bar);
  }
  const shown = Math.min(limit, rows.length);
  bar.innerHTML = `<span>Showing ${shown} of ${rows.length}</span><span class="table-pager-sizes">${SIZES.map((s) => `<button type="button" data-size="${s}" aria-pressed="${s === size}">${s || 'All'}</button>`).join('')}</span>${shown < rows.length ? `<button type="button" class="table-pager-more" data-more="1">Show ${Math.min(size || 15, rows.length - shown)} more</button>` : ''}`;
  bar.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    const cur = state.get(table) ?? Number(table.dataset.page || 15);
    state.set(table, b.dataset.more ? Math.min(rows.length, (cur || rows.length) + (cur || 15)) : Number(b.dataset.size));
    apply(table);
  };
}

/** Limits long tables (sortable tables or data-page) to a readable number of rows, with size choices and Show more. One listener for the app. */
export function TablePager() {
  useEffect(() => {
    let queued = false;
    const run = () => { queued = false; document.querySelectorAll<HTMLTableElement>('main table[data-sortable], main table[data-page]').forEach(apply); };
    const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
    run();
    const mo = new MutationObserver((muts) => { if (muts.some((m) => !(m.target as HTMLElement).closest?.('.table-pager'))) schedule(); });
    mo.observe(document.body, { childList: true, subtree: true });
    // Sorting reorders rows: re-apply the limit afterwards.
    const onClick = (e: MouseEvent) => { if ((e.target as HTMLElement).closest('table th')) setTimeout(run, 0); };
    document.addEventListener('click', onClick);
    return () => { mo.disconnect(); document.removeEventListener('click', onClick); };
  }, []);
  return null;
}
