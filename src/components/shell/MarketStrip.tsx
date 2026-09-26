import Link from 'next/link';
import { tickerItems } from '@/server/ticker';
import { displayMode } from '@/server/mode';

/** The top bar's live ticker: readings across the app scrolling as a carousel (pauses on hover), from stored scanner data. */
export async function MarketStrip() {
  const items = tickerItems(await displayMode());
  if (!items.length) return null;
  const row = (dup: boolean) => items.map((it) => (
    <li key={`${dup ? 'b' : 'a'}-${it.key}`} aria-hidden={dup || undefined} className="shrink-0">
      <Link href={it.href} tabIndex={dup ? -1 : undefined} className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 transition-colors hover:bg-ink/5">
        <span className="font-semibold text-ink-muted">{it.label}</span>
        <span className="num font-semibold" style={{ color: it.tone === 'in' ? 'var(--mint)' : it.tone === 'out' ? 'var(--flare)' : 'var(--ink-2)' }}>{it.value}</span>
      </Link>
    </li>
  ));
  return (
    <div className="ticker hidden min-w-0 flex-1 overflow-hidden text-[12px] lg:block" aria-label="Market ticker">
      <ul className="ticker-track flex w-max items-center gap-3">{row(false)}{row(true)}</ul>
    </div>
  );
}
