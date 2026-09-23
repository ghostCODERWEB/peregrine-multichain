import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV = [
  { href: '/', label: 'Weather map', short: 'Map' },
  { href: '/lab', label: 'Forecast Lab', short: 'Lab' },
  { href: '/alerts', label: 'Alerts', short: 'Alerts' },
  { href: '/coverage', label: 'Coverage', short: 'Coverage' },
];

export function SiteHeader() {
  const demo = process.env.DEMO_MODE === '1';
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-[0.2em] text-ink">TIDE</span>
          <span className="hidden text-xs text-ink-muted md:inline">smart-money weather · Nansen</span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm sm:gap-1" aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-md px-2 py-1.5 text-ink-2 hover:bg-accent hover:text-ink sm:px-2.5">
              <span className="sm:hidden">{n.short}</span>
              <span className="hidden sm:inline">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {demo && (
            <span className="rounded border border-border px-2 py-0.5 text-[11px] uppercase tracking-wider text-ink-2" title="Replaying recorded Nansen responses — no API key needed, no credits spent">
              Demo mode
            </span>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
