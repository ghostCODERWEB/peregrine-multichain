'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { hydratedPast } from '@/lib/hydration';

const PREVIEW = 420; // px shown before "Show all"

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
      // Hydration finishing changes no DOM, so no mutation would bring us back: retry until every panel is ready.
      let pending = false;
      for (const s of document.querySelectorAll<HTMLElement>('main .material, main [data-clamp-me]')) {
        if (s.dataset.clamp || s.parentElement?.closest('.material, [data-clamp]')) continue;
        // The button goes inside the panel: only once React has finished hydrating it (see hydratedPast).
        if (!hydratedPast(s)) { pending = true; continue; }
        // Primary content (a price chart, a scorecard) opts out with data-no-clamp.
        if (s.scrollHeight < limit || s.matches('[data-no-clamp]') || s.querySelector('[data-no-clamp]')) continue;
        // Paged tables and lists are already short; a second 'Show all' would hide their page numbers.
        if (s.querySelector('table[data-sortable], table[data-page], .m-list, [data-paged]')) continue;
        // Never fold a form: its submit button would end up under the fade (a call could be filled in and not locked).
        if (s.querySelector('form, input:not([type=hidden]), select, textarea, [role=radiogroup]')) continue;
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
      if (pending) { clearTimeout(t); t = setTimeout(apply, 300); }
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
