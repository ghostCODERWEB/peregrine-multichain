'use client';
import { useEffect, useRef } from 'react';

/**
 * A section whose results reload under its own controls holds its height from the moment one of its controls
 * is pressed until it leaves the screen. It can grow, never shrink, meanwhile: near the page's end a shorter
 * answer made the page shorter, the browser scrolled up to fit, and the buttons just pressed moved.
 */
export function useHoldHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hold = (e: Event) => {
      if (!(e.target as Element).closest('button, input, select, [role=radio]')) return;
      el.style.minHeight = `${Math.max(el.offsetHeight, parseFloat(el.style.minHeight) || 0)}px`;
    };
    el.addEventListener('pointerdown', hold, true);
    el.addEventListener('keydown', hold, true);
    const io = new IntersectionObserver(([e]) => { if (!e.isIntersecting) el.style.removeProperty('min-height'); });
    io.observe(el);
    return () => { el.removeEventListener('pointerdown', hold, true); el.removeEventListener('keydown', hold, true); io.disconnect(); };
  }, []);
  return ref;
}
