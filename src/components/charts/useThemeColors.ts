'use client';
import { useSyncExternalStore } from 'react';

const TOKENS = [
  'surface-page', 'surface-1', 'surface-2', 'ink-1', 'ink-2', 'ink-muted', 'grid', 'axis', 'mid',
  'out-1', 'out-2', 'out-3', 'out-4', 'in-1', 'in-2', 'in-3', 'in-4',
  'storm-1', 'storm-2', 'storm-3', 'storm-4',
  'on-out-4', 'on-out-3', 'on-out-1', 'on-mid', 'on-in-1', 'on-in-3', 'on-in-4',
  'mint', 'flare', 'signal', 'amber', 'violet',
] as const;

export type ThemeColors = Record<(typeof TOKENS)[number], string>;

function read(): ThemeColors {
  const s = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t, s.getPropertyValue(`--${t}`).trim()])) as ThemeColors;
}

// One store for every chart on the page: the tokens are read once, not once per chart, and one observer
// watches the theme class.
let colors: ThemeColors | null = null;
const listeners = new Set<() => void>();
let watching = false;
let scheduled = false;

function refresh() {
  scheduled = false;
  const next = read();
  // Only a real change re-renders the charts: other classes on <html> (motion-ready, public-site) change too.
  if (colors && TOKENS.every((t) => colors![t] === next[t])) return;
  colors = next;
  listeners.forEach((l) => l());
}

/** The first read waits until just after a frame, when styles are already worked out: reading computed
 *  style in the middle of hydration made the browser style the whole page early, and again later. */
function scheduleFirstRead() {
  if (scheduled) return;
  scheduled = true;
  const once = () => { if (scheduled) refresh(); };
  requestAnimationFrame(() => setTimeout(once, 0));
  setTimeout(once, 250); // a background tab runs no frames
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watching) {
    watching = true;
    new MutationObserver(() => { if (colors) refresh(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
  if (!colors) scheduleFirstRead();
  return () => { listeners.delete(listener); };
}

/**
 * Canvas charts (ECharts) can't use var(--token), so this resolves the
 * theme's tokens to concrete colors and re-resolves when the theme class on
 * <html> flips — charts re-render in the new theme instead of keeping stale
 * colors from first paint. null on the server and while the page first
 * hydrates; charts mounted later get the colors at once.
 */
export function useThemeColors(): ThemeColors | null {
  return useSyncExternalStore(subscribe, () => colors, () => null);
}
