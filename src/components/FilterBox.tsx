'use client';
import { useEffect, useRef, useState } from 'react';
import { wantAllRows } from '@/components/LaterBody';

/** Search and category chips for a server-rendered list. Items opt in with
 *  `data-search="…text…"` and optionally `data-group="a|b"` (any of); groups (a
 *  `<details data-filter-group>` or any element with that attribute) hide
 *  when none of their items match and open while a search is active. */
export function FilterBox({ target, placeholder, groups = [], label }: { target: string; placeholder: string; groups?: string[]; label: string }) {
  const [q, setQ] = useState('');
  // A link can arrive pre-filtered: /predict?q=Politics.
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('q');
    if (initial) setQ(initial);
  }, []);
  const [group, setGroup] = useState<string | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const opened = useRef(new Set<HTMLDetailsElement>());

  useEffect(() => {
    const root = document.querySelector(target);
    if (!root) return;
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const apply = () => {
      let n = 0;
      root.querySelectorAll<HTMLElement>('[data-search]').forEach((el) => {
        const text = el.dataset.search!.toLowerCase();
        const ok = words.every((w) => text.includes(w)) && (!group || (el.dataset.group ?? '').split('|').includes(group));
        el.hidden = !ok;
        if (ok) n++;
      });
      root.querySelectorAll<HTMLElement>('[data-filter-group]').forEach((g) => {
        const any = [...g.querySelectorAll<HTMLElement>('[data-search]')].some((el) => !el.hidden);
        g.hidden = !any;
        if (g instanceof HTMLDetailsElement) {
          if (words.length && any && !g.open) { g.open = true; opened.current.add(g); }
          if (!words.length && opened.current.has(g)) { g.open = false; opened.current.delete(g); }
        }
      });
      setShown(words.length || group ? n : null);
    };
    apply();
    if (!words.length && !group) return;
    // A search searches every row, including a long table's rows it has not rendered yet (LaterBody).
    wantAllRows();
    // Rows that arrive while a search is on (a long table filling in after load) are filtered as well.
    const mo = new MutationObserver(apply);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [q, group, target]);

  return (
    <div className="flex flex-wrap items-center gap-2" role="search" aria-label={label}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="inset-well min-h-[36px] w-full rounded-[10px] px-3 text-[13px] text-ink placeholder:text-ink-muted sm:w-72"
      />
      {groups.length > 0 && (
        <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
          {[null, ...groups].map((g) => (
            <button
              key={g ?? 'all'}
              type="button"
              aria-pressed={group === g}
              onClick={() => setGroup(g)}
              className={`min-h-[32px] shrink-0 whitespace-nowrap rounded-full px-3 text-[12px] font-bold ${group === g ? 'bg-ink/15 text-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              {g ?? 'All'}
            </button>
          ))}
        </div>
      )}
      <span className="text-[12px] text-ink-muted" aria-live="polite">{shown != null ? `${shown} match${shown === 1 ? '' : 'es'}` : ''}</span>
    </div>
  );
}
