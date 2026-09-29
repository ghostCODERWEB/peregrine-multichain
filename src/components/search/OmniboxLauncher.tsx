'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

// The palette (results, commands, previews) is only needed once someone searches: it loads on first use
// (or when a pointer rests on the trigger), not in every page's first load. No idle preload: starting its
// modules is a long task on a slow phone, right after the page has loaded.
const load = () => import('./Omnibox');
const Omnibox = dynamic(() => load().then((m) => m.Omnibox), { ssr: false });
const TRIGGER = 'liquid-chip liquid-control hidden h-8 items-center gap-2 rounded-xl px-2 text-[12px] text-ink-muted hover:text-ink lg:flex lg:h-9 lg:w-full lg:px-2.5';

/** The search trigger and its shortcuts (⌘K, /). Hands over to the full Omnibox, opened, on first use. */
export function OmniboxLauncher() {
  const [wanted, setWanted] = useState(false);
  useEffect(() => {
    if (wanted) return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) { e.preventDefault(); setWanted(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wanted]);
  if (wanted) return <Omnibox autoOpen />;
  return (
    <button type="button" onClick={() => setWanted(true)} onPointerEnter={() => void load()} aria-label="Search tokens, wallets, entities, chains and sectors" className={TRIGGER}>
      <Search className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
      <span className="hidden lg:inline">Search</span>
      <kbd className="kbd !hidden lg:ml-auto lg:!inline-flex">⌘K</kbd>
    </button>
  );
}
