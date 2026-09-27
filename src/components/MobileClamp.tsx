'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const PREVIEW = 420; // px shown before "Show all"
const hydrated = (el: Element) => Object.keys(el).some((k) => k.startsWith('__reactFiber'));

/** Phones: long panels open as a preview. Each top-level panel taller than ~0.65 screens shows its first
 *  PREVIEW px under a fade, with one tap to expand. Data attributes only, so React's own markup is untouched. */
export function MobileClamp() {
  const path = usePathname();
  useEffect(() => {
    const phone = matchMedia('(max-width: 639px)');
    let t: ReturnType<typeof setTimeout> | undefined;
    const apply = () => {
      if (!phone.matches) return;
      const limit = Math.max(540, innerHeight * 0.65);
      for (const s of document.querySelectorAll<HTMLElement>('main .material, main [data-clamp-me]')) {
        if (s.dataset.clamp || s.parentElement?.closest('.material, [data-clamp]') || !hydrated(s)) continue;
        // Primary content (a price chart, a scorecard) opts out with data-no-clamp.
        if (s.scrollHeight < limit || s.matches('[data-no-clamp]') || s.querySelector('[data-no-clamp]')) continue;
        // A panel whose list is split into pages is already short: no second "Show all".
        if (s.querySelector('[data-page], table[data-sortable]')) continue;
        s.dataset.clamp = 'closed';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'clamp-toggle';
        btn.textContent = 'Show all';
        btn.onclick = () => {
          const open = s.dataset.clamp === 'closed';
          s.dataset.clamp = open ? 'open' : 'closed';
          btn.textContent = open ? 'Show less' : 'Show all';
          if (!open) s.scrollIntoView({ block: 'start', behavior: 'smooth' });
        };
        s.appendChild(btn);
      }
    };
    const soon = () => { clearTimeout(t); t = setTimeout(apply, 500); };
    soon();
    const mo = new MutationObserver(soon);
    const main = document.querySelector('main');
    if (main) mo.observe(main, { childList: true, subtree: true });
    return () => { clearTimeout(t); mo.disconnect(); };
  }, [path]);
  return null;
}

export const CLAMP_PREVIEW = PREVIEW;
