import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';

// Inline direction marks, sized to the surrounding text. Replace the old
// typographic arrows so every link and delta uses the same drawn glyph.
const inline = 'inline-block h-[1.05em] w-[1.05em] shrink-0 align-[-0.17em]';

/** "Go to": trailing mark on links and buttons (nudges right on hover inside .pill-button). */
export const Go = () => <ChevronRight className={`arrow ${inline} -mr-0.5`} strokeWidth={2.25} aria-hidden />;
/** "Back": leading mark on back links. */
export const Back = () => <ChevronLeft className={`${inline} -ml-0.5`} strokeWidth={2.25} aria-hidden />;
/** A rise. */
export const Up = () => <ArrowUpRight className={inline} strokeWidth={2.25} aria-hidden />;
/** A fall. */
export const Down = () => <ArrowDownRight className={inline} strokeWidth={2.25} aria-hidden />;
