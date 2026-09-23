import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getKv } from '@/server/nansen/db';
import { accountStatus } from '@/server/nansen/account';
import { requestContext } from '@/server/context';
import { AccountButton } from '@/components/auth/AccountButton';

const NAV = [
  { href: '/', label: 'Weather map', short: 'Map' },
  { href: '/lab', label: 'Forecast Lab', short: 'Lab' },
  { href: '/alerts', label: 'Alerts', short: 'Alerts' },
  { href: '/coverage', label: 'Coverage', short: 'Coverage' },
];

export async function SiteHeader() {
  const demo = process.env.DEMO_MODE === '1';
  const ctx = await requestContext();
  const mode = ctx.mode;
  // Balances are private: the owner sees the instance's, a member their own.
  const acct = demo || mode === 'public' ? null : await accountStatus(mode === 'member' ? `u${ctx.user?.id}` : 'instance');
  let recorded: string | null = null;
  if (demo) {
    try { const v = getKv('demo_recorded_at'); recorded = v ? new Date(Number(v.value)).toISOString().slice(0, 16).replace('T', ' ') : null; } catch { recorded = null; }
  }
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
            <span className="rounded border border-border px-2 py-0.5 text-[11px] uppercase tracking-wider text-ink-2"
              title={`Replaying recorded Nansen responses — no API key, no credits.${recorded ? ` Scanner history recorded live on ${recorded} UTC, replayed with its clock moved to now.` : ''}`}>
              Demo{recorded ? ` · recorded ${recorded.slice(0, 10)}` : ' mode'}
            </span>
          )}
          {acct?.creditsRemaining != null && (
            <span className="num hidden rounded border border-border px-2 py-0.5 text-[11px] text-ink-2 sm:inline" title={`Nansen credits remaining${acct.plan ? ` · ${acct.plan} plan` : ''} (${acct.source === 'account' ? 'live from /api/v1/account' : 'last response header'})`}>
              {acct.creditsRemaining.toLocaleString('en-US')} cr
            </span>
          )}
          <span className={`hidden rounded px-2 py-0.5 text-[11px] md:inline ${mode !== 'public' ? 'border border-border text-ink-2' : 'text-ink-muted'}`}
            title={mode === 'owner' ? 'Owner view: this instance\u2019s own Nansen key; smart-money data and labels are shown (internal use under Nansen\u2019s rules).'
              : mode === 'member' ? 'Your view: calls use your own Nansen key, so what they return is yours to see. The scanner\u2019s smart-money history stays the owner\u2019s.'
              : 'Public view: smart-money trades, holdings and labels are withheld per Nansen\u2019s redistribution rules.'}>
            {mode === 'owner' ? 'Owner view' : mode === 'member' ? `Your key …${ctx.keyLast4}` : 'Public view'}
          </span>
          {!demo && <AccountButton signedIn={!!ctx.user} address={ctx.user?.address ?? null} />}
          <a href="https://www.nansen.ai" target="_blank" rel="noopener noreferrer" className="hidden text-[11px] text-ink-muted hover:text-ink lg:inline">Powered by Nansen API</a>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
