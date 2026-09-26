'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: Array<[string, string, (p: string) => boolean]> = [
  ['/wallet', 'Wallets', (p) => p === '/wallet' || (p.startsWith('/wallet/') && !p.startsWith('/wallet/compare') && !p.startsWith('/wallet/watchlist'))],
  ['/portfolio', 'Portfolio', (p) => p.startsWith('/portfolio')],
  ['/wallet/watchlist', 'Watchlist', (p) => p.startsWith('/wallet/watchlist')],
  ['/wallet/compare', 'Compare traders', (p) => p.startsWith('/wallet/compare')],
];

/** Profiler's sections: one wallet, a basket of wallets, watched traders, and trader comparison. */
export function ProfilerTabs() {
  const path = usePathname() ?? '';
  return (
    <nav aria-label="Profiler" className="flex gap-1 overflow-x-auto border-b border-[var(--hair)]">
      {TABS.map(([href, label, on]) => (
        <Link key={href} href={href} aria-current={on(path) ? 'page' : undefined}
          className={`relative whitespace-nowrap px-3 py-2 text-[13px] font-semibold transition-colors ${on(path) ? 'text-ink after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[#1fe0a3]' : 'text-ink-muted hover:text-ink'}`}>{label}</Link>
      ))}
    </nav>
  );
}
