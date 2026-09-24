// The dark theme's tokens as literal hex for share images: satori (next/og)
// renders outside the page, so CSS variables don't resolve there. Mirrors
// the .dark block of globals.css — keep the two in step.
export const OG = {
  page: '#0b0e11', surface: '#12161c', surface2: '#181d24', ink: '#eaecef', ink2: '#a3aab5', muted: '#7a8391', grid: '#1a1f27', axis: '#2a313b', mid: '#2b323c',
  'out-1': '#9a2a3c', 'out-3': '#f04a5f', 'out-4': '#ff9aa6', 'in-1': '#0e6a5f', 'in-3': '#16a394', 'in-4': '#6fd6c4',
  'storm-1': '#6b4e0a', 'storm-2': '#a87a0a', 'storm-3': '#e0a312', 'storm-4': '#ffd36b',
  brand: '#8a7dff', onDark: '#eaecef', onLight: '#0b0e11',
} as const;

/** Ink on a filled class, by measured contrast (globals.css --on-*): the
 *  bright steps (3–4) and storm-2 take dark ink; the deep steps light ink. */
export const ogInk = (cls: string) => (/-(3|4)$/.test(cls) || cls === 'storm-2' ? OG.onLight : OG.onDark);
