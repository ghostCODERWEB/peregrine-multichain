import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getKv } from '@/server/nansen/db';
import { GetNansen } from '@/components/shell/GetNansen';
import { requestContext } from '@/server/context';
import { AccountButton } from '@/components/auth/AccountButton';
import { Omnibox } from '@/components/search/Omnibox';
import { BrandMark } from '@/components/shell/BrandMark';
import { NavList, MobileMenu } from '@/components/shell/NavLinks';
import { navStatus } from '@/server/nav-status';
import { accountsEnabled } from '@/server/site';

/**
 * The app shell: one header element that is a sidebar on large screens and
 * a compact top bar on phones (where the nav moves into a drawer). Every
 * control exists once — search, theme, account — so the keyboard shortcut
 * and assistive tech never meet two copies.
 */
export async function SiteHeader() {
  const demo = process.env.DEMO_MODE === '1';
  const accounts = !demo && accountsEnabled();
  const ctx = await requestContext();
  const mode = ctx.mode;
  const status = navStatus(mode);
  let recorded: string | null = null;
  if (demo) {
    try { const v = getKv('demo_recorded_at'); recorded = v ? new Date(Number(v.value)).toISOString().slice(0, 16).replace('T', ' ') : null; } catch { recorded = null; }
  }

  return (
    <header className="shell-rail liquid-glass liquid-glass-strong fixed inset-x-2 top-2 z-40 flex h-12 items-center gap-2 rounded-2xl px-2.5
      lg:inset-y-[14px] lg:left-[14px] lg:right-auto lg:top-[14px] lg:h-auto lg:w-[236px] lg:flex-col lg:items-stretch lg:gap-0 lg:rounded-[22px] lg:p-3">
      <Link href="/" className="brand-lockup flex items-center gap-2.5 lg:border-b lg:border-[var(--liquid-separator)] lg:px-1 lg:pb-4 lg:pt-1" aria-label="Peregrine home">
        <span className="brand-tile grid h-9 w-9 place-items-center rounded-[10px]"><BrandMark size={36} /></span>
        <span className="leading-tight">
          <span className="block text-[17px] font-extrabold tracking-[-0.02em] text-ink">Peregrine</span>
          <span className="hidden text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted lg:block">Onchain intelligence</span>
        </span>
      </Link>

      <div className="ml-auto lg:ml-0 lg:mb-4"><Omnibox /></div>

      <div className="hidden min-h-0 flex-1 overflow-y-auto lg:block"><NavList status={status} /></div>

      <div className="flex items-center gap-1.5 lg:mt-3 lg:flex-col lg:items-stretch lg:gap-2 lg:border-t lg:border-border lg:pt-3">
        {demo && (
          <span className="liquid-chip hidden rounded-xl px-2 py-1 text-center text-[10.5px] uppercase tracking-wider text-ink-2 lg:block"
            title={`Replaying recorded Nansen responses, no API key, no credits.${recorded ? ` Scanner history recorded live on ${recorded} UTC, replayed with its clock moved to now.` : ''}`}>
            Demo{recorded ? ` · recorded ${recorded.slice(0, 10)}` : ' mode'}
          </span>
        )}
        <GetNansen className="hidden lg:flex" />
        <div className="flex items-center gap-1.5 lg:justify-between lg:px-1">
          {accounts && <span className="hidden lg:inline"><AccountButton signedIn={!!ctx.user} address={ctx.user?.address ?? null} /></span>}
          <ThemeToggle />
          <span className="hidden items-center gap-3 lg:flex">
            <Link href="/coverage" className="text-[11.5px] font-medium text-ink-muted transition-colors hover:text-ink">Data coverage</Link>
            <Link href="/proof" className="text-[11.5px] font-medium text-ink-muted transition-colors hover:text-ink">Proof</Link>
            {accounts && <Link href="/account" className="text-[11.5px] font-medium text-ink-muted transition-colors hover:text-ink">Account</Link>}
          </span>
        </div>
        <MobileMenu>
          <GetNansen />
          {accounts && <AccountButton signedIn={!!ctx.user} address={ctx.user?.address ?? null} />}
        </MobileMenu>
      </div>
    </header>
  );
}
