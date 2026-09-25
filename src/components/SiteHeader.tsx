import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getKv } from '@/server/nansen/db';
import { accountStatus } from '@/server/nansen/account';
import { requestContext } from '@/server/context';
import { AccountButton } from '@/components/auth/AccountButton';
import { Omnibox } from '@/components/search/Omnibox';
import { BrandMark } from '@/components/shell/BrandMark';
import { NavList, MobileMenu } from '@/components/shell/NavLinks';

/**
 * The app shell: one header element that is a sidebar on large screens and
 * a compact top bar on phones (where the nav moves into a drawer). Every
 * control exists once — search, theme, account — so the keyboard shortcut
 * and assistive tech never meet two copies.
 */
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
  const modeText = mode === 'owner' ? 'Owner view' : mode === 'member' ? `Your key …${ctx.keyLast4}` : 'Public view';
  const modeTitle = mode === 'owner' ? 'Owner view: this instance’s own Nansen key; smart-money data and labels are shown (internal use under Nansen’s rules).'
    : mode === 'member' ? 'Your view: calls use your own Nansen key, so what they return is yours to see. The scanner’s smart-money history stays the owner’s.'
    : 'Public view: smart-money trades, holdings and labels are withheld per Nansen’s redistribution rules.';

  return (
    <header className="shell-rail glass glass-strong fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 rounded-none border-x-0 border-t-0 px-3
      lg:inset-y-0 lg:left-0 lg:right-auto lg:h-auto lg:w-[236px] lg:flex-col lg:items-stretch lg:gap-0 lg:rounded-none lg:border-y-0 lg:border-l-0 lg:p-3">
      <Link href="/" className="brand-lockup flex items-center gap-2.5 lg:border-b lg:border-border lg:px-1 lg:pb-4 lg:pt-1" aria-label="Peregrine home">
        <span className="grid h-7 w-7 place-items-center rounded border border-border bg-raised"><BrandMark size={18} /></span>
        <span className="leading-tight">
          <span className="block text-[15px] font-semibold tracking-[-0.02em] text-ink">Peregrine</span>
          <span className="hidden text-[9px] uppercase tracking-[0.12em] text-ink-muted lg:block">onchain intelligence</span>
        </span>
      </Link>

      <div className="ml-auto lg:ml-0 lg:mb-4"><Omnibox /></div>

      <div className="hidden min-h-0 flex-1 overflow-y-auto lg:block"><NavList /></div>

      <div className="flex items-center gap-1.5 lg:mt-3 lg:flex-col lg:items-stretch lg:gap-2 lg:border-t lg:border-border lg:pt-3">
        {demo && (
          <span className="hidden rounded-md border border-border px-2 py-1 text-center text-[10.5px] uppercase tracking-wider text-ink-2 lg:block"
            title={`Replaying recorded Nansen responses — no API key, no credits.${recorded ? ` Scanner history recorded live on ${recorded} UTC, replayed with its clock moved to now.` : ''}`}>
            Demo{recorded ? ` · recorded ${recorded.slice(0, 10)}` : ' mode'}
          </span>
        )}
        <div className="hidden items-center justify-between gap-2 lg:flex">
          <span className={`inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-raised/40 px-2 py-1 text-[11px] ${mode !== 'public' ? 'text-ink-2' : 'text-ink-muted'}`} title={modeTitle}>
            <span className="live-dot" aria-hidden />{modeText}
          </span>
          {acct?.creditsRemaining != null && (
            <span className="num text-[11px] text-ink-2" title={`Nansen credits remaining${acct.plan ? ` · ${acct.plan} plan` : ''} (${acct.source === 'account' ? 'live from /api/v1/account' : 'last response header'})`}>
              {acct.creditsRemaining.toLocaleString('en-US')} cr
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 lg:justify-between">
          {!demo && <span className="hidden lg:inline"><AccountButton signedIn={!!ctx.user} address={ctx.user?.address ?? null} /></span>}
          <ThemeToggle />
        </div>
        <a href="https://www.nansen.ai" target="_blank" rel="noopener noreferrer" className="hidden px-1 text-[11px] text-ink-muted hover:text-ink lg:block">Powered by Nansen API</a>
        <MobileMenu>
          <p className="text-[12px] text-ink-2" title={modeTitle}>{modeText}{acct?.creditsRemaining != null ? ` · ${acct.creditsRemaining.toLocaleString('en-US')} cr` : ''}</p>
          {!demo && <AccountButton signedIn={!!ctx.user} address={ctx.user?.address ?? null} />}
        </MobileMenu>
      </div>
    </header>
  );
}
