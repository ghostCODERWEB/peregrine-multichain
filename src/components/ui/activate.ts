import type { KeyboardEvent } from 'react';

/** A clickable table row that keyboards can use too: reachable with Tab, opened with Enter or Space, like the
 *  click that opens it. (A <tr> keeps its table role; the row's own links and buttons still work as before.) */
export function activateProps(onActivate: () => void) {
  return {
    tabIndex: 0,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return; // a link or button inside the row handles its own keys
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
    },
  };
}
