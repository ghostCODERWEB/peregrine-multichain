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
    <nav aria-label="Primary" className="space-y-4">
      {groups.map((g) => (
        <div key={g}>
          {g !== 'Explore' && <div className="label px-2 pb-2">{g === 'Research' ? 'Research' : 'AI'}</div>}
          <ul className="space-y-0.5">
            {items
              .filter((n) => n.group === g)
              .map((n) => {
                const Icon = ICONS[n.icon];
                const on = active(path, n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      onClick={onNavigate}
                      aria-current={on ? 'page' : undefined}
                      className={`nav-item liquid-control group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] ${on ? 'is-active text-ink' : 'text-ink-2 hover:text-ink'}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-brand' : 'text-ink-muted group-hover:text-ink-2'}`} aria-hidden />
                      <span className="min-w-0">
                        <span className="block">{n.label}</span>
                        {status[n.href] && (
                          <span className="num block truncate text-[11px] font-medium leading-tight" style={{ color: status[n.href].tone === 'in' ? 'var(--mint)' : status[n.href].tone === 'out' ? 'var(--flare)' : 'var(--ink-muted)' }}>
                            {status[n.href].text}
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
                <Link href="/coverage">Coverage</Link>
                <Link href="/account" className="needs-account">
                  Account
                </Link>
              </div>
              {children && <div className="mt-auto space-y-2 border-t border-border pt-3">{children}</div>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
