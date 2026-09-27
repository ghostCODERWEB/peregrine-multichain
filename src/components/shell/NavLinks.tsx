'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  Activity,
  Shuffle,
  Target,
  Bot,
  ArrowLeftRight,
  Bell,
  BrainCircuit,
  Briefcase,
  FlaskConical,
  Gauge,
  KeyRound,
  Layers,
  Map,
  Menu,
  Sparkles,
  X,
  NotebookPen,
  BadgeCheck,
  CopyCheck,
  Waypoints,
} from 'lucide-react';
import { NAV, type NavIcon } from './nav';
import { useSite } from '@/components/SiteContext';

const ICONS: Record<NavIcon, typeof Map> = {
  shield: ShieldCheck,
  map: Map,
  flows: Shuffle,
  sparkles: Sparkles,
  layers: Layers,
  activity: Activity,
  target: Target,
  bot: Bot,
  swap: ArrowLeftRight,
  brain: BrainCircuit,
  briefcase: Briefcase,
  flask: FlaskConical,
  badge: BadgeCheck,
  copy: CopyCheck,
  cascade: Waypoints,
  gauge: Gauge,
  bell: Bell,
  key: KeyRound,
  notebook: NotebookPen,
};

const active = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));

/** The grouped nav list: the sidebar on large screens, the drawer on phones. */
export function NavList({ onNavigate, status = {} }: { onNavigate?: () => void; status?: Record<string, { text: string; tone?: 'in' | 'out' }> }) {
  const path = usePathname() ?? '/';
  const { publicSite, accounts } = useSite();
  const items = NAV.filter((n) => !(publicSite && n.ownerOnly) && !(!accounts && n.signIn));
  const groups = [...new Set(items.map((n) => n.group))];
  return (
    <nav aria-label="Primary" className="nav-list space-y-3">
      {groups.map((g) => (
        <div key={g}>
          {g !== 'Explore' && <div className="px-3 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-muted">{g === 'Research' ? 'Research' : 'AI'}</div>}
          <ul className="space-y-0.5">
            {items
              .filter((n) => n.group === g)
              .map((n, i) => {
                const Icon = ICONS[n.icon];
                const on = active(path, n.href) || (n.also ?? []).some((h) => active(path, h));
                const st = status[n.href];
                return (
                  <li key={n.href} style={{ '--i': i } as React.CSSProperties}>
                    <Link
                      href={n.href}
                      onClick={onNavigate}
                      aria-current={on ? 'page' : undefined}
                      className={`nav-row group relative flex min-h-[40px] items-start gap-2.5 rounded-[12px] px-3 py-2 text-[13px] font-medium ${on ? 'is-on text-ink' : 'text-ink-2 hover:text-ink'}`}
                    >
                      <Icon className={`mt-[1px] h-4 w-4 shrink-0 transition-colors ${on ? 'text-[#1fe0a3]' : 'text-ink-muted group-hover:text-ink-2'}`} aria-hidden />
                      <span className="min-w-0 flex-1 leading-[18px]">
                        <span className="block truncate">{n.label}</span>
                        {st && (
                          <span className="num block truncate text-[11px] font-medium leading-[15px]" style={{ color: st.tone === 'in' ? 'var(--mint)' : st.tone === 'out' ? 'var(--flare)' : 'var(--ink-muted)' }}>
                            {st.text}
                          </span>
                        )}
                      </span>
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
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const returnFocus = trigger.current;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => [...(dialog.current?.querySelectorAll<HTMLElement>('a[href],button') ?? [])];
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab') {
        const all = focusables(),
          first = all[0],
          last = all.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      returnFocus?.focus();
    };
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="liquid-control inline-flex h-8 w-8 items-center justify-center rounded-xl text-ink-2 hover:text-ink lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-background/55 backdrop-blur-sm lg:hidden"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="liquid-glass liquid-glass-strong liquid-drawer absolute inset-y-2 right-2 flex w-[min(300px,88vw)] flex-col overflow-y-auto rounded-[24px] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-2">Menu</span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="liquid-control rounded-md p-1.5 text-ink-2 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavList onNavigate={() => setOpen(false)} />
              <div className="my-4 flex gap-4 text-sm">
                <Link href="/coverage">Data coverage</Link>
                <Link href="/proof">Proof</Link>
              </div>
              {children && <div className="mt-auto space-y-2 border-t border-border pt-3">{children}</div>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
