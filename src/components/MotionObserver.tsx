'use client';
import { useEffect } from 'react';

const SELECTOR = '.draw, .stagger';

/** Plays each chart draw-in (`.draw`) and tile cascade (`.stagger`) once,
 *  as it enters the viewport. One IntersectionObserver for the whole app; a
 *  MutationObserver picks up content that streams in later. Without JS, or
 *  with reduced motion, everything simply shows (see globals.css). */
export function MotionObserver() {
  useEffect(() => {
    const root = document.documentElement;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) play(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.15 },
    );
    // Per-instance, so a remount (React dev double-effects) re-observes everything.
    const pending = new Set<Element>();
    const play = (el: Element) => {
      el.classList.add('in-view');
      pending.delete(el);
      io.unobserve(el);
    };
    const scan = () => {
      document.querySelectorAll(`:is(${SELECTOR}):not(.in-view)`).forEach((el) => {
        if (pending.has(el)) return;
        pending.add(el);
        io.observe(el);
      });
      // Streamed content is observed while still in React's hidden holder and
      // then moved into place; check what is already on screen directly.
      for (const el of pending) {
        const r = el.getBoundingClientRect();
        if (r.width && r.height && r.top < innerHeight * 0.92 && r.bottom > 0) play(el);
      }
    };
    let frame = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    scan();
    root.classList.add('motion-ready');
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
