// The dark theme's tokens as literal hex for share images: satori (next/og)
// renders outside the page, so CSS variables don't resolve there. Mirrors
// the .dark block of globals.css (translucent inks flattened onto the page) — keep the two in step.
export const OG = {
  page: '#040507', surface: '#101215', surface2: '#191d23', ink: '#ffffff', ink2: '#b3b7bc', muted: '#8a8e93', grid: '#20252b', axis: '#626b78', mid: '#1d232b',
  hair: '#24282e',
  mint: '#00ffa7', flare: '#ff5e2b', signal: '#0099ff', amber: '#ffb224', violet: '#9d8bff',
  'out-1': '#4f2418', 'out-2': '#8f351c', 'out-3': '#d2481f', 'out-4': '#ff5e2b',
  'in-1': '#0c4a38', 'in-2': '#0b7a57', 'in-3': '#00b97e', 'in-4': '#00ffa7',
  'storm-1': '#6b4e0a', 'storm-2': '#a87a0a', 'storm-3': '#e0a312', 'storm-4': '#ffd36b',
  brand: '#00ffa7', onDark: '#ffffff', onLight: '#040507',
} as const;

/** Ink on a filled class, by measured contrast (globals.css --on-*): the
 *  bright steps (3–4) and storm-2 take dark ink; the deep steps light ink. */
export const ogInk = (cls: string) => (/-(3|4)$/.test(cls) || cls === 'storm-2' ? OG.onLight : OG.onDark);
