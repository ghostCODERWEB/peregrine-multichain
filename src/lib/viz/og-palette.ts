// The navy theme's tokens as literal hex for share images: satori (next/og)
// renders outside the page, so CSS variables don't resolve there. Mirrors
// the dark block of globals.css — keep the two in step.
export const OG = {
  page: '#0a1220', surface: '#111c2e', surface2: '#17243a', ink: '#e8edf5', ink2: '#b4bfd0', muted: '#8a96ab', grid: '#1c2940', axis: '#2a3a55', mid: '#2a3447',
  'out-1': '#1c5cab', 'out-3': '#6da7ec', 'out-4': '#b7d3f6', 'in-1': '#884d01', 'in-3': '#e98916', 'in-4': '#fec28f',
  'storm-1': '#a82571', 'storm-2': '#ca488f', 'storm-3': '#ed68ae', 'storm-4': '#ff98ca',
  onDark: '#e8edf5', onLight: '#0a1220',
} as const;

/** Ink on a filled class: light fills (step 3-4 in navy) take dark ink. */
export const ogInk = (cls: string) => (/-(3|4)$/.test(cls) ? OG.onLight : OG.onDark);
