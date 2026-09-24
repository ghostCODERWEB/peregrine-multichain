'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, Target, Bot, ArrowLeftRight, Bell, BrainCircuit, Briefcase, FlaskConical, Gauge, KeyRound, Layers, Map, Menu, Sparkles, X, NotebookPen } from 'lucide-react';
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
          <div className="px-2 pb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-muted">{g}</div>
          <ul className="space-y-0.5">
            {NAV.filter((n) => n.group === g).map((n) => {
              const Icon = ICONS[n.icon];
              const on = active(path, n.href);
              return (
                <li key={n.href}>
                  <Link href={n.href} onClick={onNavigate} aria-current={on ? 'page' : undefined}
                    className={`liquid-control group flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13.5px] ${on ? 'is-active bg-brand/12 text-ink' : 'text-ink-2 hover:text-ink'}`}>
                    <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-brand' : 'text-ink-muted group-hover:text-ink-2'}`} aria-hidden />
                    <span>{n.label}</span>
                    {on && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />}
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
        className="liquid-control inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:text-ink lg:hidden">
        <Menu className="h-4 w-4" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm lg:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Menu" className="glass glass-strong absolute inset-y-2 right-2 flex w-[min(300px,88vw)] flex-col rounded-[1.75rem] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-medium text-ink-2">Menu</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="liquid-control rounded-full p-1.5 text-ink-2 hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <NavList onNavigate={() => setOpen(false)} />
            {children && <div className="mt-auto space-y-2 border-t border-border pt-3">{children}</div>}
          </div>
        </div>
      )}
    </>
  );
}
