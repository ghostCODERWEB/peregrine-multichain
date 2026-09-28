'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useSite } from '@/components/SiteContext';
import { AnalyzeButton } from './AnalyzeButton';

// The panel (chat, element picking, the genie) loads on first use (or when a pointer rests on the button),
// not in every page's first load. No idle preload: starting its modules is a long task on a slow phone.
const load = () => import('./AnalyzeDock');
const AnalyzeDock = dynamic(() => load().then((m) => m.AnalyzeDock), { ssr: false });

/** The Analyze button and its triggers (⌘J, openAnalyze(), the tab bar's Ask). Hands over to the full panel, opened, on first use. */
export function AnalyzeLauncher() {
  const { publicSite } = useSite();
  const [initial, setInitial] = useState<{ el: HTMLElement | null } | null>(null);
  useEffect(() => {
    if (publicSite || initial) return;
    const open = (el: HTMLElement | null = null) => setInitial({ el });
    const onOpen = (e: Event) => { const el = (e as CustomEvent<Element | null>).detail; open(el instanceof HTMLElement ? el : null); };
    const onToggle = () => open();
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); open(); } };
    window.addEventListener('peregrine:analyze', onOpen);
    window.addEventListener('peregrine:analyze-toggle', onToggle);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('peregrine:analyze', onOpen); window.removeEventListener('peregrine:analyze-toggle', onToggle); window.removeEventListener('keydown', onKey); };
  }, [publicSite, initial]);
  if (publicSite) return null;
  if (initial) return <AnalyzeDock initial={initial} />;
  return <AnalyzeButton onClick={() => setInitial({ el: null })} onPointerEnter={() => void load()} />;
}
