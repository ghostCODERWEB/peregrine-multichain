'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Activity, Target, Bot, ArrowLeftRight, Bell, BrainCircuit, Briefcase, ChevronDown, FlaskConical, Gauge, KeyRound, Layers, Map, Menu, Sparkles, X, NotebookPen } from 'lucide-react';
import { NAV, type NavIcon } from './nav';

const ICONS: Record<NavIcon, typeof Map> = {
  map: Map, sparkles: Sparkles, layers: Layers, activity: Activity, target: Target, bot: Bot, swap: ArrowLeftRight, brain: BrainCircuit, briefcase: Briefcase, flask: FlaskConical, gauge: Gauge, bell: Bell, key: KeyRound, notebook: NotebookPen,
};

const active = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

/** The grouped nav list: the sidebar on large screens, the drawer on phones. */
export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname() ?? '/';
  const groups = [...new Set(NAV.map((n) => n.group))];
  return (
    <nav aria-label="Primary" className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <div className="label px-2 pb-1">{g}</div>
          <ul className="space-y-0.5">
            {NAV.filter((n) => n.group === g).map((n) => {
              const Icon = ICONS[n.icon];
              const on = active(path, n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} onClick={onNavigate} aria-current={on ? 'page' : undefined}
                    className={`liquid-control group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] ${on ? 'is-active text-ink' : 'text-ink-2 hover:text-ink'}`}>
                    <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-brand' : 'text-ink-muted group-hover:text-ink-2'}`} aria-hidden />
                    <span>{n.label}</span>
                    {on && <span className="ml-auto h-3.5 w-0.5 rounded-full bg-brand" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Desktop: the exchange-style bar. Primary items sit in the bar with an
 *  underline for the current page; the rest open from "More", grouped. A
 *  disclosure (not an ARIA menu): plain links, Tab order, Escape closes. */
export function TopNav() {
  const path = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [open]);
  const rest = NAV.filter((n) => !n.top);
  const groups = [...new Set(rest.map((n) => n.group))];
  const moreOn = rest.some((n) => active(path, n.href));
  const tab = (on: boolean) => `relative flex h-12 items-center px-2.5 text-[13px] ${on ? 'text-ink after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:bg-brand' : 'text-ink-2 hover:text-ink'}`;
  return (
    <nav aria-label="Primary" className="hidden items-center lg:flex">
      {NAV.filter((n) => n.top).map((n) => {
        const on = active(path, n.href);
        return <Link key={n.href} href={n.href} aria-current={on ? 'page' : undefined} className={tab(on)}>{n.label}</Link>;
      })}
      <div ref={box} className="relative">
        <button type="button" aria-expanded={open} aria-controls="more-nav" onClick={() => setOpen((o) => !o)} className={`${tab(moreOn)} gap-1`}>
          More <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {open && (
          <div id="more-nav" className="absolute left-0 top-full z-50 mt-px grid w-[420px] grid-cols-2 gap-x-2 gap-y-3 rounded-md border border-border bg-surface p-3 shadow-lg">
            {groups.map((g) => (
              <div key={g}>
                <div className="label px-2 pb-1">{g}</div>
                <ul>
                  {rest.filter((n) => n.group === g).map((n) => {
                    const Icon = ICONS[n.icon];
                    const on = active(path, n.href);
                    return (
                      <li key={n.href}>
                        <Link href={n.href} aria-current={on ? 'page' : undefined} className={`flex items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-raised ${on ? 'text-ink' : 'text-ink-2 hover:text-ink'}`}>
                          <Icon className={`h-3.5 w-3.5 ${on ? 'text-brand' : 'text-ink-muted'}`} aria-hidden />{n.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

/** Phones: a menu button that opens the nav (and the status items passed in)
 *  as a drawer. Rendered only while open, so nothing in it is duplicated. */
export function MobileMenu({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}
        className="liquid-control inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:text-ink lg:hidden">
        <Menu className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/70 lg:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Menu" className="absolute inset-y-0 right-0 flex w-[min(300px,88vw)] flex-col overflow-y-auto border-l border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-2">Menu</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="liquid-control rounded-md p-1.5 text-ink-2 hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            {children && <div className="mt-auto space-y-2 border-t border-border pt-3">{children}</div>}
          </div>
        </div>
      )}
    </>
  );
}
