'use client';
import { useEffect } from 'react';

/** Parses what a cell shows into a sortable number: $1.2M, −3.4%, 1.3×, 59h, +12 pts; else null. */
export function cellValue(text: string): number | null {
  const t = text.replace(/[,\s]/g, '').replace(/−/g, '-');
  const m = t.match(/^([+-]?)\$?([+-]?)(\d+(?:\.\d+)?)([KMBT])?/i);
  if (!m) return null;
  const sign = m[1] === '-' || m[2] === '-' ? -1 : 1;
  const mult = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[(m[4] ?? '').toUpperCase() as 'K'] ?? 1;
  return sign * Number(m[3]) * mult;
}

/** Click-to-sort for any table marked `data-sortable` (one listener for the app). */
export function TableSort() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const th = (e.target as HTMLElement).closest('th');
      const table = th?.closest('table[data-sortable]') as HTMLTableElement | null;
      if (!th || !table || !th.textContent?.trim()) return;
      const col = [...th.parentElement!.children].indexOf(th);
      const dir = th.getAttribute('aria-sort') === 'descending' ? 'ascending' : 'descending';
      table.querySelectorAll('th[aria-sort]').forEach((x) => x.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', dir);
      const body = table.tBodies[0];
      if (!body) return;
      const rows = [...body.rows];
      const key = (r: HTMLTableRowElement) => r.cells[col]?.textContent?.trim() ?? '';
      const numeric = rows.filter((r) => cellValue(key(r)) != null).length >= rows.length / 2;
      rows.sort((a, b) => {
        const x = key(a), y = key(b);
        const c = numeric ? (cellValue(x) ?? -Infinity) - (cellValue(y) ?? -Infinity) : x.localeCompare(y);
        return dir === 'ascending' ? c : -c;
      });
      body.append(...rows);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}
