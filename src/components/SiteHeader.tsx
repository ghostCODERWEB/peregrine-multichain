import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getKv } from '@/server/nansen/db';
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
  const modeText = mode === 'owner' ? 'Owner view' : mode === 'member' ? `Your key …${ctx.keyLast4}` : 'Public view';
  const modeTitle = mode === 'owner' ? 'Owner view: this instance’s own Nansen key; smart-money data and labels are shown (internal use under Nansen’s rules).'
    : mode === 'member' ? 'Your view: calls use your own Nansen key, so what they return is yours to see. The scanner’s smart-money history stays the owner’s.'
    : 'Public view: smart-money trades, holdings and labels are withheld per Nansen’s redistribution rules.';

  return (
    <header className="shell-rail liquid-glass liquid-glass-strong fixed inset-x-2 top-2 z-40 flex h-12 items-center gap-2 rounded-2xl px-2.5
      lg:inset-y-[14px] lg:left-[14px] lg:right-auto lg:top-[14px] lg:h-auto lg:w-[236px] lg:flex-col lg:items-stretch lg:gap-0 lg:rounded-[22px] lg:p-3">
      <Link href="/" className="brand-lockup flex items-center gap-2.5 lg:border-b lg:border-[var(--liquid-separator)] lg:px-1 lg:pb-4 lg:pt-1" aria-label="Peregrine home">
        <span className="liquid-symbol grid h-8 w-8 place-items-center rounded-[11px]"><BrandMark size={19} /></span>
        <span className="leading-tight">
          <span className="block text-[17px] font-extrabold tracking-[-0.02em] text-ink">Peregrine</span>
          
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
        <div className="flex items-center gap-1.5 lg:justify-between">
          {accounts && <span className="hidden lg:inline"><AccountButton signedIn={!!ctx.user} address={ctx.user?.address ?? null} /></span>}
          <ThemeToggle />
        </div>
        <div className="hidden items-center justify-between gap-2 px-1 lg:flex"><Link href="/coverage" className="text-[10.5px] text-ink-muted">Coverage</Link>{accounts && <Link href="/account" className="text-[10.5px] text-ink-muted">Account</Link>}</div>
        <MobileMenu>
          <p className="text-[12px] text-ink-2" title={modeTitle}>{modeText}</p>
          {accounts && <AccountButton signedIn={!!ctx.user} address={ctx.user?.address ?? null} />}
        </MobileMenu>
      </div>
    </header>
  );
}
