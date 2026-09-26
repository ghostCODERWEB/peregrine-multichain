'use client';
import { useEffect, useState } from 'react';

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

/**
 * Canvas charts (ECharts) can't use var(--token), so this resolves the
 * theme's tokens to concrete colors and re-resolves when the theme class on
 * <html> flips — charts re-render in the new theme instead of keeping stale
 * colors from first paint. null until mounted (no document on the server).
 */
export function useThemeColors(): ThemeColors | null {
  const [colors, setColors] = useState<ThemeColors | null>(null);
  useEffect(() => {
    setColors(read());
    const mo = new MutationObserver(() => setColors(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return colors;
}
