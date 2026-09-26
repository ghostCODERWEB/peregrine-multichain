'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { readRecent, remember, type RecentItem } from './recent';

type Nav = { canGoBack?: boolean; canGoForward?: boolean; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };

/** Browser-like investigation navigation: Back, Forward and Recently viewed.
 *  URL state carries each view's filters and selection, so stepping back
 *  restores the exact view. */
export function WorkspaceBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [can, setCan] = useState({ back: true, forward: true });
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nav = (window as unknown as { navigation?: Nav }).navigation;
    const read = () => setCan({ back: nav?.canGoBack ?? window.history.length > 1, forward: nav?.canGoForward ?? true });
    // Next writes history inside a React insertion effect, and the Navigation API
    // reports it synchronously: defer, since state updates are not allowed there.
    const sync = () => { setTimeout(read, 0); };
    read();
    nav?.addEventListener?.('currententrychange', sync);
    return () => nav?.removeEventListener?.('currententrychange', sync);
  }, []);

  // Remember the object once its page has set its title.
  useEffect(() => {
    const href = `${pathname}${params.toString() ? `?${params}` : ''}`;
    const t = setTimeout(() => remember(href, document.title), 600);
    return () => clearTimeout(t);
  }, [pathname, params]);

  useEffect(() => {
    const load = () => setRecent(readRecent());
    load();
    window.addEventListener('peregrine:recent', load);
    return () => window.removeEventListener('peregrine:recent', load);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const btn = 'grid h-8 w-8 place-items-center rounded-[8px] text-ink-2 transition-colors duration-[var(--dur-fast)] hover:bg-ink/10 hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent';
  return (
    <div className="hidden items-center gap-1 lg:flex" aria-label="Investigation navigation">
      <button type="button" className={btn} onClick={() => router.back()} disabled={!can.back} aria-label="Back" title="Back (⌘[)"><ChevronLeft className="h-4 w-4" strokeWidth={2.25} aria-hidden /></button>
      <button type="button" className={btn} onClick={() => router.forward()} disabled={!can.forward} aria-label="Forward" title="Forward (⌘])"><ChevronRight className="h-4 w-4" strokeWidth={2.25} aria-hidden /></button>
      <div ref={menu} className="relative">
        <button type="button" className={btn} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label="Recently viewed" title="Recently viewed"><Clock className="h-4 w-4" aria-hidden /></button>
        {open && (
          <div role="menu" className="spotlight material-strong absolute left-0 top-10 z-40 w-[320px] rounded-[14px] p-1.5">
            <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-semibold text-ink-muted">Recently viewed</p>
            {recent.length ? recent.map((r) => (
              <Link key={r.href} role="menuitem" href={r.href} onClick={() => setOpen(false)} className="flex items-center justify-between gap-3 rounded-[9px] px-2.5 py-2 text-[13px] hover:bg-ink/8">
                <span className="min-w-0 truncate font-semibold text-ink">{r.title}</span>
                <span className="shrink-0 text-[11.5px] text-ink-muted">{r.kind}</span>
              </Link>
            )) : <p className="px-2.5 py-3 text-[12.5px] text-ink-muted">Coins, wallets, tokens and sectors you open appear here.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
