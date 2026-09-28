'use client';
import { useEffect } from 'react';

// Decorative animations that loop forever: shimmering mood words, flames, the live dot, the Analyze glow,
// the Nansen sheen, the ticker, skeleton pulses, the 404 scene.
const LOOPING = '.live-dot, .analyze-glow, .mood-word, .mood-icon, .mood-arc, .get-nansen, .ticker-track, .nf-sweep, .nf-blip, .nf-falcon, .nf-code, .animate-ping, .animate-pulse';
// SVGs whose particles move with SMIL (<animateMotion>): the flow rings and capital-flow maps.
const SMIL = 'svg:has(animateMotion, animate, animateTransform)';
const ANY = `${LOOPING}, ${SMIL}`;
// React sets a fiber reference on a node once it has hydrated it (see MotionObserver).
const hydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith('__reactFiber'));

/** Pauses looping animations while they are off screen, and resumes them as they scroll back in.
 *  Off-screen CSS animations and SMIL particles otherwise keep repainting every frame (Predict alone
 *  ran 27 of them, most below the fold). One observer for the app; streamed-in content is picked up. */
export function OffscreenPause() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target;
        if (el instanceof SVGSVGElement && el.matches(SMIL)) {
          if (e.isIntersecting) el.unpauseAnimations(); else el.pauseAnimations();
        } else el.toggleAttribute('data-offscreen', !e.isIntersecting);
      }
    }, { rootMargin: '100px 0px' });

    // Only new content is searched (a whole-page :has() query on every DOM change was measurable on long
    // pages). Marking an element React has not hydrated yet would make its markup differ from the server's:
    // those wait in `waiting` and are checked again shortly (hydration itself changes no DOM).
    const roots = new Set<Element>();
    const waiting = new Set<Element>();
    let t = 0, until = 0;
    const take = (el: Element) => {
      if (seen.has(el)) return;
      if (!hydrated(el)) { waiting.add(el); return; }
      waiting.delete(el); seen.add(el); io.observe(el);
    };
    const scan = () => {
      for (const r of roots) { if (r.matches(ANY)) take(r); r.querySelectorAll(ANY).forEach(take); }
      roots.clear();
      [...waiting].forEach((el) => (el.isConnected ? take(el) : waiting.delete(el)));
      window.clearTimeout(t);
      if (waiting.size && Date.now() < until) t = window.setTimeout(scan, 250);
    };
    const later = () => { until = Date.now() + 8000; window.clearTimeout(t); t = window.setTimeout(scan, 150); };
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => { if (n instanceof Element) roots.add(n); });
      if (roots.size) later();
    });
    roots.add(document.body);
    later();
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); window.clearTimeout(t); };
  }, []);
  return null;
}
