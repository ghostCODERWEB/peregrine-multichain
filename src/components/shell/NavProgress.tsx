'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/** A thin bar along the top edge from the tap on a link until the next page arrives. Pages render on the
 *  server, so without it a tap looked like nothing happened for the length of the request. */
export function NavProgress() {
  const path = usePathname();
  const query = useSearchParams()?.toString();
  const [state, setState] = useState<'idle' | 'going' | 'done'>('idle');
  const timer = useRef(0);

  useEffect(() => {
    // Capture phase: next/link calls preventDefault on the click before a bubbling listener would see it.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (document.querySelector('[data-analyze-dock]:not([role])')?.textContent?.includes('Click a chart')) return; // Analyze's pick mode takes the click
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      window.clearTimeout(timer.current);
      setState('going');
      // A navigation that never lands (cancelled, failed) must not leave the bar up.
      timer.current = window.setTimeout(() => setState('idle'), 15_000);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    setState((s) => (s === 'going' ? 'done' : s));
    timer.current = window.setTimeout(() => setState((s) => (s === 'done' ? 'idle' : s)), 320);
    return () => window.clearTimeout(timer.current);
  }, [path, query]);

  return <div aria-hidden className={`nav-progress ${state === 'idle' ? '' : `is-${state}`}`} />;
}
