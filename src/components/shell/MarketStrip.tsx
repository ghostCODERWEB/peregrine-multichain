import Link from 'next/link';
import { navStatus } from '@/server/nav-status';
import { displayMode } from '@/server/mode';

const ORDER: Array<[string, string]> = [['/smart-money', 'Smart Money'], ['/flows', 'Spot'], ['/perps', 'Perps'], ['/sectors', 'Sectors'], ['/', 'Chains']];

/** A persistent one-line read of the market, from stored scanner data (no Nansen call). */
export async function MarketStrip() {
  const s = navStatus(await displayMode());
  const items = ORDER.filter(([h]) => s[h]);
  if (!items.length) return null;
  return (
    <ul className="hidden min-w-0 flex-1 items-center gap-5 overflow-hidden text-[12px] lg:flex" aria-label="Market state">
      {items.map(([href, name]) => (
        <li key={href} className="min-w-0 shrink truncate">
          <Link href={href} className="hover:text-ink">
            <span className="font-semibold text-ink-muted">{name}</span>{' '}
            <span className="num font-semibold" style={{ color: s[href].tone === 'in' ? 'var(--mint)' : s[href].tone === 'out' ? 'var(--flare)' : 'var(--ink-2)' }}>{s[href].text}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
