import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getKv } from '@/server/nansen/db';
import { accountStatus } from '@/server/nansen/account';
import { requestContext } from '@/server/context';
import { AccountButton } from '@/components/auth/AccountButton';
import { Omnibox } from '@/components/search/Omnibox';
import { BrandMark } from '@/components/shell/BrandMark';
import { TopNav, MobileMenu } from '@/components/shell/NavLinks';

/**
 * The app shell: one exchange-style top bar on every screen size. On large
 * screens the primary nav sits in the bar; on phones it moves into a
 * drawer. Every control exists once — search, theme, account — so the
 * keyboard shortcut and assistive tech never meet two copies.
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
    <header className="fixed inset-x-0 top-0 z-40 flex h-12 items-center gap-3 border-b border-border bg-surface px-3 lg:px-5">
      <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Peregrine home">
        <BrandMark />
        <span className="text-[15px] font-semibold tracking-tight text-ink">Peregrine</span>
      </Link>
      <span className="hidden h-5 w-px bg-border lg:block" aria-hidden />

      <TopNav />

      <div className="ml-auto flex items-center gap-2">
        <Omnibox />
        {demo && (
          <span className="hidden whitespace-nowrap rounded border border-border px-1.5 py-0.5 text-[10.5px] uppercase tracking-wider text-ink-2 xl:inline"
            title={`Replaying recorded Nansen responses — no API key, no credits.${recorded ? ` Scanner history recorded live on ${recorded} UTC, replayed with its clock moved to now.` : ''}`}>
            Demo{recorded ? ` · ${recorded.slice(0, 10)}` : ''}
          </span>
        )}
        <span className={`hidden items-center gap-1.5 whitespace-nowrap text-[11.5px] xl:inline-flex ${mode !== 'public' ? 'text-ink-2' : 'text-ink-muted'}`} title={modeTitle}>
          <span className="live-dot" aria-hidden />{modeText}
          {acct?.creditsRemaining != null && (
            <span className="num text-ink-2" title={`Nansen credits remaining${acct.plan ? ` · ${acct.plan} plan` : ''} (${acct.source === 'account' ? 'live from /api/v1/account' : 'last response header'})`}>
              · {acct.creditsRemaining.toLocaleString('en-US')} cr
            </span>
          )}
        </span>
        {!demo && <span className="hidden lg:inline"><AccountButton signedIn={!!ctx.user} address={ctx.user?.address ?? null} /></span>}
        <ThemeToggle />
        <MobileMenu>
          <p className="text-[12px] text-ink-2" title={modeTitle}>{modeText}{acct?.creditsRemaining != null ? ` · ${acct.creditsRemaining.toLocaleString('en-US')} cr` : ''}</p>
          {demo && <p className="text-[11.5px] text-ink-muted">Demo{recorded ? ` · recorded ${recorded.slice(0, 10)}` : ''}: recorded Nansen responses, no credits.</p>}
          {!demo && <AccountButton signedIn={!!ctx.user} address={ctx.user?.address ?? null} />}
          <a href="https://www.nansen.ai" target="_blank" rel="noopener noreferrer" className="block text-[11px] text-ink-muted hover:text-ink">Powered by Nansen API</a>
        </MobileMenu>
      </div>
    </header>
  );
}
