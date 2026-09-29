'use client';
import { useEffect } from 'react';
// Touching a node React has not hydrated yet is a hydration mismatch, so motion waits for it.
import { isHydrated as hydrated } from '@/lib/hydration';

const SELECTOR = '.draw, .stagger';

/** Plays each chart draw-in (`.draw`) and tile cascade (`.stagger`) once,
 *  as it enters the viewport, by setting `data-in-view`. One
 *  IntersectionObserver for the whole app. Streamed content hydrates after
 *  it arrives, so new or not-yet-hydrated nodes are re-checked for a few
 *  seconds after any DOM change. Without JS, or with reduced motion,
 *  everything simply shows (see globals.css). */
export function MotionObserver() {
  useEffect(() => {
    const play = (el: Element) => {
      el.setAttribute('data-in-view', '');
      io.unobserve(el);
    };
    // The observer's first report on a node plays it if any of it is on screen (as a page opens); after that it
    // waits until 15% has scrolled in. Positions come from the observer, never read here: reading layout inside
    // every React commit forced extra layouts on long pages.
    const reported = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const first = !reported.has(e.target);
          reported.add(e.target);
          if (e.isIntersecting && (first || e.intersectionRatio >= 0.15)) play(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: [0, 0.15] },
    );
    // Only new content is searched (a whole-document query after every DOM change was measurable on long
    // pages); nodes React has not hydrated yet wait in `waiting` and are checked again shortly.
    const seen = new WeakSet<Element>();
    const roots = new Set<Element>();
    const waiting = new Set<Element>();
    // On the first pass (the page as it opens), what is already on screen plays at once, in the same style pass
    // that turns motion on; later content waits for the observer's report.
    let opening = true;
    const take = (el: Element) => {
      if (seen.has(el) || el.hasAttribute('data-in-view')) return;
      if (!hydrated(el)) { waiting.add(el); return; }
      waiting.delete(el);
      seen.add(el);
      if (opening) { const r = el.getBoundingClientRect(); if (r.width && r.height && r.top < innerHeight * 0.92 && r.bottom > 0) { el.setAttribute('data-in-view', ''); return; } }
      io.observe(el);
    };
    let timer = 0;
    let until = 0;
    const scan = () => {
      window.clearTimeout(timer);
      for (const r of roots) { if (r.matches(SELECTOR)) take(r); r.querySelectorAll(SELECTOR).forEach(take); }
      roots.clear();
      [...waiting].forEach((el) => (el.isConnected ? take(el) : waiting.delete(el)));
      if (waiting.size && Date.now() < until) timer = window.setTimeout(scan, 120);
    };
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => { if (n instanceof Element) roots.add(n); });
      if (roots.size) { until = Date.now() + 6000; scan(); }
    });
    document.documentElement.classList.add('motion-ready');
    roots.add(document.body);
    until = Date.now() + 6000;
    scan();
    opening = false;
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); window.clearTimeout(timer); };
  }, []);
  return null;
}
