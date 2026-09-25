// Public-site mode (TIDE_PUBLIC_SITE=1): Peregrine served to anyone on the
// operator's Nansen key, and usable only through its own pages.
//
//  - Every call uses the instance key, server-side; nobody signs in with a
//    wallet or brings a key (accounts, BYOK and personal MCP tokens off).
//  - Everyone is a public viewer: Nansen's redistribution rules still keep
//    smart-money trades and labels out, even if TIDE_DISPLAY_MODE=private
//    is set in the environment.
//  - Machine interfaces that would let another app spend the key are off
//    (public API, MCP, x402, trading); the remaining /api routes answer
//    same-origin browser requests only, rate-limited per visitor
//    (src/middleware.ts).
//  - Visitor traffic shares one daily credit budget (WEB_DAILY_CREDIT_CAP,
//    default 1,000); past it, pages serve cached data and say why.

export const publicSite = (): boolean => process.env.TIDE_PUBLIC_SITE === '1';

/** Wallet sign-in and bring-your-own-key. */
export const accountsEnabled = (): boolean => !publicSite() && process.env.TIDE_ACCOUNTS !== 'off';

/** Runs inside the Next.js server (a visitor's request), not the scanner
 *  worker or a script. Next sets NEXT_RUNTIME in its server runtimes only. */
export const inWebServer = (): boolean => !!process.env.NEXT_RUNTIME;

export function webDailyCreditCap(): number {
  const n = Number(process.env.WEB_DAILY_CREDIT_CAP ?? 1000);
  return Number.isFinite(n) && n >= 0 ? n : 1000;
}

/** Start of the current UTC day: the budget resets at 00:00 UTC. */
export const utcDayStart = (now = Date.now()): number => now - (now % 86_400_000);

export class DailyBudgetExhausted extends Error {
  constructor(cap: number) {
    super(`Peregrine's live-data budget for today (${cap.toLocaleString('en-US')} Nansen credits) is used up. Cached data is shown where available; it resets at 00:00 UTC.`);
    this.name = 'DailyBudgetExhausted';
  }
}
