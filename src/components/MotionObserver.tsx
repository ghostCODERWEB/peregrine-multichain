'use client';
import { useEffect } from 'react';

const SELECTOR = '.draw, .stagger';

/** React sets a fiber reference on a node once it has hydrated it. Touching
 *  a node before that is a hydration mismatch, so motion waits for it. */
const hydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith('__reactFiber'));

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
      pending.delete(el);
      io.unobserve(el);
    };
    const io = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) play(e.target); },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.15 },
    );
    const pending = new Set<Element>();
    const scan = () => {
      let waiting = false;
      document.querySelectorAll(`:is(${SELECTOR}):not([data-in-view])`).forEach((el) => {
        if (pending.has(el)) return;
        if (!hydrated(el)) { waiting = true; return; }
        pending.add(el);
        io.observe(el);
        // Already on screen: play now (the observer's first report can lag a moved node).
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.top < innerHeight * 0.92 && r.bottom > 0) play(el);
      });
      return waiting;
    };
    let timer = 0;
    let until = 0;
    const poll = () => {
      window.clearTimeout(timer);
      if (scan() && Date.now() < until) timer = window.setTimeout(poll, 120);
    };
    const kick = () => { until = Date.now() + 6000; poll(); };
    const mo = new MutationObserver(kick);
    document.documentElement.classList.add('motion-ready');
    kick();
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); window.clearTimeout(timer); };
  }, []);
  return null;
}
