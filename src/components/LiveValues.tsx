'use client';
import { useEffect } from 'react';
import { afterHydration } from '@/lib/hydration';

// Live changes eased in instead of snapping: a figure that changes (a refetch, a fresher answer) fades from
// soft to sharp, and a block that arrives (rows, tiles, results) fades and settles in. Only after the first
// load: the page's own entrance animations (MotionObserver, page-enter) cover that.
const SKIP = '.echarts-for-react, svg, .ticker, .pager, time, input, textarea, select, [data-analyze-dock], .section-rail, .map-bubble, [aria-busy="true"], [data-no-live]';
const EASE = 'cubic-bezier(.22,1,.36,1)';
const PAGE_SIZED = 400; // a new page (navigation) brings its own entrance

export function LiveValues() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const main = document.querySelector('main');
    if (!main) return;
    let mo: MutationObserver | null = null;
    const stop = afterHydration(() => {
      mo = new MutationObserver((records) => {
        const values = new Set<HTMLElement>();
        const blocks = new Set<HTMLElement>();
        const removed = new Set<Node>();
        for (const r of records) r.removedNodes.forEach((n) => removed.add(n));
        for (const r of records) {
          if (r.type === 'characterData') { const el = r.target.parentElement?.closest<HTMLElement>('.num'); if (el) values.add(el); continue; }
          r.addedNodes.forEach((n) => {
            if (removed.has(n)) return; // moved (a sort), not new
            if (n.nodeType === Node.TEXT_NODE) { const el = n.parentElement?.closest<HTMLElement>('.num'); if (el) values.add(el); return; }
            // Rows on another page (paged out, filtered) arrive unseen: nothing to ease in.
            if (n instanceof HTMLElement && !n.hidden && !n.hasAttribute('data-paged-out') && !n.closest(SKIP) && n.getElementsByTagName('*').length < PAGE_SIZED && !n.classList.contains('page-enter')) blocks.add(n);
          });
        }
        // Only the outermost new block animates; a value inside a new block comes in with it.
        const outer = [...blocks].filter((b) => ![...blocks].some((o) => o !== b && o.contains(b))).slice(0, 80);
        for (const b of outer) b.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE });
        for (const v of values) {
          if (v.closest(SKIP) || outer.some((b) => b.contains(v))) continue;
          v.animate([{ opacity: 0.35, filter: 'blur(1.5px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 450, easing: EASE });
        }
      });
      mo.observe(main, { subtree: true, childList: true, characterData: true });
    });
    return () => { stop(); mo?.disconnect(); };
  }, []);
  return null;
}
